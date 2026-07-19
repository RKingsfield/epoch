import { ConfigService } from '@nestjs/config';
import { Counter } from 'prom-client';
import { GenerationService } from './generation.service';
import { LastfmService } from '../lastfm/lastfm.service';
import { SpotifyService } from '../spotify/spotify.service';
import { AurralService } from '../aurral/aurral.service';
import { PlaylistsService } from '../playlists/playlists.service';
import { PeriodGenerator, PeriodSpec } from './period-generator';
import { LastfmSessionData } from '../session/session.types';
import { SpotifyTokenContext } from '../spotify/spotify-token.context';

const session: LastfmSessionData = { name: 'testuser', key: 'k' };
const ctx = {
  get: () => ({}),
  set: async () => {},
} as unknown as SpotifyTokenContext;

const tracks = Array.from({ length: 20 }, (_, i) => ({
  artist: `Artist ${i}`,
  title: `Track ${i}`,
}));

function spec(overrides: Partial<PeriodSpec> = {}): PeriodSpec {
  return {
    period: 'yearly',
    periodKey: '2019',
    title: 'Top of 2019',
    tracks,
    ...overrides,
  };
}

function counter() {
  return { inc: jest.fn() } as unknown as Counter<string>;
}

function makeService(opts: {
  specs?: PeriodSpec[] | Error;
  existingPlaylists?: Array<{ id: string; name: string }>;
  hasRecord?: boolean;
  findTrackId?: (artist: string, title: string) => string | null;
}) {
  const config = {
    getOrThrow: (key: string) =>
      ({ MIN_LASTFM_TRACKS: '5', MIN_TRACKS_FOR_PLAYLIST: '10' })[key],
  } as unknown as ConfigService;
  const lastfm = {
    getUserData: jest.fn().mockResolvedValue({ registered: '1500000000' }),
  } as unknown as LastfmService;
  const spotify = {
    getMyPlaylists: jest.fn().mockResolvedValue(opts.existingPlaylists ?? []),
    findTrackId: jest.fn((_ctx, artist: string, title: string) =>
      Promise.resolve(
        opts.findTrackId ? opts.findTrackId(artist, title) : `id-${title}`,
      ),
    ),
    createPlaylist: jest.fn().mockResolvedValue({ spotifyPlaylistId: 'sp-1' }),
  };
  const aurral = {
    enabled: () => false,
    export: jest.fn(),
  } as unknown as AurralService;
  const playlists = {
    record: jest.fn().mockResolvedValue({}),
    hasRecord: jest.fn().mockResolvedValue(opts.hasRecord ?? true),
  };
  const generator: PeriodGenerator = {
    period: 'yearly',
    label: 'yearly',
    specs:
      opts.specs instanceof Error
        ? jest.fn().mockRejectedValue(opts.specs)
        : jest.fn().mockResolvedValue(opts.specs ?? [spec()]),
  };
  const service = new GenerationService(
    config,
    lastfm,
    spotify as unknown as SpotifyService,
    aurral,
    playlists as unknown as PlaylistsService,
    [generator],
    counter(),
    counter(),
    counter(),
    counter(),
  );
  return { service, spotify, playlists };
}

describe('GenerationService', () => {
  it('creates and records a playlist when enough tracks match', async () => {
    const { service, playlists } = makeService({});
    const summary = await service.generate(session, ctx);
    expect(summary.created).toEqual([{ title: 'Top of 2019', tracks: 20 }]);
    expect(playlists.record).toHaveBeenCalledWith(
      expect.objectContaining({
        spotifyPlaylistId: 'sp-1',
        userId: 'testuser',
      }),
    );
  });

  it('reports a generator failure as gather_error, not insufficient_scrobbles', async () => {
    const { service } = makeService({ specs: new Error('lastfm 500') });
    const summary = await service.generate(session, ctx);
    expect(summary.skipped).toEqual([
      { title: 'yearly', reason: 'gather_error', detail: 'lastfm 500' },
    ]);
  });

  it('skips existing playlists without touching Spotify or the DB', async () => {
    const { service, spotify, playlists } = makeService({
      existingPlaylists: [{ id: 'sp-old', name: 'Top of 2019' }],
      hasRecord: true,
    });
    const summary = await service.generate(session, ctx);
    expect(summary.skipped[0].reason).toBe('already_exists');
    expect(spotify.createPlaylist).not.toHaveBeenCalled();
    expect(playlists.record).not.toHaveBeenCalled();
  });

  it('restores a missing DB record for a playlist that exists on Spotify', async () => {
    const { service, spotify, playlists } = makeService({
      existingPlaylists: [{ id: 'sp-old', name: 'Top of 2019' }],
      hasRecord: false,
    });
    const summary = await service.generate(session, ctx);
    expect(summary.skipped[0]).toEqual({
      title: 'Top of 2019',
      reason: 'already_exists',
      detail: 'restored missing record',
    });
    expect(spotify.createPlaylist).not.toHaveBeenCalled();
    expect(playlists.record).toHaveBeenCalledWith(
      expect.objectContaining({ spotifyPlaylistId: 'sp-old' }),
    );
  });

  it('skips periods with too few scrobbles', async () => {
    const { service } = makeService({
      specs: [spec({ tracks: tracks.slice(0, 3) })],
    });
    const summary = await service.generate(session, ctx);
    expect(summary.skipped[0].reason).toBe('insufficient_scrobbles');
  });

  it('skips periods with too few Spotify matches', async () => {
    const { service, playlists } = makeService({
      findTrackId: (_a, title) => (title === 'Track 0' ? 'id-0' : null),
    });
    const summary = await service.generate(session, ctx);
    expect(summary.skipped[0].reason).toBe('insufficient_matches');
    expect(playlists.record).not.toHaveBeenCalled();
  });
});
