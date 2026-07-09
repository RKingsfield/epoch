import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Session,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  GenerateJobData,
  GENERATE_JOB,
  PLAYLIST_QUEUE,
} from './playlist-generation.processor';
import { ProcessSummary, JobSummary, JobsListEntry } from '../../shared/types';
import { GenerateDto } from './dto/generate.dto';
import { AppSession } from '../session/session.types';

@Controller('jobs')
export class JobsController {
  constructor(@InjectQueue(PLAYLIST_QUEUE) private readonly queue: Queue) {}

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
      removeOnComplete: { age: 60 * 60 * 24 * 7 },
      removeOnFail: { age: 60 * 60 * 24 * 7 },
    });
    return { jobId: job.id!, statusUrl: `/api/v1/jobs/${job.id}` };
  }

  @Get()
  async list(): Promise<JobsListEntry[]> {
    const jobs = await this.queue.getJobs(
      ['completed', 'failed', 'active', 'waiting', 'delayed'],
      0,
      49,
      false,
    );
    return Promise.all(
      jobs.map(async (j) => {
        const result = j.returnvalue as ProcessSummary | undefined;
        return {
          id: j.id!,
          state: await j.getState(),
          createdAt: new Date(j.timestamp).toISOString(),
          finishedAt: j.finishedOn
            ? new Date(j.finishedOn).toISOString()
            : null,
          createdCount: result?.created.length ?? null,
          skippedCount: result?.skipped.length ?? null,
        };
      }),
    );
  }

  @Get(':id')
  async status(@Param('id') id: string): Promise<JobSummary> {
    const job = await this.queue.getJob(id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
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
