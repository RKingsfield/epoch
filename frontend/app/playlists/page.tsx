'use client';

import { useMemo, useState } from 'react';
import { api, PlaylistSummary } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { Card, CardSubtitle, CardTitle } from '../../components/ui/Card';
import { NotConnected } from '../../components/NotConnected';

type Period = PlaylistSummary['period'];

const PERIOD_GLYPH: Record<Period, string> = {
  yearly: '◆',
  seasonal: '✦',
  monthly: '◇',
};

const ALL_PERIODS: Period[] = ['yearly', 'seasonal', 'monthly'];

function yearOf(p: PlaylistSummary): string {
  // periodKey looks like "2024", "2024-spring", "2024-03"
  const m = p.periodKey.match(/^(\d{4})/);
  return m ? m[1] : '—';
}

export default function PlaylistsPage() {
  const { data: status, error: statusError } = useApi(() => api.status(), []);
  const lastfmReady = status?.status.lastfm === 'CONNECTED';
  const { data: playlists, error: playlistsError } = useApi(
    lastfmReady ? () => api.playlists() : null,
    [lastfmReady],
  );
  const [filter, setFilter] = useState<Set<Period>>(new Set(ALL_PERIODS));

  const grouped = useMemo(() => {
    if (!playlists) return null;
    const filtered = playlists.filter((p) => filter.has(p.period));
    const byYear = new Map<string, PlaylistSummary[]>();
    for (const p of filtered) {
      const y = yearOf(p);
      const list = byYear.get(y) ?? [];
      list.push(p);
      byYear.set(y, list);
    }
    return Array.from(byYear.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [playlists, filter]);

  function togglePeriod(p: Period) {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(p)) {
        if (next.size > 1) next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  }

  const error = statusError ?? playlistsError;
  if (error) {
    return <p className="font-mono text-sm text-[var(--color-danger)]">! {error}</p>;
  }
  if (!status) {
    return (
      <p className="font-mono text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
        ▸ loading…
      </p>
    );
  }
  if (!lastfmReady) {
    return <NotConnected what="your playlists" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Vault</CardTitle>
        <CardSubtitle>
          Every playlist generated so far. Click in to see tracks or rematch a wrong pick.
        </CardSubtitle>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ALL_PERIODS.map((p) => {
            const on = filter.has(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePeriod(p)}
                className={`border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] transition ${
                  on
                    ? 'border-[var(--color-pink)] text-[var(--color-pink)]'
                    : 'border-[var(--color-border-soft)] text-[var(--color-text-muted)] hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]'
                }`}
              >
                {PERIOD_GLYPH[p]} {p}
              </button>
            );
          })}
        </div>

        {!playlists ? (
          <p className="mt-4 font-mono text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
            ▸ loading…
          </p>
        ) : playlists.length === 0 ? (
          <p className="mt-4 font-mono text-sm text-[var(--color-text-muted)]">
            No playlists yet. Engage a run from home.
          </p>
        ) : grouped && grouped.length === 0 ? (
          <p className="mt-4 font-mono text-sm text-[var(--color-text-muted)]">
            No playlists for the selected periods.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {grouped!.map(([year, items]) => (
              <div key={year}>
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-yellow)]">
                  {year} · {items.length}
                </h3>
                <ul className="mt-2 divide-y divide-[var(--color-border-soft)]">
                  {items.map((p) => (
                    <li key={p.id} className="py-3">
                      <a
                        href={`/playlist/?id=${p.id}`}
                        className="flex items-center justify-between transition hover:text-[var(--color-pink)]"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-lg text-[var(--color-pink)]">
                            {PERIOD_GLYPH[p.period]}
                          </span>
                          <span className="font-mono text-sm uppercase tracking-wider">
                            {p.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-5 font-mono text-xs text-[var(--color-text-muted)]">
                          <span>
                            <span className="text-[var(--color-cyan)]">{p.matchedCount}</span>
                            /{p.trackCount}
                          </span>
                          {p.aurralExported && (
                            <span className="text-[var(--color-yellow)]">▸ aurral</span>
                          )}
                          <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
