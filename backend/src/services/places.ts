import axios from 'axios';
import { config } from '../config';

export type RepresentativePoint = { lat: number; lng: number };

export type PlaceCandidate = {
  place_id: string;
  name: string;
  vicinity?: string;
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  geometry: { location: { lat: number; lng: number } };
};

type PlacesResponse = {
  results: PlaceCandidate[];
};

const GOOGLE_PLACES_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const GOOGLE_PLACES_DETAILS = 'https://maps.googleapis.com/maps/api/place/details/json';
const SCORING_TIERS = [
  { keywords: ['statue', 'monument', 'memorial', 'obelisk', 'sculpture'], bonus: 1500 },
  { keywords: ['museum', 'cemetery', 'heritage', 'historic', 'landmark'], bonus: 700 },
  { keywords: ['park', 'trail', 'garden', 'preserve', 'arboretum'], bonus: 200 }
];

const getTierBonus = (name: string, types: string): number =>
  SCORING_TIERS.find((tier) => tier.keywords.some((kw) => name.includes(kw) || types.includes(kw)))?.bonus ?? 0;

const PLACE_TYPES = ['tourist_attraction', 'park', 'point_of_interest'];
const MONUMENT_KEYWORDS = 'statue sculpture monument memorial obelisk';
const PLACE_KEYWORDS =
  'historic history museum monument memorial landmark cemetery statue heritage park "state park" trail nature preserve garden arboretum';

const haversine = (a: RepresentativePoint, b: RepresentativePoint) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const f =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(f), Math.sqrt(1 - f));
  return R * c;
};

const fetchNearby = async (point: RepresentativePoint, placeType: string, keyword = PLACE_KEYWORDS) => {
  const params: Record<string, string | number> = {
    key: config.googleMaps.apiKey,
    location: `${point.lat},${point.lng}`,
    radius: config.googleMaps.radius,
    keyword
  };
  if (placeType) params.type = placeType;
  const { data } = await axios.get<PlacesResponse>(GOOGLE_PLACES_URL, { params });
  return data.results ?? [];
};

const fetchDetails = async (placeId: string) => {
  const { data } = await axios.get<{ result?: { editorial_summary?: { overview: string }; formatted_address?: string } }>(
    GOOGLE_PLACES_DETAILS,
    {
      params: {
        key: config.googleMaps.apiKey,
        place_id: placeId,
        fields: 'editorial_summary,formatted_address'
      }
    }
  );
  return data.result;
};

export type SelectedPlace = PlaceCandidate & {
  distance: number;
  notes?: string;
};

const collectCandidates = async (
  points: RepresentativePoint[],
  placeTypes: string[],
  keyword: string
): Promise<Map<string, SelectedPlace>> => {
  const candidatesById = new Map<string, SelectedPlace>();
  for (const pt of points) {
    const responses = await Promise.all(placeTypes.map((type) => fetchNearby(pt, type, keyword)));
    for (const results of responses) {
      for (const candidate of results) {
        const distance = haversine(pt, {
          lat: candidate.geometry.location.lat,
          lng: candidate.geometry.location.lng
        });
        const prev = candidatesById.get(candidate.place_id);
        if (!prev || distance < prev.distance) {
          candidatesById.set(candidate.place_id, { ...candidate, distance });
        }
      }
    }
  }
  return candidatesById;
};

const scoreAndSort = (candidates: Map<string, SelectedPlace>) =>
  Array.from(candidates.values())
    .map((candidate) => {
      const name = candidate.name.toLowerCase();
      const types = candidate.types?.join(' ').toLowerCase() ?? '';
      const bonus = getTierBonus(name, types);
      const rating = candidate.rating ?? 0;
      const score = -candidate.distance + rating * 100 + bonus;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

export const chooseHistoricPlace = async (points: RepresentativePoint[]): Promise<SelectedPlace | null> => {
  // Pass 1: monument-focused search (no type filter — broader net for statues/memorials)
  const monumentCandidates = await collectCandidates(points, [''], MONUMENT_KEYWORDS);
  const monumentScored = scoreAndSort(monumentCandidates);
  const monumentTop = monumentScored[0]?.candidate ?? null;

  // Pass 2: broad historic search across all place types
  const broadCandidates = await collectCandidates(points, PLACE_TYPES, PLACE_KEYWORDS);
  const broadScored = scoreAndSort(broadCandidates);
  const broadTop = broadScored[0]?.candidate ?? null;

  // Prefer a monument result; fall back to broad if none found
  const top = monumentTop ?? broadTop;
  if (!top) {
    return null;
  }

  const details = await fetchDetails(top.place_id);
  const distance = monumentTop
    ? (monumentScored[0]?.candidate.distance ?? 0)
    : (broadScored[0]?.candidate.distance ?? 0);

  return {
    ...top,
    distance,
    notes: details?.editorial_summary?.overview ?? details?.formatted_address
  };
};
