import dotenv from 'dotenv';

dotenv.config();

type Config = {
  port: number;
  databaseUrl: string;
  strava: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    webhookVerifyToken: string;
    webhookCallbackUrl: string;
  };
  wikipedia: {
    /** e.g. https://en.wikipedia.org — API is at {origin}/w/api.php */
    origin: string;
    /** e.g. https://wikimedia.org — Pageviews REST API is at {origin}/api/rest_v1 */
    pageviewsOrigin: string;
    /** Geosearch radius in meters (clamped to API max, typically 10000) */
    radiusMeters: number;
    /** Identifying User-Agent for Wikimedia API etiquette */
    userAgent: string;
  };
  placeScoring: {
    /** Multiplier applied to log10(monthlyViews + 1) when scoring candidates */
    notabilityWeight: number;
    /** Minimum average monthly pageviews for a candidate to clear the notability bar */
    minMonthlyViews: number;
    /** How many nearest candidates to enrich with pageviews (bounds API calls per activity) */
    enrichTopN: number;
    /** Trailing window (months) of pageviews to average over */
    pageviewsWindowMonths: number;
  };
  overpass: {
    /** e.g. https://overpass-api.de — endpoint is at {origin}/api/interpreter */
    origin: string;
    /** Nearest-town search radius in meters */
    radiusMeters: number;
    /** Identifying User-Agent for OSM/Overpass etiquette */
    userAgent: string;
  };
  baseAppUrl: string;
  /** When true, log the would-be Strava description instead of writing it. */
  dryRun: boolean;
};

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
};

const WIKIPEDIA_MAX_RADIUS_M = 10_000;

export const config: Config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required(process.env.DATABASE_URL, 'DATABASE_URL'),
  strava: {
    clientId: required(process.env.STRAVA_CLIENT_ID, 'STRAVA_CLIENT_ID'),
    clientSecret: required(process.env.STRAVA_CLIENT_SECRET, 'STRAVA_CLIENT_SECRET'),
    redirectUri: required(process.env.STRAVA_REDIRECT_URI, 'STRAVA_REDIRECT_URI'),
    webhookVerifyToken: required(process.env.STRAVA_WEBHOOK_VERIFY_TOKEN, 'STRAVA_WEBHOOK_VERIFY_TOKEN'),
    webhookCallbackUrl: required(process.env.STRAVA_WEBHOOK_CALLBACK_URL, 'STRAVA_WEBHOOK_CALLBACK_URL')
  },
  wikipedia: {
    origin: (process.env.WIKIPEDIA_ORIGIN ?? 'https://en.wikipedia.org').replace(/\/$/, ''),
    pageviewsOrigin: (process.env.WIKIPEDIA_PAGEVIEWS_ORIGIN ?? 'https://wikimedia.org').replace(/\/$/, ''),
    radiusMeters: Math.min(
      WIKIPEDIA_MAX_RADIUS_M,
      Math.max(1, Number(process.env.WIKIPEDIA_SEARCH_RADIUS ?? 1500))
    ),
    userAgent:
      process.env.WIKIPEDIA_USER_AGENT ??
      'StravaHistoryReport/1.0 (https://github.com/strava-history-report; no-contact)'
  },
  placeScoring: {
    notabilityWeight: Math.max(0, Number(process.env.PLACE_NOTABILITY_WEIGHT ?? 300)),
    minMonthlyViews: Math.max(0, Number(process.env.PLACE_MIN_MONTHLY_VIEWS ?? 500)),
    enrichTopN: Math.max(1, Number(process.env.PLACE_ENRICH_TOP_N ?? 12)),
    pageviewsWindowMonths: Math.max(1, Number(process.env.PLACE_PAGEVIEWS_WINDOW_MONTHS ?? 12))
  },
  overpass: {
    origin: (process.env.OVERPASS_ORIGIN ?? 'https://overpass-api.de').replace(/\/$/, ''),
    radiusMeters: Math.max(1, Number(process.env.OVERPASS_SEARCH_RADIUS ?? 40_000)),
    userAgent:
      process.env.OVERPASS_USER_AGENT ??
      process.env.WIKIPEDIA_USER_AGENT ??
      'StravaHistoryReport/1.0 (https://github.com/strava-history-report; no-contact)'
  },
  baseAppUrl:
    process.env.BASE_APP_URL ??
    (process.env.NODE_ENV === 'production' ? 'https://stravafacts.andvos.xyz' : 'http://localhost:5173'),
  dryRun: ['1', 'true', 'yes'].includes((process.env.DRY_RUN ?? '').toLowerCase())
};
