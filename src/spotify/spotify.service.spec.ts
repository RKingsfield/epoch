import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { SpotifyService } from './spotify.service';
import { SpotifyHttpClient } from './spotify-http.client';
import { Track } from './tracks/schemas/track.schema';
import { SpotifyTokenContext } from './spotify-token.context';

const ctx = {
  get: () => ({}),
  set: async () => {},
} as unknown as SpotifyTokenContext;

const DAY_MS = 24 * 60 * 60 * 1000;

function makeService(cached: Partial<Track> | null, searchHit: string | null) {
  const config = {
    getOrThrow: jest.fn().mockReturnValue('30'),
  } as unknown as ConfigService;
  const client = {
    get: jest.fn().mockResolvedValue({
      tracks: { items: searchHit ? [{ id: searchHit }] : [] },
    }),
  };
  const trackModel = {
    findOne: jest.fn().mockResolvedValue(cached),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  const service = new SpotifyService(
    config,
    client as unknown as SpotifyHttpClient,
    trackModel as unknown as Model<Track>,
  );
  return { service, client, trackModel };
}

describe('SpotifyService.findTrackId', () => {
  it('returns a cached match without searching', async () => {
    const { service, client } = makeService({ spotifyId: 'cached-id' }, 'x');
    expect(await service.findTrackId(ctx, 'a', 't')).toBe('cached-id');
    expect(client.get).not.toHaveBeenCalled();
  });

  it('returns null for a fresh miss without searching', async () => {
    const { service, client } = makeService(
      { notFoundAt: new Date(Date.now() - DAY_MS) },
      'x',
    );
    expect(await service.findTrackId(ctx, 'a', 't')).toBeNull();
    expect(client.get).not.toHaveBeenCalled();
  });

  it('re-searches once a miss is older than the recheck window', async () => {
    const { service, client } = makeService(
      { notFoundAt: new Date(Date.now() - 31 * DAY_MS) },
      'new-id',
    );
    expect(await service.findTrackId(ctx, 'a', 't')).toBe('new-id');
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it('records a miss marker when search finds nothing', async () => {
    const { service, trackModel } = makeService(null, null);
    expect(await service.findTrackId(ctx, 'a', 't')).toBeNull();
    expect(trackModel.updateOne).toHaveBeenCalledWith(
      { artist: 'a', title: 't', manualOverride: { $ne: true } },
      { $set: expect.objectContaining({ notFoundAt: expect.any(Date) }) },
      { upsert: true },
    );
  });

  it('clears the miss marker when caching a hit', async () => {
    const { service, trackModel } = makeService(null, 'found-id');
    expect(await service.findTrackId(ctx, 'a', 't')).toBe('found-id');
    expect(trackModel.updateOne).toHaveBeenCalledWith(
      { artist: 'a', title: 't', manualOverride: { $ne: true } },
      {
        $set: { artist: 'a', title: 't', spotifyId: 'found-id' },
        $unset: { notFoundAt: 1 },
      },
      { upsert: true },
    );
  });
});
