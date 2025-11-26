import axios from 'axios';
import { config } from '../config';

const STRAVA_API = 'https://www.strava.com/api/v3';

type WebhookSubscription = {
  id: number;
  callback_url: string;
};

const listSubscriptions = async (): Promise<WebhookSubscription[]> => {
  const { data } = await axios.get<WebhookSubscription[]>(`${STRAVA_API}/push_subscriptions`, {
    params: {
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret
    }
  });
  return data;
};

const deleteSubscription = async (id: number) => {
  await axios.delete(`${STRAVA_API}/push_subscriptions/${id}`, {
    params: {
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret
    }
  });
};

const createSubscription = async (): Promise<WebhookSubscription> => {
  const params = new URLSearchParams({
    client_id: config.strava.clientId,
    client_secret: config.strava.clientSecret,
    callback_url: config.strava.webhookCallbackUrl,
    verify_token: config.strava.webhookVerifyToken
  });

  try {
    const { data } = await axios.post<WebhookSubscription>(`${STRAVA_API}/push_subscriptions`, params);
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      console.error(
        'Strava push subscription creation failed',
        err.response.status,
        JSON.stringify(err.response.data)
      );
    }
    throw err;
  }
};

export const ensureStravaWebhookSubscription = async () => {
  const subscriptions = await listSubscriptions();
  const match = subscriptions.find((sub) => sub.callback_url === config.strava.webhookCallbackUrl);
  if (match) {
    return match;
  }

  if (subscriptions.length > 0) {
    console.warn(
      `Deleting ${subscriptions.length} existing Strava webhook subscription(s) to align with callback ${config.strava.webhookCallbackUrl}`
    );
    for (const sub of subscriptions) {
      await deleteSubscription(sub.id);
    }
  }

  const created = await createSubscription();
  console.log(`Created Strava webhook subscription ${created.id}`);
  return created;
};
