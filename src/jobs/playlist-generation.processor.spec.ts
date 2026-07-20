import { Counter } from 'prom-client';
import { Job, Queue } from 'bullmq';
import {
  PlaylistGenerationProcessor,
  GenerateJobData,
  PLAYLIST_QUEUE,
  cancelKey,
} from './playlist-generation.processor';
import { GenerationService } from '../generation/generation.service';
import { ProcessSummary } from '../../shared/types';

function counter() {
  return { inc: jest.fn() } as unknown as Counter<string>;
}

const jobData: GenerateJobData = {
  lastfm: { name: 'testuser', key: 'k' },
  spotify: {
    access_token: 'at',
    refresh_token: 'rt',
    scope: 's',
    token_type: 'Bearer',
    expires_at: Date.now() + 60_000,
  },
};

const summary: ProcessSummary = {
  created: [{ title: 'Top of 2024', tracks: 20 }],
  skipped: [],
};

function makeProcessor(opts: {
  generateResult?: ProcessSummary | Error;
  cancelFlag?: boolean;
}) {
  const redis = {
    exists: jest.fn().mockResolvedValue(opts.cancelFlag ? 1 : 0),
  };
  const queue = {
    client: Promise.resolve(redis),
  } as unknown as Queue;
  const generation = {
    generate: opts.generateResult instanceof Error
      ? jest.fn().mockRejectedValue(opts.generateResult)
      : jest.fn().mockResolvedValue(opts.generateResult ?? summary),
  } as unknown as GenerationService;
  const completed = counter();
  const failed = counter();
  const processor = new PlaylistGenerationProcessor(
    generation,
    queue,
    completed,
    failed,
  );
  return { processor, generation, completed, failed, redis };
}

function makeJob(overrides: Partial<GenerateJobData> = {}) {
  return {
    id: 'job-1',
    data: { ...jobData, ...overrides },
    log: jest.fn().mockResolvedValue(undefined),
    updateProgress: jest.fn().mockResolvedValue(undefined),
    updateData: jest.fn().mockResolvedValue(undefined),
  } as unknown as Job<GenerateJobData, ProcessSummary>;
}

describe('PlaylistGenerationProcessor', () => {
  it('returns the generation summary and increments completed', async () => {
    const { processor, completed, failed } = makeProcessor({});
    const job = makeJob();
    const result = await processor.process(job);
    expect(result).toEqual(summary);
    expect(completed.inc).toHaveBeenCalled();
    expect(failed.inc).not.toHaveBeenCalled();
  });

  it('passes lastfm session and periods to the generation service', async () => {
    const { processor, generation } = makeProcessor({});
    const job = makeJob({ periods: ['yearly'] });
    await processor.process(job);
    expect(generation.generate).toHaveBeenCalledWith(
      jobData.lastfm,
      expect.anything(),
      expect.any(Function),
      ['yearly'],
      expect.any(Function),
    );
  });

  it('forwards progress messages to job.log and job.updateProgress', async () => {
    const { processor, generation } = makeProcessor({});
    (generation.generate as jest.Mock).mockImplementation(
      async (_lf, _ctx, onProgress) => {
        await onProgress('Building "Top of 2024"');
        return summary;
      },
    );
    const job = makeJob();
    await processor.process(job);
    expect(job.log).toHaveBeenCalledWith('Building "Top of 2024"');
    expect(job.updateProgress).toHaveBeenCalledWith({
      message: 'Building "Top of 2024"',
    });
  });

  it('increments failed counter and rethrows on generation error', async () => {
    const err = new Error('Spotify down');
    const { processor, completed, failed } = makeProcessor({
      generateResult: err,
    });
    await expect(processor.process(makeJob())).rejects.toThrow('Spotify down');
    expect(failed.inc).toHaveBeenCalled();
    expect(completed.inc).not.toHaveBeenCalled();
  });

  it('passes a shouldCancel callback that checks the Redis flag', async () => {
    const { processor, generation, redis } = makeProcessor({
      cancelFlag: true,
    });
    (generation.generate as jest.Mock).mockImplementation(
      async (_lf, _ctx, _prog, _periods, shouldCancel) => {
        const cancelled = await shouldCancel();
        if (cancelled) throw new Error('Cancelled by user');
        return summary;
      },
    );
    await expect(processor.process(makeJob())).rejects.toThrow(
      'Cancelled by user',
    );
    expect(redis.exists).toHaveBeenCalledWith(cancelKey('job-1'));
  });
});
