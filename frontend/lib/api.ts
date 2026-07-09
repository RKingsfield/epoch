export type {
  AuthStatus,
  JobSummary,
  JobsListEntry,
  SkipReason,
  SkippedEntry,
  ProcessSummary,
  PlaylistSummary,
  PlaylistDetail,
  SpotifySearchResult,
  PlaylistPeriod,
} from '@shared/types';

import type {
  AuthStatus,
  JobSummary,
  JobsListEntry,
  PlaylistSummary,
  PlaylistDetail,
  SpotifySearchResult,
  PlaylistPeriod,
} from '@shared/types';

const API_BASE = '/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  status: () => request<AuthStatus>('/status'),
  enqueue: (periods?: PlaylistPeriod[]) =>
    request<{ jobId: string; statusUrl: string }>('/jobs/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(periods ? { periods } : {}),
    }),
  job: (id: string) => request<JobSummary>(`/jobs/${id}`),
  jobs: () => request<JobsListEntry[]>('/jobs'),
  playlists: () => request<PlaylistSummary[]>('/playlists'),
  playlist: (id: string) => request<PlaylistDetail>(`/playlists/${id}`),
  spotifySearch: (q: string, limit = 8) =>
    request<SpotifySearchResult[]>(
      `/spotify/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
  rematch: (playlistId: string, position: number, spotifyTrackId: string) =>
    request<{ ok: true; propagatedTo: number }>(
      `/playlists/${playlistId}/tracks/${position}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotifyTrackId }),
      },
    ),
};
