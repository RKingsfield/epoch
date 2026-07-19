import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { Job, Queue } from 'bullmq';
import { GenerationService } from '../generation/generation.service';
import { PlaylistPeriod, ProcessSummary } from '../../shared/types';
import {
  JobTokenContext,
  JobTokenSnapshot,
} from '../spotify/spotify-token.context';
import { LastfmSessionData } from '../session/session.types';
import {
  METRIC_JOBS_COMPLETED,
  METRIC_JOBS_FAILED,
} from '../metrics/metrics.module';

export const PLAYLIST_QUEUE = 'playlist-generation';
export const GENERATE_JOB = 'generate';
export const PLAYLIST_QUEUE_EVENTS = 'PLAYLIST_QUEUE_EVENTS';

// Set by DELETE /jobs/:id for active jobs; checked between specs. TTL'd so
// stale flags can't cancel a future run that reuses nothing.
export const cancelKey = (jobId: string): string => `epoch:cancel:${jobId}`;

export interface GenerateJobData extends JobTokenSnapshot {
  lastfm: LastfmSessionData;
  periods?: PlaylistPeriod[];
}

@Processor(PLAYLIST_QUEUE)
export class PlaylistGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(PlaylistGenerationProcessor.name);

  constructor(
    private readonly generation: GenerationService,
    @InjectQueue(PLAYLIST_QUEUE) private readonly queue: Queue,
    @InjectMetric(METRIC_JOBS_COMPLETED)
    private readonly jobsCompleted: Counter<string>,
    @InjectMetric(METRIC_JOBS_FAILED)
    private readonly jobsFailed: Counter<string>,
  ) {
    super();
  }

  async process(
    job: Job<GenerateJobData, ProcessSummary>,
  ): Promise<ProcessSummary> {
    this.logger.log(`Job ${job.id} starting for ${job.data.lastfm.name}`);
    const ctx = new JobTokenContext(job as Job<JobTokenSnapshot, unknown>);
    const client = await this.queue.client;
    try {
      const summary = await this.generation.generate(
        job.data.lastfm,
        ctx,
        async (msg) => {
          await job.log(msg);
          await job.updateProgress({ message: msg });
        },
        job.data.periods,
        async () => (await client.exists(cancelKey(job.id!))) === 1,
      );
      this.logger.log(
        `Job ${job.id} done — created ${summary.created.length}, skipped ${summary.skipped.length}`,
      );
      this.jobsCompleted.inc();
      return summary;
    } catch (err) {
      this.jobsFailed.inc();
      throw err;
    }
  }
}
