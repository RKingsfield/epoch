import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  Session,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { SpotifySearchResult } from '../../shared/types';
import { SpotifyService } from './spotify.service';
import { SpotifyAuthService } from './spotify-auth.service';
import { SessionTokenContext } from './spotify-token.context';
import { AppSession } from '../session/session.types';
import { httpStatus } from '../utils/errors';

@Controller('spotify')
export class SpotifyController {
  constructor(
    private readonly spotify: SpotifyService,
    private readonly auth: SpotifyAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('callback')
  async login(
    @Query('code') code: string,
    @Query('state') state: string,
    @Session() session: AppSession,
    @Res() res: Response,
  ): Promise<void> {
    if (
      !code ||
      !state ||
      !session.spotifyOauthState ||
      state !== session.spotifyOauthState
    ) {
      throw new BadRequestException('Invalid OAuth callback');
    }
    session.spotify = await this.auth.exchangeCode(code, this.redirectUri());
    res.redirect('/');
  }

  @Get('tracks/:id')
  async track(
    @Session() session: AppSession,
    @Param('id') id: string,
  ): Promise<SpotifySearchResult> {
    if (!session.spotify)
      throw new BadRequestException('Spotify not connected');
    try {
      return await this.spotify.getTrack(new SessionTokenContext(session), id);
    } catch (err: unknown) {
      if (httpStatus(err) === 404)
        throw new NotFoundException(`Track ${id} not found`);
      throw err;
    }
  }

  @Get('search')
  async search(
    @Session() session: AppSession,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ): Promise<SpotifySearchResult[]> {
    if (!session.spotify)
      throw new BadRequestException('Spotify not connected');
    if (!q || q.trim().length === 0) return [];
    return this.spotify.search(
      new SessionTokenContext(session),
      q.trim(),
      Math.min(Math.max(parseInt(limit ?? '10', 10) || 10, 1), 25),
    );
  }

  private redirectUri(): string {
    return `${this.config.getOrThrow<string>('PUBLIC_URL')}/spotify/callback`;
  }
}
