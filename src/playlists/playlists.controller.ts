import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  Body,
  Session,
} from '@nestjs/common';
import { PlaylistSummary, PlaylistDetail } from '../../shared/types';
import { PlaylistsService } from './playlists.service';
import { SpotifyService } from '../spotify/spotify.service';
import { SessionTokenContext } from '../spotify/spotify-token.context';
import { RematchDto } from './dto/rematch.dto';
import { AppSession } from '../session/session.types';
import { errorMessage } from '../utils/errors';

@Controller('playlists')
export class PlaylistsController {
  private readonly logger = new Logger(PlaylistsController.name);

  constructor(
    private readonly playlists: PlaylistsService,
    private readonly spotify: SpotifyService,
  ) {}

  @Get()
  async list(@Session() session: AppSession): Promise<PlaylistSummary[]> {
    if (!session.lastfm) {
      throw new BadRequestException('Last.fm not connected');
    }
    return this.playlists.listForUser(session.lastfm.name);
  }

  @Get(':id')
  async detail(
    @Session() session: AppSession,
    @Param('id') id: string,
  ): Promise<PlaylistDetail> {
    if (!session.lastfm) {
      throw new BadRequestException('Last.fm not connected');
    }
    const detail = await this.playlists.detailForUser(session.lastfm.name, id);
    if (!detail) {
      throw new NotFoundException(`Playlist ${id} not found`);
    }
    return detail;
  }

  @Put(':id/tracks/:position')
  async rematch(
    @Session() session: AppSession,
    @Param('id') id: string,
    @Param('position', ParseIntPipe) position: number,
    @Body() body: RematchDto,
  ): Promise<{ ok: true; propagatedTo: number }> {
    if (!session.lastfm) throw new BadRequestException('Last.fm not connected');
    if (!session.spotify)
      throw new BadRequestException('Spotify not connected');

    const userId = session.lastfm.name;
    const ctx = new SessionTokenContext(session);
    const playlist = await this.playlists.getOwnedPlaylist(userId, id);
    const track = await this.playlists.getTrackAt(playlist._id, position);
    const newSpotifyTrackId = body.spotifyTrackId;

    // 1. Fix the playlist the user clicked rematch on.
    await this.spotify.replaceTrackAtPosition(
      ctx,
      playlist.spotifyPlaylistId,
      position,
      track.spotifyTrackId ?? null,
      newSpotifyTrackId,
    );
    await this.playlists.setTrackMatch(
      playlist._id,
      position,
      newSpotifyTrackId,
    );

    // 2. Record the canonical (artist, title) → spotifyId match so future
    //    generations skip Spotify search and use this directly.
    await this.spotify.setManualMatch(
      track.lastfmArtist,
      track.lastfmTitle,
      newSpotifyTrackId,
    );

    // 3. Propagate the fix to every other playlist of this user that still
    //    points at the wrong track for the same scrobble. Failures on any
    //    individual playlist are logged but don't fail the request — the
    //    user's primary action already succeeded and the canonical entry
    //    means future generations will pick up the correction.
    const targets = await this.playlists.findFanoutTargets(
      userId,
      track.lastfmArtist,
      track.lastfmTitle,
      playlist._id,
      newSpotifyTrackId,
    );
    let propagatedTo = 0;
    for (const t of targets) {
      try {
        await this.spotify.replaceTrackAtPosition(
          ctx,
          t.spotifyPlaylistId,
          t.position,
          t.oldSpotifyTrackId,
          newSpotifyTrackId,
        );
        await this.playlists.setTrackMatch(
          t.playlistId,
          t.position,
          newSpotifyTrackId,
          {
            manualOverride: false,
          },
        );
        propagatedTo += 1;
      } catch (err: unknown) {
        this.logger.warn(
          `Fan-out failed for playlist ${t.spotifyPlaylistId} pos ${t.position}: ${errorMessage(err)}`,
        );
      }
    }

    return { ok: true, propagatedTo };
  }
}
