import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueEvents } from 'bullmq';
import { GenerationModule } from '../generation/generation.module';
import { MetricsModule } from '../metrics/metrics.module';
import { JobsController } from './jobs.controller';
import {
  PlaylistGenerationProcessor,
  PLAYLIST_QUEUE,
  PLAYLIST_QUEUE_EVENTS,
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
        connection: parseRedis(config.getOrThrow<string>('REDIS_URL')),
      }),
    }),
    BullModule.registerQueue({ name: PLAYLIST_QUEUE }),
    GenerationModule,
    MetricsModule,
  ],
  controllers: [JobsController],
  providers: [
    PlaylistGenerationProcessor,
    {
      provide: PLAYLIST_QUEUE_EVENTS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new QueueEvents(PLAYLIST_QUEUE, {
          connection: parseRedis(config.getOrThrow<string>('REDIS_URL')),
        }),
    },
  ],
})
export class JobsModule implements OnModuleDestroy {
  constructor(
    @Inject(PLAYLIST_QUEUE_EVENTS) private readonly queueEvents: QueueEvents,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close();
  }
}
