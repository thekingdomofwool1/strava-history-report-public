# Claude Code Notes

## Git Remotes

This repo pushes to two remotes:

- `origin` — private repo: https://github.com/thekingdomofwool1/strava-history-report
- `all` — pushes to both private and public repos simultaneously

When committing changes that should be public (anything in `docs/`, `backend/`, `.github/`), push with:

```bash
git push all master
```

The public repo is: https://github.com/thekingdomofwool1/strava-history-report-public
(This is what GitHub Pages serves from — it must stay in sync with the private repo.)

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
