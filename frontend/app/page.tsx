'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Card, CardSubtitle, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AuthRow } from '../components/AuthRow';

type Period = 'yearly' | 'seasonal' | 'monthly';
const PERIOD_LABELS: Array<{ key: Period; label: string; sub: string }> = [
  { key: 'yearly', label: 'YEARLY', sub: '"Top of 2024"' },
  { key: 'seasonal', label: 'SEASONAL', sub: '"Top of Spring 2024"' },
  { key: 'monthly', label: 'MONTHLY', sub: '"Top of Mar 2024"' },
];

export default function HomePage() {
  const router = useRouter();
  const { data: status, error: statusError } = useApi(() => api.status(), []);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Set<Period>>(
    new Set(['yearly', 'seasonal', 'monthly']),
  );

  const error = submitError ?? statusError;
  const ready =
    status?.status.lastfm === 'CONNECTED' && status?.status.spotify === 'CONNECTED';

  function toggle(p: Period) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function generate() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const periods = Array.from(selected);
      const arg = periods.length === 3 ? undefined : periods;
      const { jobId } = await api.enqueue(arg);
      sessionStorage.setItem('epoch:has-active-job', '1');
      router.push(`/job/?id=${jobId}`);
    } catch (e) {
      setSubmitError(String(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="py-2 text-center">
        <h1 className="wordmark flicker">EPOCH</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)]">
          Every year, season, and month of your scrobbles, turned into a Spotify playlist.
        </p>
      </section>

      <Card>
        <CardTitle>Connections</CardTitle>
        <CardSubtitle>Connect both, then generate.</CardSubtitle>
        <div className="mt-4">
          {status ? (
            <>
              <AuthRow
                label="Last.fm"
                connected={status.status.lastfm === 'CONNECTED'}
                loginUrl={status.loginUrls.lastfm}
              />
              <AuthRow
                label="Spotify"
                connected={status.status.spotify === 'CONNECTED'}
                loginUrl={status.loginUrls.spotify}
              />
            </>
          ) : statusError ? (
            <p className="font-mono text-sm text-[var(--color-danger)]">{statusError}</p>
          ) : (
            <p className="font-mono text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
              ▸ checking…
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Engage</CardTitle>
        <CardSubtitle>
          Pick which periods to generate. Playlists that already exist on Spotify are left alone.
        </CardSubtitle>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PERIOD_LABELS.map(({ key, label, sub }) => {
            const on = selected.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className={`group flex items-start gap-3 border p-3 text-left transition ${
                  on
                    ? 'border-[var(--color-pink)] bg-[var(--color-pink)]/10'
                    : 'border-[var(--color-border-soft)] hover:border-[var(--color-cyan)]'
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 inline-block h-3 w-3 border ${
                    on
                      ? 'border-[var(--color-pink)] bg-[var(--color-pink)]'
                      : 'border-[var(--color-text-muted)]'
                  }`}
                />
                <span className="flex-1">
                  <span
                    className={`block font-mono text-xs font-bold tracking-[0.2em] ${
                      on ? 'text-[var(--color-pink)]' : 'text-[var(--color-text)]'
                    }`}
                  >
                    {label}
                  </span>
                  <span className="block font-mono text-[11px] text-[var(--color-text-muted)]">
                    {sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-4">
          <Button
            onClick={generate}
            disabled={!ready || submitting || selected.size === 0}
          >
            {submitting ? 'queuing…' : 'engage'}
          </Button>
          {!ready && status && (
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
              ▸ connect both first
            </span>
          )}
          {ready && selected.size === 0 && (
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--color-yellow)]">
              ▸ pick at least one
            </span>
          )}
        </div>
        {error && submitting === false && (
          <p className="mt-4 font-mono text-sm text-[var(--color-danger)]">
            ! {error}
          </p>
        )}
      </Card>
    </div>
  );
}
