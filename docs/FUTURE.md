# Future plans

## Multi-adapter music services

epoch is Spotify-only right now. Search, playlist creation, track matching, and OAuth are all wired directly to Spotify. The plan is to introduce a `MusicServiceProvider` interface that abstracts the music service layer, so adapters can be written for other services without touching generation or playlist management.

### Navidrome

This is the adapter I want to build first, and the main reason for doing multi-adapter at all. Navidrome exposes a Subsonic-compatible API with playlist creation and track search. An adapter would let epoch create playlists directly in a Navidrome library, no Spotify account needed. The listening data still comes from Last.fm; only the output destination changes.

### Aurral integration

epoch already exports track selections as JSON files that Aurral reads. A tighter integration could make sense: epoch triggers Aurral downloads directly, or Aurral reports back which tracks it successfully acquired so epoch can update match status. Whether the coupling is worth it is an open question. The current file-based handoff is simple and works fine.

### Other services

With the adapter interface in place, Apple Music, Tidal, Deezer, and others become possible. None of these are planned, but the interface should make them straightforward to add.

## UI and UX

**Show the current match in the rematch modal.** Right now you search for a replacement but can't see what you're replacing without going back to the playlist view. Needs a `GET /api/v1/spotify/tracks/:id` endpoint and a fixed row at the top of the modal.

**Cancel a running job.** There's no way to stop a generation once it starts. Needs `DELETE /jobs/:id` on the backend (BullMQ supports `job.remove()` and `discard()`) and a cancel button on the job page.

**SSE for job progress.** The job page polls on a 1.5s to 5s backoff. Server-sent events would be more responsive and use fewer requests. BullMQ already emits progress events internally, so the backend work is mostly wiring.

**Proper route parameters.** `/job/?id=...` and `/playlist/?id=...` work but aren't great for sharing or bookmarking. Moving to `/job/:id` and `/playlist/:id` means dropping the static export and adding minimal SSR. Not hard, but it changes the deployment model.

## Housekeeping

**Self-host fonts.** Orbitron and JetBrains Mono load from Google Fonts. Move to `next/font/local` with files in `frontend/public/fonts/` so the app works fully offline.
