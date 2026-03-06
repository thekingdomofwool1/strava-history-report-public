import crypto from 'crypto';
import { Router, type Request } from 'express';
import { config } from '../config';
import { processActivity } from '../services/activityProcessor';

const router = Router();

const signatureMatches = (req: Request) => {
  const header = req.get('X-Strava-Signature');
  if (!header) {
    if (process.env.ALLOW_UNSIGNED_STRAVA_WEBHOOKS === 'true') {
      console.warn('ALLOW_UNSIGNED_STRAVA_WEBHOOKS is set; accepting payload without X-Strava-Signature (unsafe for production)');
      return true;
    }
    console.warn('X-Strava-Signature header missing; rejecting webhook');
    return false;
  }
  if (!req.rawBody) {
    console.warn('Raw body missing while verifying Strava signature');
    return false;
  }

  const incoming = header.trim().startsWith('sha256=') ? header.trim().slice(7) : header.trim();
  const expected = crypto
    .createHmac('sha256', config.strava.clientSecret)
    .update(req.rawBody)
    .digest('hex');

  const incomingBuf = Buffer.from(incoming, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (incomingBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(incomingBuf, expectedBuf);
};

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
  console.log('Incoming Strava webhook signature header', req.headers['x-strava-signature']);
  if (!signatureMatches(req)) {
    console.warn('Rejected Strava webhook due to invalid signature');
    return res.status(403).send('Invalid signature');
  }

  const event = req.body;
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
    processActivity({ activityId: event.object_id, ownerId: event.owner_id.toString() }).catch((err) => {
      console.error('Failed to process activity', err);
    });
  } else {
    console.log('Ignoring unsupported Strava webhook payload', event);
  }
  res.status(200).json({ received: true });
});

export default router;
