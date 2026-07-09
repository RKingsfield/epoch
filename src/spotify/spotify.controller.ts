import { Controller, Get, Query, Res, Session } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { SpotifySearchResult } from '../../shared/types';
import { SpotifyService } from './spotify.service';
import { SpotifyAuthService } from './spotify-auth.service';
import { SessionTokenContext } from './spotify-token.context';
import { AppSession } from '../session/session.types';

@Controller('spotify')
export class SpotifyController {
  constructor(
    private readonly spotify: SpotifyService,
    private readonly auth: SpotifyAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async status(@Session() session: AppSession): Promise<string> {
    if (!session.spotify) {
      return `Not signed into Spotify. Start session here: ${this.auth.getAuthUrl(
        this.redirectUri(),
        'init',
      )}`;
    }
    const userData = await this.spotify.getUserData(
      new SessionTokenContext(session),
    );
    return `Signed into Spotify as: ${userData.display_name}`;
  }

  @Get('callback')
  async login(
    @Query('code') code: string,
    @Session() session: AppSession,
    @Res() res: Response,
  ): Promise<void> {
    session.spotify = await this.auth.exchangeCode(code, this.redirectUri());
    res.redirect('/');
  }

  @Get('search')
  async search(
    @Session() session: AppSession,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ): Promise<SpotifySearchResult[]> {
    if (!session.spotify) return [];
    if (!q || q.trim().length === 0) return [];
    return this.spotify.search(
      new SessionTokenContext(session),
      q.trim(),
      Math.min(parseInt(limit ?? '10', 10) || 10, 25),
    );
  }

  private redirectUri(): string {
    const publicUrl =
      this.config.get<string>('PUBLIC_URL') ?? 'http://localhost:5342';
    return `${publicUrl}/spotify/callback`;
  }
}
