export type PlaylistPeriod = 'yearly' | 'seasonal' | 'monthly';

export type SkipReason =
  | 'already_exists'
  | 'insufficient_scrobbles'
  | 'insufficient_matches'
  | 'gather_error'
  | 'error';

export interface SkippedEntry {
  title: string;
  reason: SkipReason;
  detail?: string;
}

export interface ProcessSummary {
  created: Array<{ title: string; tracks: number }>;
  skipped: SkippedEntry[];
}

export interface AuthStatus {
  links: { lastfm: string; spotify: string };
  status: {
    lastfm: 'CONNECTED' | 'UNCONNECTED';
    spotify: 'CONNECTED' | 'UNCONNECTED';
  };
  loginUrls: { lastfm: string; spotify: string };
}

export interface JobSummary {
  id: string;
  state: string;
  progress: { message?: string } | number;
  result: ProcessSummary | null;
  failedReason?: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface JobsListEntry {
  id: string;
  state: string;
  createdAt: string;
  finishedAt: string | null;
  createdCount: number | null;
  skippedCount: number | null;
}

export interface PlaylistSummary {
  id: string;
  title: string;
  period: PlaylistPeriod;
  periodKey: string;
  spotifyPlaylistId: string;
  aurralExported: boolean;
  trackCount: number;
  matchedCount: number;
  createdAt: string;
}

export interface PlaylistDetail extends PlaylistSummary {
  tracks: Array<{
    position: number;
    lastfmArtist: string;
    lastfmTitle: string;
    spotifyTrackId: string | null;
    manualOverride: boolean;
  }>;
}

export interface SpotifySearchResult {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  durationMs: number;
}
