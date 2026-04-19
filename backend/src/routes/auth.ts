import { Router } from 'express';
import { buildAuthUrl, exchangeToken } from '../services/strava';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { createStateToken, verifyStateToken } from '../lib/state';

const router = Router();

router.get('/start', (_req, res) => {
  const state = createStateToken();
  res.redirect(buildAuthUrl(state));
});

router.get('/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing code' });
    }

    if (!state || typeof state !== 'string' || !verifyStateToken(state)) {
      return res.status(400).json({ error: 'Invalid state' });
    }

    const tokenData = await exchangeToken(code);
    const athleteId = tokenData.athlete.id.toString();

    await prisma.user.upsert({
      where: { stravaAthleteId: athleteId },
      create: {
        stravaAthleteId: athleteId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: new Date(tokenData.expires_at * 1000)
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: new Date(tokenData.expires_at * 1000)
      }
    });

    res.redirect(`${config.baseAppUrl}?connected=1&athlete=${athleteId}`);
  } catch (err) {
    next(err);
  }
});

router.get('/status/:athleteId', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const user = await prisma.user.findUnique({ where: { stravaAthleteId: req.params.athleteId } });
  res.json({ connected: !!user });
});

export default router;
