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
const HISTORIC_KEYWORDS = [
  'historic',
  'memorial',
  'museum',
  'monument',
  'landmark',
  'cemetery',
  'statue',
  'heritage',
  'park',
  'state park',
  'trail',
  'preserve',
  'garden'
];
const PLACE_TYPES = ['tourist_attraction', 'park'];
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

const fetchNearby = async (point: RepresentativePoint, placeType: string) => {
  const { data } = await axios.get<PlacesResponse>(GOOGLE_PLACES_URL, {
    params: {
      key: config.googleMaps.apiKey,
      location: `${point.lat},${point.lng}`,
      radius: config.googleMaps.radius,
      keyword: PLACE_KEYWORDS,
      type: placeType
    }
  });
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

export const chooseHistoricPlace = async (points: RepresentativePoint[]): Promise<SelectedPlace | null> => {
  const candidatesById = new Map<string, SelectedPlace>();
  for (const pt of points) {
    const responses = await Promise.all(PLACE_TYPES.map((type) => fetchNearby(pt, type)));
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

  if (candidatesById.size === 0) {
    return null;
  }

  const scored = Array.from(candidatesById.values())
    .map((candidate) => {
      const name = candidate.name.toLowerCase();
      const types = candidate.types?.join(' ').toLowerCase() ?? '';
      const hasBonus = HISTORIC_KEYWORDS.some((kw) => name.includes(kw) || types.includes(kw));
      const rating = candidate.rating ?? 0;
      const score = -candidate.distance + rating * 100 + (hasBonus ? 500 : 0);
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0]?.candidate;
  if (!top) {
    return null;
  }

  const details = await fetchDetails(top.place_id);
  return {
    ...top,
    distance: scored[0].candidate.distance,
    notes: details?.editorial_summary?.overview ?? details?.formatted_address
  };
};
