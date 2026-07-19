'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, JobSummary, SkipReason, SkippedEntry } from '../../lib/api';
import { tone, TERMINAL_STATES } from '../../lib/state-tone';

const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  already_exists: 'Already on Spotify',
  insufficient_scrobbles: 'Not enough scrobbles',
  insufficient_matches: 'Not enough Spotify matches',
  gather_error: 'Gather error',
  error: 'Error',
};

const SKIP_REASON_ORDER: SkipReason[] = [
  'already_exists',
  'insufficient_scrobbles',
  'insufficient_matches',
  'gather_error',
  'error',
];

function groupSkipped(items: SkippedEntry[]): Array<[SkipReason, SkippedEntry[]]> {
  const map = new Map<SkipReason, SkippedEntry[]>();
  for (const s of items) {
    const list = map.get(s.reason) ?? [];
    list.push(s);
    map.set(s.reason, list);
  }
  return SKIP_REASON_ORDER.filter((r) => map.has(r)).map((r) => [r, map.get(r)!]);
}
import { Card, CardSubtitle, CardTitle } from '../../components/ui/Card';
import { LinkButton } from '../../components/ui/Button';

const POLL_MS_FAST = 1500;
const POLL_MS_SLOW = 5000;
const STALL_MS = 30_000;

function StateBadge({ state }: { state: string }) {
  return (
    <span
      className={`rounded-none border px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.3em] ${tone(
        state,
        true,
      )}`}
    >
      {state}
    </span>
  );
}

const CANCELLABLE_STATES = new Set(['active', 'waiting', 'delayed']);

