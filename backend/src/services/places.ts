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

const getTierBonus = (titleLower: string, typesHint: string): number =>
  SCORING_TIERS.find((tier) =>
    tier.keywords.some((kw) => titleLower.includes(kw) || typesHint.includes(kw))
  )?.bonus ?? 0;

/** Keywords for pass A (monument-style titles), aligned with previous Google keyword pass */
const MONUMENT_TITLE_KEYWORDS = ['statue', 'sculpture', 'monument', 'memorial', 'obelisk'];

const titleMatchesMonumentPass = (title: string): boolean => {
  const t = title.toLowerCase();
  return MONUMENT_TITLE_KEYWORDS.some((kw) => t.includes(kw));
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
          distance: dist
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
      const score = -c.distance + bonus;
      return { candidate: c, score };
    })
    .sort((a, b) => b.score - a.score);

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

  const monumentSubset = pool.filter((c) => titleMatchesMonumentPass(c.title));
  const monumentScored = scoreAndSort(monumentSubset);
  const monumentPick = pickFromTop(monumentScored, 3);

  const broadScored = scoreAndSort(pool);
  const broadPick = pickFromTop(broadScored, 5);

  const top = monumentPick ?? broadPick;
  if (!top) {
    return null;
  }

  return toSelectedPlace(top);
};
