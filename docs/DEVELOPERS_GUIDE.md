# Developer's guide

## Quick start

You need Docker and Docker Compose.

```bash
cp .env.dist .env
# Fill in your API keys — see Configuration below

docker compose -f docker-compose.dev.yml up
```

Open http://localhost:5342, connect your Last.fm and Spotify accounts, and generate some playlists.

In your Spotify developer dashboard, add `http://localhost:5342/spotify/callback` as an allowed redirect URI.

## Configuration

| Env var | Required | Default | Notes |
|---|---|---|---|
| `LASTFM_API_KEY` | yes | — | from last.fm/api |
| `LASTFM_SHARED_SECRET` | yes | — | from last.fm/api |
| `SPOTIFY_CLIENT_ID` | yes | — | from developer.spotify.com |
| `SPOTIFY_CLIENT_SECRET` | yes | — | from developer.spotify.com |
| `SESSION_SECRET` | yes | — | 32+ random bytes (`openssl rand -hex 32`) |
| `PUBLIC_URL` | yes in prod | `http://localhost:5342` | External URL for OAuth callbacks |
| `MONGODB_URI` | yes | — | Full `mongodb://` URI with auth |
| `REDIS_URL` | no | `redis://redis:6379` | Shared by sessions and BullMQ |
| `PORT` | no | `5342` | HTTP listen port |
| `AURRAL_EXPORT_DIR` | no | unset | Set to enable Aurral JSON export |
| `SEASONS_HEMISPHERE` | no | `north` | `north` or `south`, same dates, swapped season names |

## Development

```bash
npm install
npm run start:dev   # watch mode, talks to mongo+redis from docker-compose.dev.yml
npm run build       # TypeScript compile via nest build
npm test            # jest
npm run lint        # eslint --fix
```

Frontend (Next.js 15, static export):

```bash
cd frontend
npm install
npm run dev         # :3000, proxies API calls to :5342
npm run build       # static export → frontend/out/
```

The built frontend is served by the NestJS process in production. During development, the Next.js dev server runs separately on port 3000.

## Adding a new playlist period

1. Create a new file in `src/generation/generators/` implementing `PeriodGenerator`
2. Add it to `GenerationModule`'s providers and the `PERIOD_GENERATORS` factory's inject list
3. Add the period name to the enum in `src/playlists/schemas/playlist.schema.ts`
4. Optionally, add a display label in the frontend's `PERIOD_LABEL` map

The generation service discovers generators through dependency injection. Everything else (job processing, playlist storage, the API) works with whatever periods the generators produce.

## Deployment

The Dockerfile is a multi-stage build:

1. `frontend` — builds the Next.js static export
2. `base` — installs dependencies and compiles TypeScript
3. `test` — runs the test suite (use as a CI gate: `docker build --target test`)
4. `production` — minimal runtime image with non-root `node` user and healthcheck

```bash
# Build and run with Docker Compose
docker compose up -d

# Or build the image directly
docker build -t epoch:latest .
```

The production `docker-compose.yml` expects a `.env` file with your API keys and secrets. See `.env.dist` for the template.

For CI/CD, the test stage gates deploys: `docker build --target test` fails the build if any test fails. Wire this into your CI provider and push the production image to your registry.
