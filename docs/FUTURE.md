# Future plans

## Multi-adapter music services

epoch is Spotify-only right now. Search, playlist creation, track matching, and OAuth are all wired directly to Spotify. The plan is to introduce a `MusicServiceProvider` interface that abstracts the music service layer, so adapters can be written for other services without touching generation or playlist management.

### Navidrome

This is the adapter I want to build first, and the main reason for doing multi-adapter at all. Navidrome exposes a Subsonic-compatible API with playlist creation and track search. An adapter would let epoch create playlists directly in a Navidrome library, no Spotify account needed. The listening data still comes from Last.fm; only the output destination changes.

### Aurral integration

epoch already exports track selections as JSON files that Aurral reads. A tighter integration could make sense: epoch triggers Aurral downloads directly, or Aurral reports back which tracks it successfully acquired so epoch can update match status. Whether the coupling is worth it is an open question. The current file-based handoff is simple and works fine.

### Other services

With the adapter interface in place, Apple Music, Tidal, Deezer, and others become possible. None of these are planned, but the interface should make them straightforward to add.

## Decided against

**Proper route parameters.** `/job/?id=...` and `/playlist/?id=...` are already linkable and bookmarkable. Moving to `/job/:id` would mean dropping the static export and running a Next server alongside NestJS: a deployment-model change for cosmetic URLs. Not worth it. Revisit only if an SSR need appears.
