import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SpotifyModule } from '../spotify/spotify.module';
import { PlaylistsService } from './playlists.service';
import { PlaylistsController } from './playlists.controller';
import { playlistsProviders } from './playlists.providers';

@Module({
  imports: [DatabaseModule, SpotifyModule],
  providers: [PlaylistsService, ...playlistsProviders],
  controllers: [PlaylistsController],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
