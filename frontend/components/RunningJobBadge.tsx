'use client';

import { useEffect, useState } from 'react';
import { api, JobsListEntry } from '../lib/api';

const POLL_MS = 10_000;
const ACTIVE_STATES = new Set(['active', 'waiting', 'delayed']);
const STORAGE_KEY = 'epoch:has-active-job';

export function RunningJobBadge() {
  const [activeJob, setActiveJob] = useState<JobsListEntry | null>(null);

  useEffect(() => {
    if (!sessionStorage.getItem(STORAGE_KEY)) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const jobs = await api.jobs();
        if (!alive) return;
        const running = jobs.find((j) => ACTIVE_STATES.has(j.state)) ?? null;
        setActiveJob(running);
        if (!running) {
          sessionStorage.removeItem(STORAGE_KEY);
          return;
        }
      } catch {
        if (!alive) return;
        setActiveJob(null);
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    }

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!activeJob) return null;

  return (
    <a
      href={`/job/?id=${activeJob.id}`}
      className="flex items-center gap-2 border border-[var(--color-cyan)]/40 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-cyan)] transition hover:border-[var(--color-cyan)]"
      aria-label={`Job ${activeJob.id} is ${activeJob.state}`}
    >
      <span
        aria-hidden
        className="live-dot inline-block h-2 w-2 rounded-full bg-[var(--color-cyan)] text-[var(--color-cyan)]"
      />
      {activeJob.state}
    </a>
  );
}
