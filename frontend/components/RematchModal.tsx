'use client';

import { useEffect, useState } from 'react';
import { api, SpotifySearchResult } from '../lib/api';
import { Button } from './ui/Button';

interface Props {
  playlistId: string;
  position: number;
  artist: string;
  title: string;
  currentTrackId: string | null;
  onClose: () => void;
  onRematched: (newId: string, propagatedTo: number) => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function RematchModal({
  playlistId,
  position,
  artist,
  title,
  currentTrackId,
  onClose,
  onRematched,
}: Props) {
  const [query, setQuery] = useState(`${artist} ${title}`);
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const r = await api.spotifySearch(query);
        if (alive) {
          setResults(r);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [query]);

  async function pick(track: SpotifySearchResult) {
    setSubmitting(track.id);
    try {
      const { propagatedTo } = await api.rematch(playlistId, position, track.id);
      onRematched(track.id, propagatedTo);
      onClose();
    } catch (e) {
      setError(String(e));
      setSubmitting(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--color-bg-deep)]/85 p-4 pt-16 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-none border border-[var(--color-pink)] bg-[var(--color-surface)] p-6"
        style={{
          boxShadow:
            '0 0 30px rgba(255, 0, 110, 0.4), inset 0 0 60px rgba(255, 0, 110, 0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="section-head">Rematch</h2>
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-muted)] hover:text-[var(--color-pink)]"
            aria-label="close"
          >
            ✕ esc
          </button>
        </div>
        <p className="mt-3 font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          Scrobble: <span className="text-[var(--color-cyan)]">{title}</span> ·{' '}
          <span className="text-[var(--color-cyan)]">{artist}</span>
        </p>

        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search spotify…"
          className="mt-4 w-full rounded-none border border-[var(--color-cyan)]/40 bg-[var(--color-bg-deep)] px-3 py-2 font-mono text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-pink)] focus:outline-none"
        />

        {error && (
          <p className="mt-3 font-mono text-sm text-[var(--color-danger)]">! {error}</p>
        )}

        <div className="mt-4 max-h-96 overflow-y-auto">
          {loading ? (
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-cyan)]">
              ▸ searching…
            </p>
          ) : results.length === 0 ? (
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
              {query.trim() ? '▸ no results' : '▸ start typing'}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border-soft)]">
              {results.map((r) => {
                const isCurrent = r.id === currentTrackId;
                return (
                  <li key={r.id} className="py-2">
                    <button
                      type="button"
                      disabled={!!submitting || isCurrent}
                      onClick={() => pick(r)}
                      className="flex w-full items-center gap-3 rounded-none px-2 py-2 text-left transition hover:bg-[var(--color-surface-2)] disabled:opacity-40"
                    >
                      {r.albumArt ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.albumArt}
                          alt=""
                          className="h-12 w-12 rounded-none object-cover ring-1 ring-[var(--color-pink)]/30"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-none bg-[var(--color-surface-2)] ring-1 ring-[var(--color-border-soft)]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-sm text-[var(--color-text)]">
                          {r.name}
                        </div>
                        <div className="truncate font-mono text-xs text-[var(--color-text-muted)]">
                          {r.artists.join(', ')} · {r.album}
                        </div>
                      </div>
                      <div className="font-mono text-xs uppercase tracking-widest">
                        {isCurrent ? (
                          <span className="text-[var(--color-yellow)]">▸ current</span>
                        ) : submitting === r.id ? (
                          <span className="text-[var(--color-cyan)]">saving…</span>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">
                            {formatDuration(r.durationMs)}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
