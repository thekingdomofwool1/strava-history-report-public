import express from 'express';
import { config } from './config';
import authRouter from './routes/auth';
import webhookRouter from './routes/webhook';
import { ensureStravaWebhookSubscription } from './services/webhookSubscription';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/auth/strava', authRouter);
app.use('/webhook/strava', webhookRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const start = () => {
  app.listen(config.port, () => {
    console.log(`API listening on port ${config.port}`);
    ensureStravaWebhookSubscription().catch((err) => {
      console.error('Failed to ensure Strava webhook subscription', err);
    });
  });
};

start();
