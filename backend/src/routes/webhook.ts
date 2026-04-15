import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { processActivity } from '../services/activityProcessor';

const router = Router();

router.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = req.query as Record<string, string>;

  if (mode === 'subscribe' && verifyToken === config.strava.webhookVerifyToken && challenge) {
    console.log('Strava webhook validation succeeded');
    return res.status(200).json({ 'hub.challenge': challenge });
  }

  console.warn('Strava webhook validation failed', { mode, verifyToken });
  return res.status(403).send('Forbidden');
});

router.post('/', async (req, res) => {
  const event = req.body;

  if (event.object_type === 'athlete' && event.aspect_type === 'delete' && typeof event.owner_id === 'number') {
    const ownerId = event.owner_id.toString();
    console.log(`Athlete deauthorization event for ${ownerId}; removing user data`);
    await prisma.user.deleteMany({ where: { stravaAthleteId: ownerId } });
    return res.status(200).json({ received: true });
  }

  if (
    event.object_type === 'activity' &&
    ['create', 'update'].includes(event.aspect_type) &&
    typeof event.object_id === 'number' &&
    typeof event.owner_id === 'number'
  ) {
    console.log('Received Strava webhook', {
      aspectType: event.aspect_type,
      objectId: event.object_id,
      ownerId: event.owner_id
    });
    processActivity({ activityId: event.object_id, ownerId: event.owner_id.toString(), isUpdate: event.aspect_type === 'update' }).catch((err) => {
      console.error('Failed to process activity', err);
    });
  } else {
    console.log('Ignoring unsupported Strava webhook payload', event);
  }
  res.status(200).json({ received: true });
});

export default router;
