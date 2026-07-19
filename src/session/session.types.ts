import { Session, SessionData } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    lastfm?: LastfmSessionData;
    spotify?: SpotifySessionData;
    spotifyOauthState?: string;
  }
}

export type AppSession = Session & Partial<SessionData>;

export interface LastfmSessionData {
  name: string;
  key: string;
}

export interface SpotifySessionData {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expires_at: number;
}
