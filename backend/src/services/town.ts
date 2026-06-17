import axios from 'axios';
import { config } from '../config';

export type RoutePoint = { lat: number; lng: number };

/** Nearest settlement that resolves to a verified Wikipedia article. */
export type NearestTown = {
  /** OSM display name of the settlement */
  townName: string;
  /** Distance from the nearest sampled route point (meters) */
  distance: number;
  /** Canonical Wikipedia article title */
  articleTitle: string;
  /** Verified, stable Wikipedia article URL */
  articleUrl: string;
};

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OverpassElement[] };

/** `place=*` values treated as an "incorporated town" first; villages only if nothing larger is near. */
const PRIMARY_PLACE_KINDS = ['city', 'town'];
const WIDER_PLACE_KINDS = ['village'];

/** Cap how many nearby settlements we probe for an article before giving up. */
const MAX_SETTLEMENTS_TO_PROBE = 5;

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two lat/lng points, in meters. */
const haversineMeters = (a: RoutePoint, b: RoutePoint): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

// --- Overpass (OpenStreetMap) — nearest settlement -------------------------

const overpassUrl = (): string => `${config.overpass.origin}/api/interpreter`;

const buildOverpassQuery = (points: RoutePoint[], placeKinds: string[]): string => {
  const radius = config.overpass.radiusMeters;
  const clauses = points
    .flatMap((p) => placeKinds.map((kind) => `  node(around:${radius},${p.lat},${p.lng})[place=${kind}];`))
    .join('\n');
  return `[out:json][timeout:25];\n(\n${clauses}\n);\nout tags;`;
};

const fetchSettlements = async (points: RoutePoint[], placeKinds: string[]): Promise<OverpassElement[]> => {
  const query = buildOverpassQuery(points, placeKinds);
  const { data } = await axios.post<OverpassResponse>(overpassUrl(), query, {
    headers: { 'User-Agent': config.overpass.userAgent, 'Content-Type': 'text/plain' },
    timeout: 30_000
  });
  return data.elements ?? [];
};

const elementPoint = (el: OverpassElement): RoutePoint | null => {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
};

type RankedSettlement = { name: string; tags: Record<string, string>; distance: number };

/** Named settlements sorted nearest-first by distance to any sampled route point. */
const rankSettlements = (elements: OverpassElement[], points: RoutePoint[]): RankedSettlement[] =>
  elements
    .map((el): RankedSettlement | null => {
      const name = el.tags?.name;
      const pt = elementPoint(el);
      if (!name || !pt) return null;
      const distance = Math.min(...points.map((p) => haversineMeters(p, pt)));
      return { name, tags: el.tags ?? {}, distance };
    })
    .filter((s): s is RankedSettlement => s !== null)
    .sort((a, b) => a.distance - b.distance);

// --- Wikipedia / Wikidata — resolve + verify an article --------------------

const wikiApiUrl = (): string => `${config.wikipedia.origin}/w/api.php`;
const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';

const wikiHeaders = () => ({ 'User-Agent': config.wikipedia.userAgent });

/** Resolve a Wikidata Q-id to its English Wikipedia title (the sitelink also proves the article exists). */
const titleFromWikidata = async (qid: string): Promise<string | null> => {
  const { data } = await axios.get(WIKIDATA_API_URL, {
    headers: wikiHeaders(),
    params: { action: 'wbgetentities', ids: qid, props: 'sitelinks', sitefilter: 'enwiki', format: 'json' }
  });
  const title = data?.entities?.[qid]?.sitelinks?.enwiki?.title;
  return typeof title === 'string' ? title : null;
};

/** Parse an OSM `wikipedia` tag (`en:Some Title` or bare `Some Title`) into an English title, or null. */
const titleFromWikipediaTag = (tag: string | undefined): string | null => {
  if (!tag) return null;
  const colon = tag.indexOf(':');
  if (colon === -1) return tag.trim() || null;
  const lang = tag.slice(0, colon).toLowerCase();
  const rest = tag.slice(colon + 1).trim();
  if (lang !== 'en') return null; // only trust English Wikipedia for now
  return rest || null;
};

/** Fuzzy last resort: search Wikipedia by name and take the top hit's title. */
const searchTitle = async (name: string): Promise<string | null> => {
  const { data } = await axios.get(wikiApiUrl(), {
    headers: wikiHeaders(),
    params: { action: 'query', list: 'search', srsearch: name, srlimit: 1, format: 'json' }
  });
  const hit = data?.query?.search?.[0]?.title;
  return typeof hit === 'string' ? hit : null;
};

/** Confirm a title resolves to a real (non-missing) article and return its canonical URL. */
const verifyAndGetUrl = async (title: string): Promise<{ title: string; url: string } | null> => {
  const { data } = await axios.get(wikiApiUrl(), {
    headers: wikiHeaders(),
    params: { action: 'query', titles: title, redirects: 1, prop: 'info', inprop: 'url', format: 'json' }
  });
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0] as { title?: string; missing?: string; fullurl?: string } | undefined;
  if (!page || page.missing !== undefined || !page.title || !page.fullurl) return null;
  return { title: page.title, url: page.fullurl };
};

/**
 * Turn a settlement's OSM tags (or, failing that, its name) into a verified
 * Wikipedia article. Tries the authoritative tags first, name search last.
 */
const resolveAndVerifyArticle = async (
  tags: Record<string, string>,
  name: string
): Promise<{ title: string; url: string } | null> => {
  if (tags.wikidata) {
    const title = await titleFromWikidata(tags.wikidata).catch(() => null);
    if (title) {
      const verified = await verifyAndGetUrl(title).catch(() => null);
      if (verified) return verified;
    }
  }

  const fromTag = titleFromWikipediaTag(tags.wikipedia);
  if (fromTag) {
    const verified = await verifyAndGetUrl(fromTag).catch(() => null);
    if (verified) return verified;
  }

  const fromSearch = await searchTitle(name).catch(() => null);
  if (fromSearch) {
    const verified = await verifyAndGetUrl(fromSearch).catch(() => null);
    if (verified) return verified;
  }

  return null;
};

/**
 * Guaranteed-URL backstop: find the nearest town to the sampled route points and
 * return its verified Wikipedia article. Returns null only if no nearby settlement
 * resolves to a real article (caller should fall back to a generic message).
 */
export const chooseNearestTown = async (points: RoutePoint[]): Promise<NearestTown | null> => {
  if (points.length === 0) return null;

  let elements = await fetchSettlements(points, PRIMARY_PLACE_KINDS);
  if (elements.length === 0) {
    elements = await fetchSettlements(points, [...PRIMARY_PLACE_KINDS, ...WIDER_PLACE_KINDS]);
  }
  if (elements.length === 0) return null;

  const ranked = rankSettlements(elements, points).slice(0, MAX_SETTLEMENTS_TO_PROBE);

  for (const settlement of ranked) {
    const article = await resolveAndVerifyArticle(settlement.tags, settlement.name).catch(() => null);
    if (article) {
      return {
        townName: settlement.name,
        distance: settlement.distance,
        articleTitle: article.title,
        articleUrl: article.url
      };
    }
  }

  return null;
};
