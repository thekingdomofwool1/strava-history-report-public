# Claude Code Notes

## Git Remotes

The public repo is the only one that matters now. Push there:

```bash
git push https://github.com/thekingdomofwool1/strava-history-report-public.git master
```

GitHub Pages serves from this public repo: https://github.com/thekingdomofwool1/strava-history-report-public

The legacy `origin` and `all` remotes still point at the old private repo; do not push to them — the private repo is no longer maintained.

## Architecture

- **Frontend**: Jekyll static site in `docs/`, hosted on GitHub Pages at `stravafacts.andvos.xyz`
- **Backend**: Express/Node app in `backend/`, running in Docker on a DigitalOcean droplet
- **API subdomain**: `api.andvos.xyz` → Cloudflare Tunnel → `http://localhost:4000`
- **Database**: SQLite via Prisma, persisted in a Docker volume (`backend_db`)

## Server Config

Live config files (gitignored) are in `config-files-for-server/`. Copy to the server when updating.

After changing `backend.env` on the server, restart with:
```bash
docker compose up -d --force-recreate backend
```
