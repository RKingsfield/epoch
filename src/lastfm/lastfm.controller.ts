import { Controller, Get, Query, Res, Session } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { LastfmService } from './lastfm.service';
import { LastfmAuthService } from './lastfm-auth.service';
import { AppSession } from '../session/session.types';

@Controller('lastfm')
export class LastfmController {
  constructor(
    private readonly lastfm: LastfmService,
    private readonly auth: LastfmAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async status(@Session() session: AppSession): Promise<string> {
    if (!session.lastfm) {
      const url = await this.auth.getAuthUrl(this.publicUrl());
      return `Not signed into Last.fm. Start session here: ${url}`;
    }
    const userData = await this.lastfm.getUserData(session.lastfm);
    return `Signed into Last.fm as: ${userData.realname ?? userData.name}`;
  }

  @Get('callback')
  async login(
    @Query('token') lastfmToken: string,
    @Session() session: AppSession,
    @Res() res: Response,
  ): Promise<void> {
    session.lastfm = await this.auth.exchangeToken(lastfmToken);
    res.redirect('/');
  }

  private publicUrl(): string {
    return this.config.get<string>('PUBLIC_URL') ?? 'http://localhost:5342';
  }
}
