import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { LastfmService } from './lastfm.service';
import { LastfmAuthService } from './lastfm-auth.service';
import { LastfmConfig } from './lastfm.config';
import { LastfmController } from './lastfm.controller';

@Module({
  imports: [HttpModule],
  providers: [LastfmConfig, LastfmAuthService, LastfmService],
  controllers: [LastfmController],
  exports: [LastfmService, LastfmAuthService],
})
export class LastfmModule {}
