# Design decisions

How epoch is structured is in [Architecture](ARCHITECTURE.md). This doc is about why.

## Last.fm as the data source

Last.fm has the longest-running scrobble history of any music tracking service. Some users have data going back to 2005. Its API lets you query top tracks for arbitrary date ranges, which is exactly what epoch needs. The scrobble data is the source of truth; Spotify is just the output format (for now).

## Background generation with BullMQ

A full generation run hits Last.fm for every year, season, and month in your listening history, then searches Spotify for each track. That's hundreds of API calls and can take several minutes. Running it synchronously would time out.

BullMQ handles the queue. The frontend polls for progress with backoff from 1.5s to 5s. Not elegant, but simple and reliable. SSE is an option if polling becomes a problem.

## MongoDB for playlists and tracks

Playlist and track data is document-shaped. A playlist has a list of tracks, each with Last.fm metadata and a Spotify match. This maps naturally to Mongo documents. There's no relational structure that would benefit from SQL.

## Redis pulls double duty

Redis was already needed for BullMQ. Using it for sessions too means one fewer service to run. Sessions are HttpOnly + SameSite cookies with a 30-day TTL.

## Static export for the frontend

The frontend is a Next.js static export. No server-side rendering, no Next.js API routes. NestJS handles everything on the backend.

The tradeoff: no dynamic route segments like `/playlist/[id]`. Those need SSR. epoch uses query strings instead (`/playlist/?id=...`). Worse URLs, simpler deployment. The frontend is just static files served by the NestJS process.

## Rate limiting with Bottleneck

Spotify enforces rate limits aggressively. epoch uses Bottleneck to cap requests at 4 concurrent with a 100ms delay and 50 requests per 5-second window. When Spotify returns 429 with `Retry-After`, epoch respects it.

The `SpotifyHttpClient` also handles token refresh preemptively (within 60s of expiry) and retries once on 401. Call sites don't need to think about auth.

## The PeriodGenerator interface

Period types (yearly, seasonal, monthly) are pluggable. Each is a class implementing `PeriodGenerator` in `src/generation/generators/`. The generation service iterates over all registered generators without knowing what periods they produce. Adding a new period type means one new file and a module registration.

## Canonical rematches

When you fix a mismatched track through the UI, the correction does three things:

1. Updates the track on Spotify and in the database for that playlist
2. Writes a `manualOverride: true` entry to the global track cache, so future generations use this match instead of searching Spotify again
3. Fans out to every other playlist where the same Last.fm track appears and updates those too

Fan-out skips playlists that already have the correct match and playlists where a different manual choice was made. Failures during fan-out are logged but don't fail the request. The canonical cache entry means the next generation picks it up regardless.

## Hemisphere-aware seasons

"Summer 2020" means June through August in the northern hemisphere but December through February in the south. The `SEASONS_HEMISPHERE` env var controls which mapping to use. Same date ranges, swapped names.

## Aurral export is opt-in

When `AURRAL_EXPORT_DIR` is set, each generated playlist gets written as JSON that Aurral can read. This feeds into a Lidarr/Soulseek/Navidrome pipeline for self-hosted music. When the env var isn't set, the feature doesn't load.
