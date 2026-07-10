# Architecture

## Overview

```
                  ┌─ NestJS API ──────────────────────────┐
  Browser ─────►  │  /api/v1/status  POST /api/v1/jobs/gen │
                  │  /api/v1/playlists    /api/v1/jobs/:id│  ───►  Last.fm API
                  │  /spotify/...    GET  /metrics        │  ───►  Spotify API
                  │  /lastfm/...     GET  /health         │
                  └───┬──────────────────┬───┬────────────┘
                      │                  │   │
                      ▼                  ▼   ▼
            ┌─────────────┐      ┌──────┐ ┌───────┐
            │  BullMQ     │ ◄──► │ Mongo│ │ Redis │
            │  worker     │      │      │ │       │
            └─────────────┘      └──────┘ └───────┘
                Generation       Playlists Sessions +
                runs here        + tracks   job queue
```

## Stack

| Layer | Tech |
|---|---|
| API | NestJS 10, BullMQ, Mongoose |
| Frontend | Next.js 15, React 19, Tailwind v4 (static export) |
| Storage | MongoDB (playlists and tracks), Redis (sessions and job queue) |
| Logs | Pino via nestjs-pino |
| Metrics | prom-client at `/metrics` |
| Rate limiting | Bottleneck (4 concurrent, 100ms delay, 50 requests per 5s) with `Retry-After` support |

## Module layout

```
src/
├── app.{controller,service,module}.ts   status endpoint + /health
├── lastfm/                              API client and OAuth callback
├── spotify/                             API client, OAuth, token refresh, search
├── session/                             Redis-backed sessions (HttpOnly + SameSite, 30-day TTL)
├── aurral/                              optional JSON exporter
├── playlists/                           Mongo schemas, service, controller (including rematch)
├── generation/
│   ├── generation.service.ts            orchestrator: iterates injected PeriodGenerators
│   ├── period-generator.ts              interface for period types
│   └── generators/{yearly,seasonal,monthly}.generator.ts
├── jobs/                                BullMQ queue, processor, status endpoints
├── metrics/                             Prometheus counters
└── utils/seasons.ts                     hemisphere-aware season boundaries

frontend/
├── app/                                 App Router (all client components)
├── components/
└── lib/                                 API client, hooks, state helpers
```

## API reference

All paths under `/api/v1/` unless noted. OAuth callbacks stay at root because the redirect URIs are registered with Spotify and Last.fm.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness check, returns `{status:"ok"}` |
| GET | `/metrics` | Prometheus exposition |
| GET | `/api/v1/status` | Session state and login URLs |
| GET | `/lastfm/callback` | OAuth redirect (root path) |
| GET | `/spotify/callback` | OAuth redirect (root path) |
| GET | `/api/v1/spotify/search?q=&limit=` | Spotify search for the rematch modal |
| POST | `/api/v1/jobs/generate` | Start a generation job, returns `{jobId, statusUrl}` |
| GET | `/api/v1/jobs` | Last 50 jobs |
| GET | `/api/v1/jobs/:id` | Job state, progress, and result |
| GET | `/api/v1/playlists` | Current user's playlists |
| GET | `/api/v1/playlists/:id` | Single playlist with full track list |
| PUT | `/api/v1/playlists/:id/tracks/:position` | Rematch a track (body: `{spotifyTrackId}`) |

## Observability

`/health` is used by the Dockerfile's `HEALTHCHECK` (node http.get every 30s).

`/metrics` exposes default node/process metrics plus:

- `epoch_playlists_created_total{period}`
- `epoch_playlists_skipped_total{reason}` — `already_exists`, `insufficient_scrobbles`, `insufficient_matches`
- `epoch_tracks_matched_total` / `epoch_tracks_unmatched_total`
- `epoch_jobs_completed_total` / `epoch_jobs_failed_total`

Logs go through Pino. Pretty-printed in dev, JSON in prod. Auth headers and cookies are redacted.
