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
    /** Geosearch radius in meters (clamped to API max, typically 10000) */
    radiusMeters: number;
    /** Identifying User-Agent for Wikimedia API etiquette */
    userAgent: string;
  };
  baseAppUrl: string;
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
    radiusMeters: Math.min(
      WIKIPEDIA_MAX_RADIUS_M,
      Math.max(1, Number(process.env.WIKIPEDIA_SEARCH_RADIUS ?? 1500))
    ),
    userAgent:
      process.env.WIKIPEDIA_USER_AGENT ??
      'StravaHistoryReport/1.0 (https://github.com/strava-history-report; no-contact)'
  },
  baseAppUrl:
    process.env.BASE_APP_URL ??
    (process.env.NODE_ENV === 'production' ? 'https://stravafacts.andvos.xyz' : 'http://localhost:5173'),
};
