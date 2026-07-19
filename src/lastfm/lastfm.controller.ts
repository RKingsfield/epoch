import { Controller, Get, Query, Res, Session } from '@nestjs/common';
import { Response } from 'express';
import { LastfmAuthService } from './lastfm-auth.service';
import { AppSession } from '../session/session.types';

@Controller('lastfm')
export class LastfmController {
  constructor(private readonly auth: LastfmAuthService) {}

  @Get('callback')
  async login(
    @Query('token') lastfmToken: string,
    @Session() session: AppSession,
    @Res() res: Response,
  ): Promise<void> {
    session.lastfm = await this.auth.exchangeToken(lastfmToken);
    res.redirect('/');
  }
}
