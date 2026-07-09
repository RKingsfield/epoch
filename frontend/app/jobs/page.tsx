'use client';

import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { tone } from '../../lib/state-tone';
import { Card, CardSubtitle, CardTitle } from '../../components/ui/Card';
import { NotConnected } from '../../components/NotConnected';

export default function JobsListPage() {
  const { data: status, error: statusError } = useApi(() => api.status(), []);
  const ready =
    status?.status.lastfm === 'CONNECTED' && status?.status.spotify === 'CONNECTED';
  const { data: jobs, error: jobsError } = useApi(
    ready ? () => api.jobs() : null,
    [ready],
  );

  const error = statusError ?? jobsError;
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
  if (!ready) {
    return <NotConnected what="the job log" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Job log</CardTitle>
        <CardSubtitle>The last 50 runs. Older entries are dropped from the queue.</CardSubtitle>
        {!jobs ? (
          <p className="mt-4 font-mono text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
            ▸ loading…
          </p>
        ) : jobs.length === 0 ? (
          <p className="mt-4 font-mono text-sm text-[var(--color-text-muted)]">
            No jobs yet. Engage a run from home.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-border-soft)]">
            {jobs.map((j) => {
              return (
                <li key={j.id} className="py-3">
                  <a
                    href={`/job/?id=${j.id}`}
                    className="flex items-center justify-between font-mono text-sm transition hover:text-[var(--color-pink)]"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {j.id.slice(0, 8)}
                      </span>
                      <span className={`text-[11px] uppercase tracking-[0.3em] ${tone(j.state)}`}>
                        ▸ {j.state}
                      </span>
                    </div>
                    <div className="flex items-center gap-5 text-xs text-[var(--color-text-muted)]">
                      {j.createdCount !== null && (
                        <span>
                          <span className="text-[var(--color-success)]">+{j.createdCount}</span>{' '}
                          /{' '}
                          <span className="text-[var(--color-yellow)]">−{j.skippedCount}</span>
                        </span>
                      )}
                      <span>{new Date(j.createdAt).toLocaleString()}</span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
