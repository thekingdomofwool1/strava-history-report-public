/**
 * Throwaway harness for the nearest-town fallback.
 *
 *   cd backend
 *   npx ts-node --transpile-only scripts/try-town.ts
 *
 * It calls chooseNearestTown() directly on hardcoded coordinates and prints the
 * resolved town + verified Wikipedia URL. No Strava, no database, no Docker —
 * it only reaches Overpass (OpenStreetMap) and Wikipedia/Wikidata.
 *
 * config.ts validates a handful of Strava env vars at import time, so we fill in
 * harmless dummies first, then require() the service (require, not a static
 * import, so the env is set before config loads).
 */
const DUMMY_ENV: Record<string, string> = {
  DATABASE_URL: 'file:./dev.db',
  STRAVA_CLIENT_ID: 'dummy',
  STRAVA_CLIENT_SECRET: 'dummy',
  STRAVA_REDIRECT_URI: 'http://localhost:4000/auth/strava/callback',
  STRAVA_WEBHOOK_VERIFY_TOKEN: 'dummy',
  STRAVA_WEBHOOK_CALLBACK_URL: 'http://localhost:4000/webhook/strava'
};
for (const [key, value] of Object.entries(DUMMY_ENV)) {
  if (!process.env[key]) process.env[key] = value;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chooseNearestTown } = require('../src/services/town') as typeof import('../src/services/town');
type RoutePoint = import('../src/services/town').RoutePoint;

const cases: { label: string; point: RoutePoint }[] = [
  { label: 'Rural CO (US-285 corridor)', point: { lat: 39.4017, lng: -105.4842 } },
  { label: 'Downtown Denver', point: { lat: 39.7392, lng: -104.9903 } },
  { label: 'Remote high country (Sawatch Range)', point: { lat: 39.119, lng: -106.4453 } },
  { label: 'Rural farmland (central Kansas)', point: { lat: 38.5, lng: -98.5 } }
];

const main = async (): Promise<void> => {
  for (const { label, point } of cases) {
    process.stdout.write(`\n${label} (${point.lat}, ${point.lng})\n`);
    try {
      const town = await chooseNearestTown([point]);
      if (town) {
        console.log(`  town:    ${town.townName} (${(town.distance / 1000).toFixed(1)} km away)`);
        console.log(`  article: ${town.articleTitle}`);
        console.log(`  url:     ${town.articleUrl}`);
      } else {
        console.log('  → no town/article resolved');
      }
    } catch (err) {
      console.log(`  → error: ${(err as Error).message}`);
    }
  }
};

main();
