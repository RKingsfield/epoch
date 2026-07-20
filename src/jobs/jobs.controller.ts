import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  MessageEvent,
  NotFoundException,
  Param,
  Post,
  Session,
  Sse,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue, QueueEvents } from 'bullmq';
import { Observable } from 'rxjs';
import {
  cancelKey,
  GenerateJobData,
  GENERATE_JOB,
  PLAYLIST_QUEUE,
  PLAYLIST_QUEUE_EVENTS,
} from './playlist-generation.processor';
import {
  ProcessSummary,
  JobSummary,
  JobsListEntry,
  TERMINAL_JOB_STATES,
} from '../../shared/types';
import { GenerateDto } from './dto/generate.dto';
import { AppSession } from '../session/session.types';

const SSE_HEARTBEAT_MS = 15_000;

@Controller('jobs')
export class JobsController {
  constructor(
    @InjectQueue(PLAYLIST_QUEUE)
    private readonly queue: Queue<GenerateJobData>,
    @Inject(PLAYLIST_QUEUE_EVENTS)
    private readonly queueEvents: QueueEvents,
  ) {}

  @Post('generate')
  async enqueue(
    @Session() session: AppSession,
    @Body() body: GenerateDto,
  ): Promise<{ jobId: string; statusUrl: string }> {
    if (!session.lastfm) throw new BadRequestException('Last.fm not connected');
    if (!session.spotify)
      throw new BadRequestException('Spotify not connected');

    const data: GenerateJobData = {
      lastfm: session.lastfm,
      spotify: session.spotify,
      ...(body.periods && { periods: body.periods }),
    };
    const job = await this.queue.add(GENERATE_JOB, data, {
      removeOnComplete: { age: 60 * 60 * 24 },
      removeOnFail: { age: 60 * 60 * 24 },
    });
    return { jobId: job.id!, statusUrl: `/api/v1/jobs/${job.id}` };
  }

  @Get()
  async list(@Session() session: AppSession): Promise<JobsListEntry[]> {
    if (!session.lastfm) throw new BadRequestException('Last.fm not connected');
    const userId = session.lastfm.name;
    // One query per state instead of getJobs + per-job getState: the state
    // is known from which list a job came out of, saving 50 Redis calls.
    const states = [
      'completed',
      'failed',
      'active',
      'waiting',
      'delayed',
    ] as const;
    const perState = await Promise.all(
      states.map(async (state) => {
        const jobs = await this.queue.getJobs([state], 0, 49, false);
        return jobs.map((job) => ({ job, state }));
      }),
    );
    const seen = new Set<string>();
    return perState
      .flat()
      .filter(({ job }) => job.data.lastfm.name === userId)
      .filter(({ job }) => {
        if (seen.has(job.id!)) return false;
        seen.add(job.id!);
        return true;
      })
      .sort((a, b) => b.job.timestamp - a.job.timestamp)
      .slice(0, 50)
      .map(({ job, state }) => {
        const result = job.returnvalue as ProcessSummary | undefined;
        return {
          id: job.id!,
          state,
          createdAt: new Date(job.timestamp).toISOString(),
          finishedAt: job.finishedOn
            ? new Date(job.finishedOn).toISOString()
            : null,
          createdCount: result?.created.length ?? null,
          skippedCount: result?.skipped.length ?? null,
        };
      });
  }

  @Delete(':id')
  async cancel(
    @Session() session: AppSession,
    @Param('id') id: string,
  ): Promise<{ cancelled: true; mode: 'removed' | 'flagged' }> {
    const job = await this.ownedJob(session, id);
    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      return { cancelled: true, mode: 'removed' };
    }
    if (state === 'active') {
      const client = await this.queue.client;
      await client.set(cancelKey(id), '1', 'EX', 3600);
      return { cancelled: true, mode: 'flagged' };
    }
    throw new BadRequestException(`Job is ${state} — nothing to cancel`);
  }

  @Get(':id')
  async status(
    @Session() session: AppSession,
    @Param('id') id: string,
  ): Promise<JobSummary> {
    const job = await this.ownedJob(session, id);
    return this.summaryFrom(job);
  }

  @Sse(':id/stream')
  async stream(
    @Session() session: AppSession,
    @Param('id') id: string,
  ): Promise<Observable<MessageEvent>> {
    await this.ownedJob(session, id);

    const snapshot = async (): Promise<JobSummary | null> => {
      const job = await this.queue.getJob(id);
      return job ? this.summaryFrom(job) : null;
    };

    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;
      const emit = async () => {
        const summary = await snapshot();
        if (closed) return;
        if (!summary) {
          subscriber.complete();
          return;
        }
        subscriber.next({ data: summary });
        if (TERMINAL_JOB_STATES.has(summary.state)) subscriber.complete();
      };
      const onEvent = ({ jobId }: { jobId: string }) => {
        if (jobId === id) void emit();
      };
      this.queueEvents.on('active', onEvent);
      this.queueEvents.on('progress', onEvent);
      this.queueEvents.on('completed', onEvent);
      this.queueEvents.on('failed', onEvent);
      // Comment-typed event keeps proxies from timing out the idle stream.
      const heartbeat = setInterval(() => {
        if (!closed) subscriber.next({ type: 'ping', data: '' });
      }, SSE_HEARTBEAT_MS);
      void emit();
      return () => {
        closed = true;
        clearInterval(heartbeat);
        this.queueEvents.off('active', onEvent);
        this.queueEvents.off('progress', onEvent);
        this.queueEvents.off('completed', onEvent);
        this.queueEvents.off('failed', onEvent);
      };
    });
  }

  private async ownedJob(
    session: AppSession,
    id: string,
  ): Promise<Job<GenerateJobData>> {
    if (!session.lastfm) throw new BadRequestException('Last.fm not connected');
    const job = await this.queue.getJob(id);
    if (!job || job.data.lastfm.name !== session.lastfm.name) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return job;
  }

  private async summaryFrom(job: Job<GenerateJobData>): Promise<JobSummary> {
    const state = await job.getState();
    return {
      id: job.id!,
      state,
      progress: job.progress as { message?: string } | number,
      result: (job.returnvalue as ProcessSummary) ?? null,
      failedReason: job.failedReason,
      createdAt: new Date(job.timestamp).toISOString(),
      finishedAt: job.finishedOn
        ? new Date(job.finishedOn).toISOString()
        : null,
    };
  }
}
