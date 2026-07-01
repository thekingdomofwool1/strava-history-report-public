import axios from 'axios';
import { config } from '../config';

export type RepresentativePoint = { lat: number; lng: number };

/** Article chosen via Wikipedia geosearch + scoring */
export type SelectedPlace = {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
  /** Shortest distance from any sampled route point to this article (meters) */
  distance: number;
  /** Stable link to the article */
  articleUrl: string;
};

const SCORING_TIERS = [
  { keywords: ['statue', 'monument', 'memorial', 'obelisk', 'sculpture'], bonus: 1500 },
  { keywords: ['museum', 'cemetery', 'heritage', 'historic', 'landmark', 'church', 'cathedral', 'chapel', 'basilica', 'abbey', 'monastery', 'priory'], bonus: 700 },
  { keywords: ['park', 'trail', 'garden', 'preserve', 'arboretum'], bonus: 200 }
];

/** Titles that are rarely iconic; pushed down hard so a nearby hotel can't win. */
const PENALTY_KEYWORDS = [
  'hotel', 'motel', 'inn', 'resort', 'restaurant', 'bar', 'pub', 'cafe',
  'diner', 'station', 'parking', 'apartment', 'condominium'
];
const PENALTY_BONUS = -5000;

/** High-tier (monument/memorial-style) titles always clear the notability bar. */
const HIGH_TIER_KEYWORDS = SCORING_TIERS[0].keywords;

const titleIsPenalized = (titleLower: string): boolean =>
  PENALTY_KEYWORDS.some((kw) => titleLower.includes(kw));

const getTierBonus = (titleLower: string, typesHint: string): number => {
  if (titleIsPenalized(titleLower)) {
    return PENALTY_BONUS;
  }
  return (
    SCORING_TIERS.find((tier) =>
      tier.keywords.some((kw) => titleLower.includes(kw) || typesHint.includes(kw))
    )?.bonus ?? 0
  );
};

const titleMatchesHighTier = (title: string): boolean => {
  const t = title.toLowerCase();
  return HIGH_TIER_KEYWORDS.some((kw) => t.includes(kw));
};

type GeoSearchRow = {
  pageid: number;
  ns: number;
  title: string;
  lat: number;
  lon: number;
  dist: number;
  primary?: string;
};

type GeoSearchResponse = {
  query?: { geosearch?: GeoSearchRow[] };
};

const GSLIMIT = 50;

const apiUrl = () => `${config.wikipedia.origin}/w/api.php`;

const articleUrlForPage = (pageid: number) => `${config.wikipedia.origin}/?curid=${pageid}`;

const httpHeaders = () => ({
  'User-Agent': config.wikipedia.userAgent
});

const fetchGeosearch = async (point: RepresentativePoint): Promise<GeoSearchRow[]> => {
  const gscoord = `${point.lat}|${point.lng}`;
  const { data } = await axios.get<GeoSearchResponse>(apiUrl(), {
    headers: httpHeaders(),
    params: {
      action: 'query',
      format: 'json',
      list: 'geosearch',
      gscoord,
      gsradius: config.wikipedia.radiusMeters,
      gslimit: GSLIMIT
    }
  });
  return data.query?.geosearch ?? [];
};

type MergedCandidate = {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
  distance: number;
  /** Average monthly Wikipedia pageviews; -1 until enriched, 0 when unavailable. */
  views: number;
};

