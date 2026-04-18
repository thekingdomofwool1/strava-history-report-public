import polyline from '@mapbox/polyline';
import { prisma } from '../lib/prisma';
import { chooseHistoricPlace } from './places';
import { getActivity, refreshAccessToken, updateActivityDescription, StravaActivity } from './strava';

const reportPrefix = '--My noteworthy historical report-- ';

const ACTIVITY_LABELS: Record<string, string> = {
  Run: 'run',
  TrailRun: 'trail run',
  VirtualRun: 'virtual run',
  Ride: 'bike ride',
  MountainBikeRide: 'mountain bike ride',
  GravelRide: 'gravel ride',
  EBikeRide: 'e-bike ride',
  EMountainBikeRide: 'e-bike ride',
  VirtualRide: 'virtual ride',
  Hike: 'hike',
  Walk: 'walk',
  Swim: 'swim',
  Kayaking: 'kayak',
  Rowing: 'row',
  NordicSki: 'ski',
  AlpineSki: 'ski',
  Workout: 'workout',
  Yoga: 'yoga session'
};

const getActivityLabel = (activity: { type: string; sport_type?: string }): string =>
  ACTIVITY_LABELS[activity.sport_type ?? ''] ?? ACTIVITY_LABELS[activity.type] ?? 'activity';

const buildWikipediaNote = (place: { title: string; articleUrl: string }, activityLabel: string) =>
  `On today's ${activityLabel} I passed by ${place.title}. Read about it here: ${place.articleUrl}`;

const buildFallbackMessage = (activityLabel: string) =>
  `On today's ${activityLabel} I passed a local landmark worth revisiting.`;

type ProcessInput = {
  activityId: number;
  ownerId: string;
  isUpdate?: boolean;
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

export const processActivity = async ({ activityId, ownerId, isUpdate }: ProcessInput) => {
  console.log(`Processing activity ${activityId} for owner ${ownerId}`);
  const user = await prisma.user.findUnique({ where: { stravaAthleteId: ownerId } });
  if (!user) {
    console.warn(`No local user found for Strava athlete ${ownerId}`);
    return;
  }

  const stravaActivityId = activityId.toString();
  const existing = await prisma.activity.findUnique({ where: { stravaActivityId } });
  if (existing?.processed) {
    if (isUpdate && existing.oneLiner) {
      const authedUser = await refreshAccessToken(user.id);
      const activity = await getActivity(authedUser, activityId);
      const currentDescription = activity.description ?? '';
      if (!currentDescription.includes(existing.oneLiner)) {
        console.log(`Blurb missing from activity ${activityId} after update, restoring`);
        const newDescription = currentDescription
          ? `${currentDescription}\n\n${existing.oneLiner}`
          : existing.oneLiner;
        await updateActivityDescription(authedUser, activityId, newDescription);
        console.log(`Restored blurb on activity ${activityId}`);
      }
    } else {
      console.log(`Activity ${activityId} already processed, skipping`);
    }
    return;
  }

  const ensured = await ensureActivity(stravaActivityId, user.id);
  console.log(`Ensured activity record ${ensured.id} for Strava activity ${activityId}`);
  const authedUser = await refreshAccessToken(user.id);
  const activity = await getActivity(authedUser, activityId);
  console.log(`Fetched activity ${activityId} (${activity.name}) of type ${activity.type}`);

  const activityLabel = getActivityLabel(activity);

  const points = extractPoints(activity);
  if (!points) {
    console.warn(`Activity ${activityId} missing GPS data`);
    await prisma.activity.update({
      where: { id: ensured.id },
      data: { processed: true, processedAt: new Date(), oneLiner: 'Route missing GPS data.' }
    });
    return;
  }

  const usedPlaces = await prisma.usedPlace.findMany({ where: { userId: user.id }, select: { pageId: true } });
  const excludedPageIds = new Set(usedPlaces.map((p) => p.pageId));

  const place = await chooseHistoricPlace(points, excludedPageIds).catch((err) => {
    console.warn(`Wikipedia place lookup failed for activity ${activityId}, using fallback message`, err);
    return null;
  });
  console.log(`Place selection for activity ${activityId}`, place ? place.title : 'none found');
  let blurb = `${reportPrefix}${buildFallbackMessage(activityLabel)}`;
  let placeName: string | null = null;

  if (place) {
    blurb = `${reportPrefix}${buildWikipediaNote(place, activityLabel)}`;
    placeName = place.title;
    console.log(`Appended Wikipedia note for activity ${activityId}`, blurb);
  }

  const existingDescription = activity.description ?? '';
  const newDescription = existingDescription.includes(blurb)
    ? existingDescription
    : `${existingDescription ? `${existingDescription}\n\n` : ''}${blurb}`;

  try {
    await updateActivityDescription(authedUser, activityId, newDescription);
    console.log(`Updated Strava activity ${activityId} description`);
  } catch (err) {
    const status = (err as any)?.response?.status;
    const body = (err as any)?.response?.data;
    console.error(`Failed to update Strava activity ${activityId} (HTTP ${status ?? 'unknown'})`, body ?? err);
    throw err;
  }

  if (place) {
    await prisma.usedPlace.upsert({
      where: { userId_pageId: { userId: user.id, pageId: place.pageid } },
      update: {},
      create: { userId: user.id, pageId: place.pageid, placeName: place.title }
    });
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
