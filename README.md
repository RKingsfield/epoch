# epoch

Turn your Last.fm listening history into Spotify playlists, sliced by year, season, and month.

![epoch screenshot](docs/screenshot.png)

## What is this?

If you've been scrobbling to Last.fm for years, you're sitting on a detailed record of everything you've listened to. epoch reads that history and builds "Top of ..." Spotify playlists from it — one for each year, season, and month where you had enough plays to make a meaningful list.

Connect your Last.fm and Spotify accounts, hit generate, and come back to a library full of playlists like "Top of Summer 2019" or "Top of March 2022." The generation runs in the background, so you can close the tab and check back later.

When Spotify picks the wrong version of a track (live recording instead of the studio cut, the wrong remaster), you can fix the match through the UI. That correction sticks: it applies across every playlist where that track appears, and future generations use the corrected match automatically.

## How it works

epoch asks Last.fm for your top tracks in each time window, then searches Spotify for each one. It skips periods where you didn't listen to enough music or where too few tracks had Spotify matches. Playlists that already exist get left alone, so re-running is safe.

For self-hosted music setups, epoch can optionally export the same track selections as JSON files that [Aurral](https://github.com/lklynet/aurral) understands, routing them through Lidarr and Soulseek into Navidrome.

## Documentation

| Doc | What's in it |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | System design, module layout, API reference |
| [Design decisions](docs/DESIGN.md) | Why it's built this way |
| [Developer's guide](docs/DEVELOPERS_GUIDE.md) | Setup, configuration, deployment |
| [Future plans](docs/FUTURE.md) | What's next |

## License

MIT — see [LICENSE](LICENSE).