/** Format a Date as the YYYYMMDD00 stamp the Pageviews REST API expects (UTC). */
const pageviewsStamp = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}00`;
};

type PageviewsResponse = { items?: { views?: number }[] };

/**
 * Average monthly pageviews for an article over a trailing window.
 * Fails open: returns 0 on any error / missing data so annotation never breaks.
 */
const fetchMonthlyPageviews = async (title: string): Promise<number> => {
  const months = config.placeScoring.pageviewsWindowMonths;
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months, 1));
  const article = encodeURIComponent(title.replace(/ /g, '_'));
  const url =
    `${config.wikipedia.pageviewsOrigin}/api/rest_v1/metrics/pageviews/per-article/` +
    `en.wikipedia/all-access/all-agents/${article}/monthly/` +
    `${pageviewsStamp(start)}/${pageviewsStamp(end)}`;
  try {
    const { data } = await axios.get<PageviewsResponse>(url, {
      headers: httpHeaders(),
      timeout: 5000
    });
    const items = data.items ?? [];
    if (items.length === 0) return 0;
    const total = items.reduce((sum, it) => sum + (it.views ?? 0), 0);
    return total / items.length;
  } catch {
    return 0;
  }
};

/** Enrich the nearest `enrichTopN` candidates with pageviews, in parallel. */
const enrichWithPageviews = async (candidates: MergedCandidate[]): Promise<void> => {
  const nearest = [...candidates]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, config.placeScoring.enrichTopN);
  await Promise.all(
    nearest.map(async (c) => {
      c.views = await fetchMonthlyPageviews(c.title);
    })
  );
};

const mergeCandidatesByPageId = async (points: RepresentativePoint[]): Promise<Map<number, MergedCandidate>> => {
  const byPage = new Map<number, MergedCandidate>();
  for (const pt of points) {
    const rows = await fetchGeosearch(pt);
    for (const row of rows) {
      const prev = byPage.get(row.pageid);
      const dist = row.dist;
      if (!prev || dist < prev.distance) {
        byPage.set(row.pageid, {
          pageid: row.pageid,
          title: row.title,
          lat: row.lat,
          lon: row.lon,
          distance: dist,
          views: -1
        });
      }
    }
  }
  return byPage;
};

const scoreAndSort = (candidates: MergedCandidate[]) =>
  candidates
    .map((c) => {
      const name = c.title.toLowerCase();
      const bonus = getTierBonus(name, '');
      // Pageviews dominate (notable places are vastly more visited); the keyword
      // tier nudges ties, and distance only breaks near-equal candidates.
      const views = Math.max(0, c.views);
      const notability = config.placeScoring.notabilityWeight * Math.log10(views + 1);
      const score = notability + bonus - c.distance;
      return { candidate: c, score };
    })
    .sort((a, b) => b.score - a.score);

/**
 * Iconic enough if it is well-visited or a monument-style title — but never a
 * penalized type (hotel/restaurant/etc.), which should not be picked even when
 * it happens to be popular.
 */
const isIconicEnough = (c: MergedCandidate): boolean => {
  if (titleIsPenalized(c.title.toLowerCase())) return false;
  return c.views >= config.placeScoring.minMonthlyViews || titleMatchesHighTier(c.title);
};

/** Pick randomly from the top-N scored candidates. */
const pickFromTop = (scored: { candidate: MergedCandidate; score: number }[], n: number): MergedCandidate | null => {
  const pool = scored.slice(0, n);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)].candidate;
};

const toSelectedPlace = (c: MergedCandidate): SelectedPlace => ({
  pageid: c.pageid,
  title: c.title,
  lat: c.lat,
  lon: c.lon,
  distance: c.distance,
  articleUrl: articleUrlForPage(c.pageid)
});

export const chooseHistoricPlace = async (
  points: RepresentativePoint[],
  excludedPageIds: Set<number> = new Set()
): Promise<SelectedPlace | null> => {
  const merged = await mergeCandidatesByPageId(points);
  if (merged.size === 0) {
    return null;
  }

  const all = Array.from(merged.values());

  // Filter out already-used articles; fall back to full set if everything is excluded.
  const novel = all.filter((c) => !excludedPageIds.has(c.pageid));
  const candidates = novel.length > 0 ? novel : all;

  // Prefer candidates within 200 m of any sampled route point; fall back to full set if none qualify.
  const NEARBY_M = 200;
  const nearby = candidates.filter((c) => c.distance <= NEARBY_M);
  const pool = nearby.length > 0 ? nearby : candidates;

  // Enrich the nearest candidates with pageviews so notability can drive ranking.
  await enrichWithPageviews(pool);

  const scored = scoreAndSort(pool);

  // Draw from the top of the iconic-enough pool for a little variety; if nothing
  // clears the notability bar, still annotate with the single best-scoring place.
  const iconicScored = scored.filter((s) => isIconicEnough(s.candidate));
  const top = pickFromTop(iconicScored, 3) ?? scored[0]?.candidate ?? null;
  if (!top) {
    return null;
  }

  return toSelectedPlace(top);
};
