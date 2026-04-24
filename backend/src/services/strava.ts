import axios from 'axios';
import { prisma } from '../lib/prisma';
import { config } from '../config';

const STRAVA_API = 'https://www.strava.com/api/v3';

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: { id: number };
};

type StravaActivity = {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  description: string | null;
  start_latlng?: [number, number];
  map?: {
    summary_polyline?: string;
  };
  has_heartrate?: boolean;
  distance?: number;
};

export const buildAuthUrl = (state: string): string => {
  const params = new URLSearchParams({
    client_id: config.strava.clientId,
    response_type: 'code',
    redirect_uri: config.strava.redirectUri,
    scope: 'read,read_all,activity:read,activity:read_all,activity:write',
    state
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
};

export const exchangeToken = async (code: string) => {
  const params = new URLSearchParams({
    client_id: config.strava.clientId,
    client_secret: config.strava.clientSecret,
    code,
    grant_type: 'authorization_code'
  });

  const { data } = await axios.post<TokenResponse>(
    'https://www.strava.com/oauth/token',
    params
  );

  return data;
};

export const refreshAccessToken = async (userId: number, forceRefresh = false) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  if (!forceRefresh && user.tokenExpiresAt.getTime() > Date.now() + 60 * 1000) {
    return user;
  }

  console.log(`Refreshing access token for user ${userId} (force=${forceRefresh})`);

  const params = new URLSearchParams({
    client_id: config.strava.clientId,
    client_secret: config.strava.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: user.refreshToken
  });

  const { data } = await axios.post<{ access_token: string; refresh_token: string; expires_at: number }>(
    'https://www.strava.com/oauth/token',
    params
  );

  return prisma.user.update({
    where: { id: user.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: new Date(data.expires_at * 1000)
    }
  });
};

export const getActivity = async (user: { accessToken: string }, activityId: number) => {
  const { data } = await axios.get<StravaActivity>(`${STRAVA_API}/activities/${activityId}`, {
    headers: {
      Authorization: `Bearer ${user.accessToken}`
    }
  });
  return data;
};

export const updateActivityDescription = async (user: { accessToken: string }, activityId: number, description: string) => {
  await axios.put(
    `${STRAVA_API}/activities/${activityId}`,
    { description },
    { headers: { Authorization: `Bearer ${user.accessToken}` } }
  );
};

export const isUnauthorized = (err: unknown): boolean =>
  axios.isAxiosError(err) && err.response?.status === 401;

export type { StravaActivity };
