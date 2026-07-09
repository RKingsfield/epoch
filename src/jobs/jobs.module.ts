import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GenerationModule } from '../generation/generation.module';
import { MetricsModule } from '../metrics/metrics.module';
import { JobsController } from './jobs.controller';
import {
  PlaylistGenerationProcessor,
  PLAYLIST_QUEUE,
} from './playlist-generation.processor';

function parseRedis(url: string): {
  host: string;
  port: number;
  password?: string;
  tls?: { rejectUnauthorized: boolean };
} {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || '6379', 10),
    password: u.password || undefined,
    ...(u.protocol === 'rediss:' && { tls: { rejectUnauthorized: false } }),
  };
}

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: parseRedis(
          config.get<string>('REDIS_URL') ?? 'redis://redis:6379',
        ),
      }),
    }),
    BullModule.registerQueue({ name: PLAYLIST_QUEUE }),
    GenerationModule,
    MetricsModule,
  ],
  controllers: [JobsController],
  providers: [PlaylistGenerationProcessor],
})
export class JobsModule {}
