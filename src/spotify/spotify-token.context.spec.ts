import { Job } from 'bullmq';
import { Session, SessionData } from 'express-session';
import {
  JobTokenContext,
  JobTokenSnapshot,
  SessionTokenContext,
} from './spotify-token.context';
import { SpotifySessionData } from '../session/session.types';

const tokens = (
  overrides: Partial<SpotifySessionData> = {},
): SpotifySessionData => ({
  access_token: 'a',
  refresh_token: 'r',
  scope: 's',
  token_type: 'Bearer',
  expires_at: Date.now() + 60_000,
  ...overrides,
});

describe('SessionTokenContext', () => {
  it('throws if the session has no spotify data', () => {
    const session = { save: jest.fn() } as unknown as Session &
      Partial<SessionData>;
    expect(() => new SessionTokenContext(session)).toThrow(
      /No Spotify session/,
    );
  });

  it('reads and writes through to the session, calling save()', async () => {
    const save = jest.fn((cb: (err?: Error) => void) => cb());
    const session = { spotify: tokens(), save } as unknown as Session &
      Partial<SessionData>;
    const ctx = new SessionTokenContext(session);
    expect(ctx.get().access_token).toBe('a');

    const next = tokens({ access_token: 'b' });
    await ctx.set(next);
    expect(session.spotify).toEqual(next);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('rejects when session.save() reports an error', async () => {
    const save = jest.fn((cb: (err?: Error) => void) =>
      cb(new Error('redis down')),
    );
    const session = { spotify: tokens(), save } as unknown as Session &
      Partial<SessionData>;
    const ctx = new SessionTokenContext(session);
    await expect(ctx.set(tokens())).rejects.toThrow(/redis down/);
  });
});

describe('JobTokenContext', () => {
  it('reads from job.data and persists via updateData', async () => {
    const initial = tokens();
    const updateData = jest.fn().mockResolvedValue(undefined);
    const job = {
      data: { spotify: initial } as JobTokenSnapshot,
      updateData,
    } as unknown as Job<JobTokenSnapshot, unknown>;

    const ctx = new JobTokenContext(job);
    expect(ctx.get()).toEqual(initial);

    const next = tokens({ access_token: 'b' });
    await ctx.set(next);
    expect(updateData).toHaveBeenCalledWith(
      expect.objectContaining({ spotify: next }),
    );
  });
});
