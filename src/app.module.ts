import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LastfmModule } from './lastfm/lastfm.module';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';
import { SpotifyModule } from './spotify/spotify.module';
import { DatabaseModule } from './database/database.module';
import { AurralModule } from './aurral/aurral.module';
import { JobsModule } from './jobs/jobs.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { GenerationModule } from './generation/generation.module';
import { MetricsModule } from './metrics/metrics.module';
import { LoggerModule } from 'nestjs-pino';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      exclude: [
        '/api/v1/(.*)',
        '/health',
        '/metrics',
        '/spotify/callback',
        '/lastfm/callback',
      ],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        autoLogging: { ignore: (req) => req.url === '/health' },
        redact: ['req.headers.cookie', 'req.headers.authorization'],
      },
    }),
    LastfmModule,
    SpotifyModule,
    DatabaseModule,
    AurralModule,
    PlaylistsModule,
    MetricsModule,
    GenerationModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
