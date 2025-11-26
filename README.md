# Strava History Report

This repo contains a TypeScript/Node backend plus a small React frontend that connect Strava runs to nearby historical landmarks and post a friendly fact back onto the activity description.

## Tech overview

- **Backend** – Express + Prisma (SQLite). Handles Strava OAuth, Strava webhook processing, Google Maps/Places lookup, OpenAI call, and activity updates.
- **Frontend** – Vite + React. Minimal UI with a “Connect Strava” CTA.
- **Docker** – Separate Dockerfiles for backend/frontend plus a `docker-compose.yml` for local multi-container development.

## Backend setup

1. Copy the example environment: `cp backend/.env.example backend/.env` and set:
   - `DATABASE_URL` (defaults to SQLite: `file:./dev.db`)
   - `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`
   - `STRAVA_WEBHOOK_VERIFY_TOKEN` – choose any secret and reuse it when registering the webhook on Strava.
   - `STRAVA_WEBHOOK_CALLBACK_URL` – the public HTTPS URL Strava should call (e.g. your ngrok tunnel + `/webhook/strava`).
   - `GOOGLE_MAPS_API_KEY`, `OPENAI_API_KEY`, optional `OPENAI_MODEL`, `GOOGLE_MAPS_RADIUS`, `BASE_APP_URL`.
2. Install dependencies and generate the Prisma client:
   ```bash
   cd backend
   npm install
   npx prisma migrate dev --name init
   ```
   (Use `npx prisma migrate deploy` in production containers.)
3. Run the API locally:
   ```bash
   npm run dev
   ```

### Strava webhook configuration

- Set your Strava API application redirect URI to the same `STRAVA_REDIRECT_URI` value.
- Deploy the backend or expose it via something like `ngrok`.
- Ensure `STRAVA_WEBHOOK_CALLBACK_URL` matches the publicly reachable `/webhook/strava` URL.
- On startup the backend calls Strava’s push-subscription API: it deletes any existing subscription for your app (if the callback differs) and creates one targeting `STRAVA_WEBHOOK_CALLBACK_URL`, automatically replying to the validation challenge.

When Strava sends an activity event, the backend:

1. Finds the user via Strava athlete ID.
2. Refreshes tokens if necessary.
3. Fetches the activity (only Run types are processed).
4. Decodes the polyline to sample start/middle/end points.
5. Looks up historical Places within a configurable radius.
6. Uses OpenAI to craft a short blurb and updates the activity description while recording the result in the `Activity` table.

## Frontend setup

1. Copy env: `cp frontend/.env.example frontend/.env` and update `VITE_API_BASE_URL` to the backend origin.
2. Install dependencies and run Vite:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Visit `http://localhost:5173` to hit the UI. The “Connect Strava” button sends users to `/auth/strava/start` on the backend.

## Docker & Docker Swarm

Secrets are managed via Docker Swarm, which lets the backend load its `.env` from `/run/secrets` instead of baking credentials into images.

1. Prepare secrets and env:
   ```bash
   cp backend/.env.example backend/.env    # update the real secrets
   cp frontend/.env.example frontend/.env  # set VITE_API_BASE_URL=http://backend:4000
   ```
2. Initialize Swarm (first time only): `docker swarm init`
3. Build the service images locally: `docker compose build`
4. Deploy the stack: `docker stack deploy -c docker-compose.yml strava-history`

The stack creates two services:

- **backend** (Docker secret `backend_env` mounted at `/app/.env`, listening on port 4000)
- **frontend** (receives the public port 5173 and proxies calls to `http://backend:4000`)

To remove the stack, run `docker stack rm strava-history`. If you need to update secrets, edit `backend/.env`, rebuild, and redeploy the stack so Swarm refreshes the secret mount.

## Useful scripts

Backend (`/backend`):
- `npm run dev` – ts-node-dev server with live reload.
- `npm run build` – compile TypeScript to `dist/`.
- `npm run start` – run the compiled server (requires pre-built `dist`).
- `npm run start:prod` – run Prisma migrations then start (used in Docker).
- `npm run prisma:migrate` – helper alias for `prisma migrate dev` (edit as needed).

Frontend (`/frontend`):
- `npm run dev` – Vite dev server.
- `npm run build` – production build in `dist/`.
- `npm run preview` – serve the production build (used in Docker container).

## Data model

Prisma schema defines two tables:

- `User`: Strava athlete credentials + metadata.
- `Activity`: Idempotency + storage for generated blurbs (including the chosen Place name).

SQLite is the default for simplicity; swapping to Postgres only requires changing `DATABASE_URL` and running a migration.

## Notes & next steps

- Implement your preferred secret storage for long-lived tokens in production.
- Use a Strava Event Queue (e.g., Redis/worker) if webhook volume increases; current implementation processes inline but already guards against duplicates.
- Extend the Places ranking heuristics or add caching if API usage becomes high.
- Add tests for the ranking + description generator if you iterate further.