function JobInner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id');
  const [job, setJob] = useState<JobSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aborting, setAborting] = useState<'requesting' | 'requested' | null>(
    null,
  );
  const lastChangeRef = useRef<{ message: string | null; at: number } | null>(null);

  async function abort() {
    if (!id) return;
    setAborting('requesting');
    try {
      const { mode } = await api.cancelJob(id);
      if (mode === 'removed') {
        router.push('/jobs/');
        return;
      }
      setAborting('requested');
    } catch (e) {
      setError(String(e));
      setAborting(null);
    }
  }

  useEffect(() => {
    if (!id) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let loaded = false;
    let done = false;
    let es: EventSource | null = null;
    lastChangeRef.current = null;

    function apply(next: JobSummary) {
      loaded = true;
      setJob(next);
      setError(null);
      if (TERMINAL_STATES.has(next.state)) done = true;
      return done;
    }

    async function tick() {
      try {
        const next = await api.job(id!);
        if (!alive) return;
        if (apply(next)) return;

        const message =
          typeof next.progress === 'object' && next.progress?.message
            ? next.progress.message
            : null;
        const now = Date.now();
        const last = lastChangeRef.current;
        const changedAt =
          !last || last.message !== message
            ? ((lastChangeRef.current = { message, at: now }), now)
            : last.at;
        const stalled = now - changedAt > STALL_MS;
        timer = setTimeout(tick, stalled ? POLL_MS_SLOW : POLL_MS_FAST);
      } catch (e) {
        if (!alive) return;
        setError(String(e));
        // A blip mid-run shouldn't kill a live job view; an id that never
        // loaded won't start loading on retry, so give up on those.
        if (loaded) timer = setTimeout(tick, POLL_MS_SLOW);
      }
    }

    // Live updates via SSE, with the poll loop as fallback for anything
    // that breaks the stream (proxy buffering, old browsers, server close).
    es = new EventSource(`/api/v1/jobs/${id}/stream`);
    es.onmessage = (e) => {
      if (!alive) return;
      if (apply(JSON.parse(e.data) as JobSummary)) {
        es?.close();
        es = null;
      }
    };
    es.onerror = () => {
      if (!alive || done) return;
      es?.close();
      es = null;
      tick();
    };

    return () => {
      alive = false;
      es?.close();
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  if (!id) {
    return (
      <p className="font-mono text-sm text-[var(--color-danger)]">
        ! no job id supplied
      </p>
    );
  }
  if (error && !job) {
    return <p className="font-mono text-sm text-[var(--color-danger)]">! {error}</p>;
  }
  if (!job) {
    return (
      <p className="font-mono text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
        ▸ loading…
      </p>
    );
  }

  const message =
    typeof job.progress === 'object' && job.progress?.message
      ? job.progress.message
      : null;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Job</CardTitle>
            <p className="mt-2 font-mono text-xs text-[var(--color-text-muted)]">
              {job.id}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {CANCELLABLE_STATES.has(job.state) && (
              <button
                type="button"
                onClick={abort}
                disabled={aborting !== null}
                className="border border-[var(--color-danger)]/60 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--color-danger)] transition hover:bg-[var(--color-danger)] hover:text-[var(--color-bg)] disabled:opacity-40"
              >
                {aborting === 'requested'
                  ? 'abort requested'
                  : aborting === 'requesting'
                    ? 'aborting…'
                    : 'abort'}
              </button>
            )}
            <StateBadge state={job.state} />
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 font-mono text-xs">
          <div>
            <dt className="uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              started
            </dt>
            <dd className="mt-1 text-[var(--color-cyan)]">
              {new Date(job.createdAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              finished
            </dt>
            <dd className="mt-1 text-[var(--color-cyan)]">
              {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : '—'}
            </dd>
          </div>
        </dl>
        {error && !TERMINAL_STATES.has(job.state) && (
          <p className="mt-4 font-mono text-xs text-[var(--color-danger)]">
            ! poll failed, retrying — {error}
          </p>
        )}
        {message && !TERMINAL_STATES.has(job.state) && (
          <div className="mt-6 flex items-center gap-3 border border-[var(--color-cyan)]/40 bg-[var(--color-bg-deep)]/60 p-4">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-[var(--color-cyan)] text-[var(--color-cyan)]" />
            <span className="font-mono text-sm text-[var(--color-text)]">
              {message}
            </span>
          </div>
        )}
      </Card>

      {job.state === 'failed' && job.failedReason && (
        <Card>
          <CardTitle>Error</CardTitle>
          <pre className="mt-4 overflow-x-auto rounded-none border border-[var(--color-danger)]/60 bg-[var(--color-bg-deep)] p-4 font-mono text-xs text-[var(--color-danger)]">
            {job.failedReason}
          </pre>
        </Card>
      )}

      {job.result && (
        <>
          <Card>
            <CardTitle>Created · {job.result.created.length}</CardTitle>
            {job.result.created.length === 0 ? (
              <CardSubtitle>Nothing new — every period already has a playlist.</CardSubtitle>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--color-border-soft)]">
                {job.result.created.map((p) => (
                  <li
                    key={p.title}
                    className="flex items-center justify-between py-2 font-mono text-sm"
                  >
                    <span className="text-[var(--color-text)]">{p.title}</span>
                    <span className="text-xs text-[var(--color-cyan)]">
                      ▸ {p.tracks} tracks
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle>Skipped · {job.result.skipped.length}</CardTitle>
            <CardSubtitle>
              Already on Spotify, or not enough scrobbles or matches to bother.
            </CardSubtitle>
            {job.result.skipped.length > 0 && (
              <div className="mt-4 max-h-96 space-y-4 overflow-y-auto">
                {groupSkipped(job.result.skipped).map(([reason, items]) => (
                  <div key={reason}>
                    <h4 className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--color-yellow)]">
                      {SKIP_REASON_LABEL[reason]} · {items.length}
                    </h4>
                    <ul className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">
                      {items.map((s, i) => (
                        <li key={`${s.title}-${i}`} className="py-0.5">
                          · {s.title}
                          {s.detail && (
                            <span className="text-[var(--color-text-muted)]/60">
                              {' '}
                              ({s.detail})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <div>
        <LinkButton href="/" variant="secondary">
          ← back
        </LinkButton>
      </div>
    </div>
  );
}

export default function JobPage() {
  return (
    <Suspense
      fallback={
        <p className="font-mono text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
          ▸ booting…
        </p>
      }
    >
      <JobInner />
    </Suspense>
  );
}
