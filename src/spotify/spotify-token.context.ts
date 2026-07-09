import { Job } from 'bullmq';
import { Session, SessionData } from 'express-session';
import { SpotifySessionData } from '../session/session.types';

export interface SpotifyTokenContext {
  get(): SpotifySessionData;
  set(tokens: SpotifySessionData): Promise<void>;
}

export class SessionTokenContext implements SpotifyTokenContext {
  constructor(private readonly session: Session & Partial<SessionData>) {
    if (!session.spotify) {
      throw new Error('No Spotify session');
    }
  }

  get(): SpotifySessionData {
    return this.session.spotify!;
  }

  async set(tokens: SpotifySessionData): Promise<void> {
    this.session.spotify = tokens;
    await new Promise<void>((resolve, reject) =>
      this.session.save((err) => (err ? reject(err) : resolve())),
    );
  }
}

export interface JobTokenSnapshot {
  spotify: SpotifySessionData;
}

export class JobTokenContext implements SpotifyTokenContext {
  constructor(private readonly job: Job<JobTokenSnapshot, unknown>) {}

  get(): SpotifySessionData {
    return this.job.data.spotify;
  }

  async set(tokens: SpotifySessionData): Promise<void> {
    this.job.data.spotify = tokens;
    await this.job.updateData(this.job.data);
  }
}
