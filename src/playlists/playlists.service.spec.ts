import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { PlaylistsService } from './playlists.service';
import { Playlist } from './schemas/playlist.schema';
import { PlaylistTrack } from './schemas/playlist-track.schema';

function mockPlaylistModel() {
  return {
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn(),
  };
}

function mockTrackModel() {
  return {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    insertMany: jest.fn().mockResolvedValue([]),
    find: jest.fn(),
    aggregate: jest.fn().mockResolvedValue([]),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
}

function chainSelect(value: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
}

function chain(value: unknown) {
  return {
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('PlaylistsService', () => {
  let service: PlaylistsService;
  let playlistModel: ReturnType<typeof mockPlaylistModel>;
  let trackModel: ReturnType<typeof mockTrackModel>;

  beforeEach(async () => {
    playlistModel = mockPlaylistModel();
    trackModel = mockTrackModel();
    const module = await Test.createTestingModule({
      providers: [
        PlaylistsService,
        { provide: Playlist.name, useValue: playlistModel },
        { provide: PlaylistTrack.name, useValue: trackModel },
      ],
    }).compile();
    service = module.get(PlaylistsService);
  });

  describe('record', () => {
    it('upserts the playlist by (userId, period, periodKey) and rewrites tracks in order', async () => {
      const id = new Types.ObjectId();
      playlistModel.findOneAndUpdate.mockResolvedValue({ _id: id });

      await service.record({
        userId: 'testuser',
        title: 'Top of 2024',
        period: 'yearly',
        periodKey: '2024',
        spotifyPlaylistId: 'sp-1',
        aurralExported: false,
        tracks: [
          {
            lastfmArtist: 'Burial',
            lastfmTitle: 'Archangel',
            spotifyTrackId: 'sp-a',
          },
          {
            lastfmArtist: 'Air',
            lastfmTitle: "La Femme d'Argent",
            spotifyTrackId: null,
          },
        ],
      });

      expect(playlistModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'testuser', period: 'yearly', periodKey: '2024' },
        expect.objectContaining({
          $set: expect.objectContaining({
            title: 'Top of 2024',
            spotifyPlaylistId: 'sp-1',
            aurralExported: false,
          }),
        }),
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      expect(trackModel.deleteMany).toHaveBeenCalledWith({ playlistId: id });
      expect(trackModel.insertMany).toHaveBeenCalledWith([
        expect.objectContaining({
          playlistId: id,
          position: 0,
          lastfmArtist: 'Burial',
          lastfmTitle: 'Archangel',
          spotifyTrackId: 'sp-a',
          matchedAt: expect.any(Date),
        }),
        expect.objectContaining({
          playlistId: id,
          position: 1,
          lastfmArtist: 'Air',
          lastfmTitle: "La Femme d'Argent",
          spotifyTrackId: undefined,
          matchedAt: undefined,
        }),
      ]);
    });

    it('skips insertMany when tracks is empty', async () => {
      playlistModel.findOneAndUpdate.mockResolvedValue({
        _id: new Types.ObjectId(),
      });
      await service.record({
        userId: 'r',
        title: 't',
        period: 'monthly',
        periodKey: '2024-01',
        spotifyPlaylistId: 'sp',
        aurralExported: false,
        tracks: [],
      });
      expect(trackModel.insertMany).not.toHaveBeenCalled();
    });
  });

  describe('listForUser', () => {
    it('returns empty array when user has no playlists', async () => {
      playlistModel.find.mockReturnValue(chain([]));
      const result = await service.listForUser('testuser');
      expect(result).toEqual([]);
      expect(trackModel.aggregate).not.toHaveBeenCalled();
    });

    it('zips playlist rows with aggregated track counts', async () => {
      const id = new Types.ObjectId();
      const createdAt = new Date('2024-06-01');
      playlistModel.find.mockReturnValue(
        chain([
          {
            _id: id,
            title: 'Top of 2024',
            period: 'yearly',
            periodKey: '2024',
            spotifyPlaylistId: 'sp-1',
            aurralExported: true,
            createdAt,
          },
        ]),
      );
      trackModel.aggregate.mockResolvedValue([
        { _id: id, total: 50, matched: 47 },
      ]);

      const result = await service.listForUser('testuser');
      expect(result).toEqual([
        {
          id: String(id),
          title: 'Top of 2024',
          period: 'yearly',
          periodKey: '2024',
          spotifyPlaylistId: 'sp-1',
          aurralExported: true,
          trackCount: 50,
          matchedCount: 47,
          createdAt: createdAt.toISOString(),
        },
      ]);
    });
  });

  describe('detailForUser', () => {
    it('returns null for an invalid ObjectId', async () => {
      const result = await service.detailForUser('testuser', 'not-an-id');
      expect(result).toBeNull();
      expect(playlistModel.findOne).not.toHaveBeenCalled();
    });

    it('returns null when the playlist is missing or owned by someone else', async () => {
      playlistModel.findOne.mockReturnValue(chain(null));
      const result = await service.detailForUser(
        'testuser',
        new Types.ObjectId().toString(),
      );
      expect(result).toBeNull();
    });

    it('returns playlist + tracks ordered by position', async () => {
      const id = new Types.ObjectId();
      const createdAt = new Date('2024-06-01');
      playlistModel.findOne.mockReturnValue(
        chain({
          _id: id,
          title: 'Top of 2024',
          period: 'yearly',
          periodKey: '2024',
          spotifyPlaylistId: 'sp-1',
          aurralExported: false,
          createdAt,
        }),
      );
      trackModel.find.mockReturnValue(
        chain([
          {
            position: 0,
            lastfmArtist: 'Burial',
            lastfmTitle: 'Archangel',
            spotifyTrackId: 'sp-a',
            manualOverride: false,
          },
          {
            position: 1,
            lastfmArtist: 'Air',
            lastfmTitle: "La Femme d'Argent",
            spotifyTrackId: undefined,
            manualOverride: false,
          },
        ]),
      );

      const result = await service.detailForUser('testuser', id.toString());
      expect(result).not.toBeNull();
      expect(result!.id).toBe(String(id));
      expect(result!.trackCount).toBe(2);
      expect(result!.matchedCount).toBe(1);
      expect(result!.tracks[1].spotifyTrackId).toBeNull();
    });
  });

  describe('findFanoutTargets', () => {
    it('returns empty when the user has no other playlists', async () => {
      playlistModel.find.mockReturnValue(chainSelect([]));
      const result = await service.findFanoutTargets(
        'testuser',
        'Burial',
        'Archangel',
        new Types.ObjectId(),
        'sp-correct',
      );
      expect(result).toEqual([]);
      expect(trackModel.find).not.toHaveBeenCalled();
    });

    it('returns matching tracks across other playlists, excluding the source playlist, manual overrides, and rows already on the new id', async () => {
      const sourceId = new Types.ObjectId();
      const otherId1 = new Types.ObjectId();
      const otherId2 = new Types.ObjectId();
      playlistModel.find.mockReturnValue(
        chainSelect([
          { _id: otherId1, spotifyPlaylistId: 'sp-pl-1' },
          { _id: otherId2, spotifyPlaylistId: 'sp-pl-2' },
        ]),
      );
      trackModel.find.mockReturnValue(
        chain([
          {
            playlistId: otherId1,
            position: 3,
            lastfmArtist: 'Burial',
            lastfmTitle: 'Archangel',
            spotifyTrackId: 'sp-wrong',
          },
          {
            playlistId: otherId2,
            position: 7,
            lastfmArtist: 'Burial',
            lastfmTitle: 'Archangel',
            spotifyTrackId: 'sp-correct',
          },
        ]),
      );

      const result = await service.findFanoutTargets(
        'testuser',
        'Burial',
        'Archangel',
        sourceId,
        'sp-correct',
      );

      expect(playlistModel.find).toHaveBeenCalledWith({
        userId: 'testuser',
        _id: { $ne: sourceId },
      });
      expect(trackModel.find).toHaveBeenCalledWith({
        playlistId: { $in: [otherId1, otherId2] },
        lastfmArtist: 'Burial',
        lastfmTitle: 'Archangel',
        manualOverride: { $ne: true },
      });
      expect(result).toEqual([
        {
          playlistId: otherId1,
          position: 3,
          spotifyPlaylistId: 'sp-pl-1',
          oldSpotifyTrackId: 'sp-wrong',
        },
      ]);
    });
  });

  describe('setTrackMatch', () => {
    it('marks the track as a manual override by default', async () => {
      const id = new Types.ObjectId();
      await service.setTrackMatch(id, 5, 'sp-new');
      expect(trackModel.updateOne).toHaveBeenCalledWith(
        { playlistId: id, position: 5 },
        {
          $set: {
            spotifyTrackId: 'sp-new',
            matchedAt: expect.any(Date),
            manualOverride: true,
          },
        },
      );
    });

    it('writes manualOverride=false when explicitly opted out for fan-out targets', async () => {
      const id = new Types.ObjectId();
      await service.setTrackMatch(id, 5, 'sp-new', { manualOverride: false });
      expect(trackModel.updateOne).toHaveBeenCalledWith(
        { playlistId: id, position: 5 },
        {
          $set: {
            spotifyTrackId: 'sp-new',
            matchedAt: expect.any(Date),
            manualOverride: false,
          },
        },
      );
    });
  });
});
