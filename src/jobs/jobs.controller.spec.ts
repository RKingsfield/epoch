import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { JobsController } from './jobs.controller';
import { cancelKey, GenerateJobData } from './playlist-generation.processor';
import { AppSession } from '../session/session.types';

const session = { lastfm: { name: 'testuser', key: 'k' } } as AppSession;
const anonSession = {} as AppSession;

function makeJob(opts: {
  id: string;
  user: string;
  state?: string;
  timestamp?: number;
}) {
  return {
    id: opts.id,
    timestamp: opts.timestamp ?? 0,
    finishedOn: undefined,
    progress: 0,
    returnvalue: undefined,
    failedReason: undefined,
    data: { lastfm: { name: opts.user, key: 'k' } },
    getState: jest.fn().mockResolvedValue(opts.state ?? 'completed'),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

function makeController(jobsByState: Record<string, unknown[]> = {}) {
  const redis = { set: jest.fn(), exists: jest.fn() };
  const queue = {
    getJobs: jest.fn((states: string[]) =>
      Promise.resolve(jobsByState[states[0]] ?? []),
    ),
    getJob: jest.fn(),
    client: Promise.resolve(redis),
  };
  const queueEvents = { on: jest.fn(), off: jest.fn() };
  const controller = new JobsController(
    queue as unknown as Queue<GenerateJobData>,
    queueEvents as unknown as QueueEvents,
  );
  return { controller, queue, redis };
}

describe('JobsController', () => {
  it('rejects unauthenticated list and status calls', async () => {
    const { controller } = makeController();
    await expect(controller.list(anonSession)).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.status(anonSession, '1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('lists only the session user’s jobs, newest first', async () => {
    const { controller } = makeController({
      completed: [
        makeJob({ id: 'a', user: 'testuser', timestamp: 100 }),
        makeJob({ id: 'b', user: 'someone-else', timestamp: 200 }),
      ],
      active: [
        makeJob({
          id: 'c',
          user: 'testuser',
          state: 'active',
          timestamp: 300,
        }),
      ],
    });
    const entries = await controller.list(session);
    expect(entries.map((e) => e.id)).toEqual(['c', 'a']);
  });

  it('404s status for another user’s job', async () => {
    const { controller, queue } = makeController();
    queue.getJob.mockResolvedValue(makeJob({ id: 'x', user: 'someone-else' }));
    await expect(controller.status(session, 'x')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('removes a waiting job on cancel', async () => {
    const { controller, queue } = makeController();
    const job = makeJob({ id: 'w', user: 'testuser', state: 'waiting' });
    queue.getJob.mockResolvedValue(job);
    expect(await controller.cancel(session, 'w')).toEqual({
      cancelled: true,
      mode: 'removed',
    });
    expect(job.remove).toHaveBeenCalled();
  });

  it('flags an active job for cancellation', async () => {
    const { controller, queue, redis } = makeController();
    queue.getJob.mockResolvedValue(
      makeJob({ id: 'r', user: 'testuser', state: 'active' }),
    );
    expect(await controller.cancel(session, 'r')).toEqual({
      cancelled: true,
      mode: 'flagged',
    });
    expect(redis.set).toHaveBeenCalledWith(cancelKey('r'), '1', 'EX', 3600);
  });

  it('rejects cancelling a finished job', async () => {
    const { controller, queue } = makeController();
    queue.getJob.mockResolvedValue(
      makeJob({ id: 'f', user: 'testuser', state: 'completed' }),
    );
    await expect(controller.cancel(session, 'f')).rejects.toThrow(
      BadRequestException,
    );
  });
});
