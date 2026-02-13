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
  googleMaps: {
    apiKey: string;
    radius: number;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  baseAppUrl: string;
};

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
};

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
  googleMaps: {
    apiKey: required(process.env.GOOGLE_MAPS_API_KEY, 'GOOGLE_MAPS_API_KEY'),
    radius: Number(process.env.GOOGLE_MAPS_RADIUS ?? 1500),
  },
  openai: {
    apiKey: required(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY'),
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
  baseAppUrl:
    process.env.BASE_APP_URL ??
    (process.env.NODE_ENV === 'production' ? 'https://stravafacts.andvos.xyz' : 'http://localhost:5173'),
};
