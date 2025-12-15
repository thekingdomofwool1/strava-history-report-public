import polyline from '@mapbox/polyline';
import { prisma } from '../lib/prisma';
import { chooseHistoricPlace } from './places';
import { craftHistoricalBlurb } from './llm';
import { getActivity, refreshAccessToken, updateActivityDescription, StravaActivity } from './strava';

const fallbackMessage = "On today's run I passed a local landmark worth revisiting.";
const reportPrefix = '--My noteworthy historical report-- ';

type ProcessInput = {
  activityId: number;
  ownerId: string;
};

const ensureActivity = async (stravaId: string, userId: number) => {
  return prisma.activity.upsert({
    where: { stravaActivityId: stravaId },
    update: {},
    create: { stravaActivityId: stravaId, userId }
  });
};

const extractPoints = (activity: StravaActivity) => {
  const coords = activity.map?.summary_polyline
    ? polyline.decode(activity.map.summary_polyline).map(([lat, lng]) => ({ lat, lng }))
    : [];

  if (coords.length === 0 && activity.start_latlng) {
    coords.push({ lat: activity.start_latlng[0], lng: activity.start_latlng[1] });
  }

  if (coords.length < 2) {
    return null;
  }

  const start = activity.start_latlng
    ? { lat: activity.start_latlng[0], lng: activity.start_latlng[1] }
    : coords[0];
  const mid = coords[Math.floor(coords.length / 2)];
  const end = coords[coords.length - 1];
  return [start, mid, end];
};

export const processActivity = async ({ activityId, ownerId }: ProcessInput) => {
  console.log(`Processing activity ${activityId} for owner ${ownerId}`);
  const user = await prisma.user.findUnique({ where: { stravaAthleteId: ownerId } });
  if (!user) {
    console.warn(`No local user found for Strava athlete ${ownerId}`);
    return;
  }

  const stravaActivityId = activityId.toString();
  const existing = await prisma.activity.findUnique({ where: { stravaActivityId } });
  if (existing?.processed) {
    console.log(`Activity ${activityId} already processed, skipping`);
    return;
  }

  const ensured = await ensureActivity(stravaActivityId, user.id);
  console.log(`Ensured activity record ${ensured.id} for Strava activity ${activityId}`);
  const authedUser = await refreshAccessToken(user.id);
  const activity = await getActivity(authedUser, activityId);
  console.log(`Fetched activity ${activityId} (${activity.name}) of type ${activity.type}`);

  const points = extractPoints(activity);
  if (!points) {
    console.warn(`Activity ${activityId} missing GPS data`);
    await prisma.activity.update({
      where: { id: ensured.id },
      data: { processed: true, processedAt: new Date(), oneLiner: 'Route missing GPS data.' }
    });
    return;
  }

  const place = await chooseHistoricPlace(points);
  console.log(`Place selection for activity ${activityId}`, place ? place.name : 'none found');
  let blurb = `${reportPrefix}${fallbackMessage}`;
  let placeName: string | null = null;

  if (place) {
    const crafted = await craftHistoricalBlurb(place, activity.name);
    blurb = `${reportPrefix}${crafted}`;
    placeName = place.name;
    console.log(`Generated historical blurb for activity ${activityId}`, blurb);
  }

  const existingDescription = activity.description ?? '';
  const newDescription = existingDescription.includes(blurb)
    ? existingDescription
    : `${existingDescription ? `${existingDescription}\n\n` : ''}${blurb}`;

  try {
    await updateActivityDescription(authedUser, activityId, newDescription);
    console.log(`Updated Strava activity ${activityId} description`);
  } catch (err) {
    console.error(`Failed to update Strava activity ${activityId}`, err);
    throw err;
  }

  await prisma.activity.update({
    where: { id: ensured.id },
    data: {
      processed: true,
      processedAt: new Date(),
      oneLiner: blurb,
      placeName
    }
  });
  console.log(`Marked activity ${activityId} as processed`);
};
