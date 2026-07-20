import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { SpotifyService } from '../spotify/spotify.service';
import { AppSession } from '../session/session.types';

const spotifySession = {
  access_token: 'tok',
  refresh_token: 'ref',
  scope: 's',
  token_type: 'Bearer',
  expires_at: Date.now() + 3600_000,
};
const session = {
  lastfm: { name: 'testuser', key: 'k' },
  spotify: spotifySession,
} as AppSession;
const lastfmOnlySession = {
  lastfm: { name: 'testuser', key: 'k' },
} as AppSession;
const anonSession = {} as AppSession;

const playlistId = new Types.ObjectId();
const playlistDoc = {
  _id: playlistId,
  spotifyPlaylistId: 'sp-playlist-1',
  userId: 'testuser',
};
const trackDoc = {
  playlistId,
  position: 2,
  lastfmArtist: 'Radiohead',
  lastfmTitle: 'Karma Police',
  spotifyTrackId: 'old-track-id',
};

function makeController() {
  const playlists = {
    listForUser: jest.fn().mockResolvedValue([]),
    detailForUser: jest.fn().mockResolvedValue(null),
    getOwnedPlaylist: jest.fn().mockResolvedValue(playlistDoc),
    getTrackAt: jest.fn().mockResolvedValue(trackDoc),
    setTrackMatch: jest.fn().mockResolvedValue(undefined),
    findFanoutTargets: jest.fn().mockResolvedValue([]),
  };
  const spotify = {
    replaceTrackAtPosition: jest.fn().mockResolvedValue(undefined),
    setManualMatch: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new PlaylistsController(
    playlists as unknown as PlaylistsService,
    spotify as unknown as SpotifyService,
  );
  return { controller, playlists, spotify };
}

describe('PlaylistsController', () => {
  describe('list()', () => {
    it('rejects unauthenticated requests', async () => {
      const { controller } = makeController();
      await expect(controller.list(anonSession)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('delegates to playlists.listForUser', async () => {
      const { controller, playlists } = makeController();
      const summaries = [{ id: '1', title: 'Top of 2024' }];
      playlists.listForUser.mockResolvedValue(summaries);
      const result = await controller.list(lastfmOnlySession);
      expect(playlists.listForUser).toHaveBeenCalledWith('testuser');
      expect(result).toEqual(summaries);
    });
  });

  describe('detail()', () => {
    it('rejects unauthenticated requests', async () => {
      const { controller } = makeController();
      await expect(controller.detail(anonSession, 'abc')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns 404 when playlist not found', async () => {
      const { controller, playlists } = makeController();
      playlists.detailForUser.mockResolvedValue(null);
      await expect(
        controller.detail(lastfmOnlySession, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the playlist detail', async () => {
      const { controller, playlists } = makeController();
      const detail = { id: '1', title: 'Top of 2024', tracks: [] };
      playlists.detailForUser.mockResolvedValue(detail);
      const result = await controller.detail(
        lastfmOnlySession,
        String(playlistId),
      );
      expect(playlists.detailForUser).toHaveBeenCalledWith(
        'testuser',
        String(playlistId),
      );
      expect(result).toEqual(detail);
    });
  });

  describe('rematch()', () => {
    const body = { spotifyTrackId: 'new-track-id' };

    it('rejects when lastfm is not in session', async () => {
      const { controller } = makeController();
      await expect(
        controller.rematch(anonSession, String(playlistId), 2, body),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when spotify is not in session', async () => {
      const { controller } = makeController();
      await expect(
        controller.rematch(lastfmOnlySession, String(playlistId), 2, body),
      ).rejects.toThrow(BadRequestException);
    });

    it('orchestrates fix, cache, and fan-out on happy path', async () => {
      const { controller, playlists, spotify } = makeController();

      const target = {
        playlistId: new Types.ObjectId(),
        position: 5,
        spotifyPlaylistId: 'sp-playlist-2',
        oldSpotifyTrackId: 'old-track-id',
      };
      playlists.findFanoutTargets.mockResolvedValue([target]);

      const result = await controller.rematch(
        session,
        String(playlistId),
        2,
        body,
      );

      // Step 1: fix the clicked playlist
      expect(spotify.replaceTrackAtPosition).toHaveBeenCalledWith(
        expect.anything(),
        'sp-playlist-1',
        2,
        'old-track-id',
        'new-track-id',
      );
      expect(playlists.setTrackMatch).toHaveBeenCalledWith(
        playlistId,
        2,
        'new-track-id',
      );

      // Step 2: canonical cache entry
      expect(spotify.setManualMatch).toHaveBeenCalledWith(
        'Radiohead',
        'Karma Police',
        'new-track-id',
      );

      // Step 3: fan-out propagation
      expect(playlists.findFanoutTargets).toHaveBeenCalledWith(
        'testuser',
        'Radiohead',
        'Karma Police',
        playlistId,
        'new-track-id',
      );
      expect(spotify.replaceTrackAtPosition).toHaveBeenCalledWith(
        expect.anything(),
        'sp-playlist-2',
        5,
        'old-track-id',
        'new-track-id',
      );
      expect(playlists.setTrackMatch).toHaveBeenCalledWith(
        target.playlistId,
        5,
        'new-track-id',
        { manualOverride: false },
      );

      expect(result).toEqual({ ok: true, propagatedTo: 1 });
    });

    it('returns propagatedTo: 0 when there are no fan-out targets', async () => {
      const { controller, playlists } = makeController();
      playlists.findFanoutTargets.mockResolvedValue([]);

      const result = await controller.rematch(
        session,
        String(playlistId),
        2,
        body,
      );
      expect(result).toEqual({ ok: true, propagatedTo: 0 });
    });

    it('isolates fan-out errors — other targets still proceed', async () => {
      const { controller, playlists, spotify } = makeController();

      const targets = [
        {
          playlistId: new Types.ObjectId(),
          position: 3,
          spotifyPlaylistId: 'sp-fail',
          oldSpotifyTrackId: 'old-1',
        },
        {
          playlistId: new Types.ObjectId(),
          position: 7,
          spotifyPlaylistId: 'sp-ok',
          oldSpotifyTrackId: 'old-2',
        },
      ];
      playlists.findFanoutTargets.mockResolvedValue(targets);

      // First fan-out target throws, second succeeds
      spotify.replaceTrackAtPosition
        .mockResolvedValueOnce(undefined) // primary fix
        .mockRejectedValueOnce(new Error('Spotify 502'))
        .mockResolvedValueOnce(undefined); // second target

      const result = await controller.rematch(
        session,
        String(playlistId),
        2,
        body,
      );

      expect(result).toEqual({ ok: true, propagatedTo: 1 });
      // Primary fix + two fan-out attempts = 3 calls
      expect(spotify.replaceTrackAtPosition).toHaveBeenCalledTimes(3);
    });

    it('succeeds even when all fan-out targets fail', async () => {
      const { controller, playlists, spotify } = makeController();

      const targets = [
        {
          playlistId: new Types.ObjectId(),
          position: 1,
          spotifyPlaylistId: 'sp-a',
          oldSpotifyTrackId: 'old-a',
        },
        {
          playlistId: new Types.ObjectId(),
          position: 4,
          spotifyPlaylistId: 'sp-b',
          oldSpotifyTrackId: 'old-b',
        },
      ];
      playlists.findFanoutTargets.mockResolvedValue(targets);

      spotify.replaceTrackAtPosition
        .mockResolvedValueOnce(undefined) // primary fix
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'));

      const result = await controller.rematch(
        session,
        String(playlistId),
        2,
        body,
      );

      expect(result).toEqual({ ok: true, propagatedTo: 0 });
    });

    it('respects findFanoutTargets results (manualOverride filtering)', async () => {
      const { controller, playlists } = makeController();

      // findFanoutTargets already excludes manualOverride rows, so an
      // empty result means all other playlists had manual overrides.
      playlists.findFanoutTargets.mockResolvedValue([]);

      const result = await controller.rematch(
        session,
        String(playlistId),
        2,
        body,
      );

      expect(playlists.findFanoutTargets).toHaveBeenCalledWith(
        'testuser',
        'Radiohead',
        'Karma Police',
        playlistId,
        'new-track-id',
      );
      expect(result).toEqual({ ok: true, propagatedTo: 0 });
    });

    it('handles track with null spotifyTrackId (unmatched track)', async () => {
      const { controller, playlists, spotify } = makeController();
      playlists.getTrackAt.mockResolvedValue({
        ...trackDoc,
        spotifyTrackId: undefined,
      });

      await controller.rematch(session, String(playlistId), 2, body);

      expect(spotify.replaceTrackAtPosition).toHaveBeenCalledWith(
        expect.anything(),
        'sp-playlist-1',
        2,
        null,
        'new-track-id',
      );
    });
  });
});
