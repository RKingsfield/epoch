import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SpotifyService } from './spotify.service';
import { SpotifyController } from './spotify.controller';
import { SpotifyAuthService } from './spotify-auth.service';
import { SpotifyHttpClient } from './spotify-http.client';
import { DatabaseModule } from '../database/database.module';
import { tracksProviders } from './tracks/tracks.providers';

@Module({
  imports: [HttpModule, DatabaseModule],
  providers: [
    SpotifyAuthService,
    SpotifyHttpClient,
    SpotifyService,
    ...tracksProviders,
  ],
  controllers: [SpotifyController],
  exports: [SpotifyService, SpotifyAuthService],
})
export class SpotifyModule {}
