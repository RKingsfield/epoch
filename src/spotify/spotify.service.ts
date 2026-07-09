import { Inject, Injectable, Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { Track as TrackModel } from './tracks/schemas/track.schema';
import { SpotifyHttpClient } from './spotify-http.client';
import { SpotifyTokenContext } from './spotify-token.context';
import { SpotifySearchResult } from '../../shared/types';
import { errorMessage } from '../utils/errors';

const SPOTIFY_API = 'https://api.spotify.com';

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);

  constructor(
    private readonly client: SpotifyHttpClient,
    @Inject(TrackModel.name) private readonly trackModel: Model<TrackModel>,
  ) {}

  async getUserData(ctx: SpotifyTokenContext): Promise<UserDataResponse> {
    return this.client.get<UserDataResponse>(`${SPOTIFY_API}/v1/me`, ctx);
  }

  async findTrackId(
    ctx: SpotifyTokenContext,
    artist: string,
    title: string,
  ): Promise<string | null> {
    const cached = await this.trackModel.findOne({ artist, title });
    if (cached) return cached.spotifyId || null;

    const params = new URLSearchParams({
      q: `${title} artist:${artist}`,
      type: 'track',
      limit: '1',
    });
    const response = await this.client.get<SpotifySearchResponse>(
      `${SPOTIFY_API}/v1/search?${params.toString()}`,
      ctx,
    );

    const trackId = response.tracks?.items?.[0]?.id ?? null;
    await this.cacheTrack(artist, title, trackId);
    return trackId;
  }

  async setManualMatch(
    artist: string,
    title: string,
    spotifyTrackId: string,
  ): Promise<void> {
    await this.trackModel.updateOne(
      { artist, title },
      {
        $set: {
          artist,
          title,
          spotifyId: spotifyTrackId,
          manualOverride: true,
        },
      },
      { upsert: true },
    );
  }

  async search(
    ctx: SpotifyTokenContext,
    query: string,
    limit = 10,
  ): Promise<SpotifySearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: String(limit),
    });
    const response = await this.client.get<SpotifySearchResponse>(
      `${SPOTIFY_API}/v1/search?${params.toString()}`,
      ctx,
    );
    return (response.tracks?.items ?? []).map(this.toSpotifySearchResult);
  }

  async getMyPlaylists(
    ctx: SpotifyTokenContext,
  ): Promise<SimplifiedPlaylistObj[]> {
    const items: SimplifiedPlaylistObj[] = [];
    let next: string | null = `${SPOTIFY_API}/v1/me/playlists?limit=50`;
    while (next) {
      const response: PlaylistsResponse = await this.client.get(next, ctx);
      for (const item of response.items) {
        items.push({ id: item.id, name: item.name });
      }
      next = response.next;
    }
    return items;
  }

  async createPlaylist(
    ctx: SpotifyTokenContext,
    title: string,
    trackIds: string[],
  ): Promise<{ spotifyPlaylistId: string }> {
    const userData = await this.getUserData(ctx);
    const playlist = await this.client.post<{ id: string }>(
      `${SPOTIFY_API}/v1/users/${userData.id}/playlists`,
      ctx,
      { name: title, public: false },
    );

    const uris = trackIds
      .filter((id) => id && id !== '')
      .map((id) => `spotify:track:${id}`);

    if (uris.length === 0) {
      this.logger.warn(
        `Created empty playlist "${title}" — no track URIs to add`,
      );
      return { spotifyPlaylistId: playlist.id };
    }

    for (let i = 0; i < uris.length; i += 100) {
      await this.client.post(
        `${SPOTIFY_API}/v1/playlists/${playlist.id}/tracks`,
        ctx,
        { uris: uris.slice(i, i + 100) },
      );
    }
    return { spotifyPlaylistId: playlist.id };
  }

  async replaceTrackAtPosition(
    ctx: SpotifyTokenContext,
    spotifyPlaylistId: string,
    position: number,
    oldTrackId: string | null,
    newTrackId: string,
  ): Promise<void> {
    if (oldTrackId) {
      await this.client.delete(
        `${SPOTIFY_API}/v1/playlists/${spotifyPlaylistId}/tracks`,
        ctx,
        {
          tracks: [
            { uri: `spotify:track:${oldTrackId}`, positions: [position] },
          ],
        },
      );
    }
    const params = new URLSearchParams({
      uris: `spotify:track:${newTrackId}`,
      position: String(position),
    });
    await this.client.post(
      `${SPOTIFY_API}/v1/playlists/${spotifyPlaylistId}/tracks?${params.toString()}`,
      ctx,
      {},
    );
  }

  private toSpotifySearchResult(item: SpotifyTrackItem): SpotifySearchResult {
    return {
      id: item.id,
      name: item.name,
      artists: item.artists?.map((a) => a.name) ?? [],
      album: item.album?.name ?? '',
      albumArt: item.album?.images?.[0]?.url ?? null,
      durationMs: item.duration_ms ?? 0,
    };
  }

  private async cacheTrack(
    artist: string,
    title: string,
    spotifyId: string | null,
  ): Promise<void> {
    if (!spotifyId) return;
    try {
      // Don't clobber a manual override with an automatic match.
      await this.trackModel.updateOne(
        { artist, title, manualOverride: { $ne: true } },
        { $set: { artist, title, spotifyId } },
        { upsert: true },
      );
    } catch (err: unknown) {
      this.logger.debug(`Track cache write failed: ${errorMessage(err)}`);
    }
  }
}

interface UserDataResponse {
  display_name: string;
  id: string;
}

interface SpotifyTrackItem {
  id: string;
  name: string;
  artists?: Array<{ name: string }>;
  album?: { name: string; images?: Array<{ url: string }> };
  duration_ms?: number;
}

interface SpotifySearchResponse {
  tracks: { items: SpotifyTrackItem[] };
}

interface PlaylistsResponse {
  items: Array<{ id: string; name: string }>;
  next: string | null;
}

export interface SimplifiedPlaylistObj {
  id: string;
  name: string;
}
