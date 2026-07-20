import { Controller, Get, Session } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AuthStatus } from '../shared/types';
import { AppService } from './app.service';
import { AppSession } from './session/session.types';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('status')
  getStatus(@Session() session: AppSession): AuthStatus {
    session.spotifyOauthState ??= randomBytes(16).toString('hex');
    return this.appService.getStatus(
      {
        lastfm: !!session.lastfm,
        spotify: !!session.spotify,
      },
      session.spotifyOauthState,
    );
  }
}
