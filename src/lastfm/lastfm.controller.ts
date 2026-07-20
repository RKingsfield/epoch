import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  Res,
  Session,
} from '@nestjs/common';
import { Response } from 'express';
import { LastfmAuthService } from './lastfm-auth.service';
import { AppSession } from '../session/session.types';
import { errorMessage } from '../utils/errors';

@Controller('lastfm')
export class LastfmController {
  private readonly logger = new Logger(LastfmController.name);

  constructor(private readonly auth: LastfmAuthService) {}

  @Get('callback')
  async login(
    @Query('token') lastfmToken: string,
    @Session() session: AppSession,
    @Res() res: Response,
  ): Promise<void> {
    if (!lastfmToken) {
      throw new BadRequestException('Missing Last.fm token');
    }
    try {
      session.lastfm = await this.auth.exchangeToken(lastfmToken);
    } catch (err: unknown) {
      this.logger.error(`Last.fm token exchange failed: ${errorMessage(err)}`);
      throw new BadRequestException('Last.fm authentication failed');
    }
    res.redirect('/');
  }
}
