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
  { keywords: ['museum', 'cemetery', 'heritage', 'historic', 'landmark'], bonus: 700 },
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

const toSelectedPlace = (c: MergedCandidate): SelectedPlace => ({
  pageid: c.pageid,
  title: c.title,
  lat: c.lat,
  lon: c.lon,
  distance: c.distance,
  articleUrl: articleUrlForPage(c.pageid)
});

export const chooseHistoricPlace = async (points: RepresentativePoint[]): Promise<SelectedPlace | null> => {
  const merged = await mergeCandidatesByPageId(points);
  if (merged.size === 0) {
    return null;
  }

  const all = Array.from(merged.values());
  const monumentSubset = all.filter((c) => titleMatchesMonumentPass(c.title));

  const monumentScored = scoreAndSort(monumentSubset);
  const monumentTop = monumentScored[0]?.candidate ?? null;

  const broadScored = scoreAndSort(all);
  const broadTop = broadScored[0]?.candidate ?? null;

  const top = monumentTop ?? broadTop;
  if (!top) {
    return null;
  }

  return toSelectedPlace(top);
};
