import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import {
  PlaylistPeriod,
  PlaylistSummary,
  PlaylistDetail,
} from '../../shared/types';
import { Playlist, PlaylistDocument } from './schemas/playlist.schema';
import {
  PlaylistTrack,
  PlaylistTrackDocument,
} from './schemas/playlist-track.schema';

export interface RecordPlaylistInput {
  userId: string;
  title: string;
  period: PlaylistPeriod;
  periodKey: string;
  spotifyPlaylistId: string;
  aurralExported: boolean;
  tracks: Array<{
    lastfmArtist: string;
    lastfmTitle: string;
    spotifyTrackId: string | null;
  }>;
}

@Injectable()
export class PlaylistsService {
  private readonly logger = new Logger(PlaylistsService.name);

  constructor(
    @Inject(Playlist.name)
    private readonly playlistModel: Model<PlaylistDocument>,
    @Inject(PlaylistTrack.name)
    private readonly trackModel: Model<PlaylistTrackDocument>,
  ) {}

  async record(input: RecordPlaylistInput): Promise<PlaylistDocument> {
    const playlist = await this.playlistModel.findOneAndUpdate(
      {
        userId: input.userId,
        period: input.period,
        periodKey: input.periodKey,
      },
      {
        $set: {
          title: input.title,
          spotifyPlaylistId: input.spotifyPlaylistId,
          aurralExported: input.aurralExported,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await this.trackModel.deleteMany({ playlistId: playlist._id });
    if (input.tracks.length > 0) {
      await this.trackModel.insertMany(
        input.tracks.map((t, i) => ({
          playlistId: playlist._id,
          position: i,
          lastfmArtist: t.lastfmArtist,
          lastfmTitle: t.lastfmTitle,
          spotifyTrackId: t.spotifyTrackId ?? undefined,
          matchedAt: t.spotifyTrackId ? new Date() : undefined,
        })),
      );
    }
    return playlist;
  }

  async hasRecord(
    userId: string,
    period: PlaylistPeriod,
    periodKey: string,
  ): Promise<boolean> {
    const found = await this.playlistModel.exists({
      userId,
      period,
      periodKey,
    });
    return found !== null;
  }

  async listForUser(userId: string): Promise<PlaylistSummary[]> {
    const playlists = await this.playlistModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (playlists.length === 0) return [];

    const counts = await this.trackModel.aggregate<{
      _id: Types.ObjectId;
      total: number;
      matched: number;
    }>([
      { $match: { playlistId: { $in: playlists.map((p) => p._id) } } },
      {
        $group: {
          _id: '$playlistId',
          total: { $sum: 1 },
          matched: {
            $sum: { $cond: [{ $ifNull: ['$spotifyTrackId', false] }, 1, 0] },
          },
        },
      },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c]));

    return playlists.map((p) => {
      const c = countMap.get(String(p._id));
      return {
        id: String(p._id),
        title: p.title,
        period: p.period,
        periodKey: p.periodKey,
        spotifyPlaylistId: p.spotifyPlaylistId,
        aurralExported: p.aurralExported,
        trackCount: c?.total ?? 0,
        matchedCount: c?.matched ?? 0,
        createdAt: (p.createdAt ?? new Date(0)).toISOString(),
      };
    });
  }

  async getOwnedPlaylist(
    userId: string,
    id: string,
  ): Promise<PlaylistDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Playlist ${id} not found`);
    }
    const playlist = await this.playlistModel
      .findOne({ _id: id, userId })
      .exec();
    if (!playlist) {
      throw new NotFoundException(`Playlist ${id} not found`);
    }
    return playlist;
  }

  async getTrackAt(
    playlistId: Types.ObjectId,
    position: number,
  ): Promise<PlaylistTrackDocument> {
    const track = await this.trackModel
      .findOne({ playlistId, position })
      .exec();
    if (!track) {
      throw new NotFoundException(`Track at position ${position} not found`);
    }
    return track;
  }

  async setTrackMatch(
    playlistId: Types.ObjectId,
    position: number,
    spotifyTrackId: string,
    options: { manualOverride?: boolean } = {},
  ): Promise<void> {
    const { manualOverride = true } = options;
    await this.trackModel.updateOne(
      { playlistId, position },
      {
        $set: {
          spotifyTrackId,
          matchedAt: new Date(),
          manualOverride,
        },
      },
    );
  }

  // Find every other playlist of this user that contains the same Last.fm
  // scrobble and is currently pointing at a different Spotify track. Used to
  // propagate a manual rematch across all the user's playlists so the fix
  // becomes canonical instead of one-off. Skips rows that already have a
  // manualOverride — those represent explicit per-playlist choices.
  async findFanoutTargets(
    userId: string,
    lastfmArtist: string,
    lastfmTitle: string,
    excludePlaylistId: Types.ObjectId,
    newSpotifyTrackId: string,
  ): Promise<
    Array<{
      playlistId: Types.ObjectId;
      position: number;
      spotifyPlaylistId: string;
      oldSpotifyTrackId: string | null;
    }>
  > {
    const playlists = await this.playlistModel
      .find({ userId, _id: { $ne: excludePlaylistId } })
      .select({ _id: 1, spotifyPlaylistId: 1 })
      .lean()
      .exec();
    if (playlists.length === 0) return [];

    const playlistById = new Map(
      playlists.map((p) => [String(p._id), p.spotifyPlaylistId]),
    );

    const tracks = await this.trackModel
      .find({
        playlistId: { $in: playlists.map((p) => p._id) },
        lastfmArtist,
        lastfmTitle,
        manualOverride: { $ne: true },
      })
      .lean()
      .exec();

    return tracks
      .filter((t) => t.spotifyTrackId !== newSpotifyTrackId)
      .map((t) => ({
        playlistId: t.playlistId,
        position: t.position,
        spotifyPlaylistId: playlistById.get(String(t.playlistId))!,
        oldSpotifyTrackId: t.spotifyTrackId ?? null,
      }));
  }

  async detailForUser(
    userId: string,
    id: string,
  ): Promise<PlaylistDetail | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const playlist = await this.playlistModel
      .findOne({ _id: id, userId })
      .lean()
      .exec();
    if (!playlist) return null;

    const tracks = await this.trackModel
      .find({ playlistId: playlist._id })
      .sort({ position: 1 })
      .lean()
      .exec();

    const matchedCount = tracks.filter((t) => t.spotifyTrackId).length;
    return {
      id: String(playlist._id),
      title: playlist.title,
      period: playlist.period,
      periodKey: playlist.periodKey,
      spotifyPlaylistId: playlist.spotifyPlaylistId,
      aurralExported: playlist.aurralExported,
      trackCount: tracks.length,
      matchedCount,
      createdAt: (playlist.createdAt ?? new Date(0)).toISOString(),
      tracks: tracks.map((t) => ({
        position: t.position,
        lastfmArtist: t.lastfmArtist,
        lastfmTitle: t.lastfmTitle,
        spotifyTrackId: t.spotifyTrackId ?? null,
        manualOverride: t.manualOverride,
      })),
    };
  }
}
