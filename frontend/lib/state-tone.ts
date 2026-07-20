export { TERMINAL_JOB_STATES, ACTIVE_JOB_STATES } from '@shared/types';

const STATE_TONE_TEXT: Record<string, string> = {
  completed: 'text-[var(--color-success)]',
  failed: 'text-[var(--color-danger)]',
  active: 'text-[var(--color-cyan)]',
  waiting: 'text-[var(--color-yellow)]',
  delayed: 'text-[var(--color-yellow)]',
};

const STATE_TONE_BORDER: Record<string, string> = {
  completed: 'text-[var(--color-success)] border-[var(--color-success)]',
  failed: 'text-[var(--color-danger)] border-[var(--color-danger)]',
  active: 'text-[var(--color-cyan)] border-[var(--color-cyan)]',
  waiting: 'text-[var(--color-yellow)] border-[var(--color-yellow)]',
  delayed: 'text-[var(--color-yellow)] border-[var(--color-yellow)]',
};

export function tone(state: string, withBorder = false): string {
  const map = withBorder ? STATE_TONE_BORDER : STATE_TONE_TEXT;
  return (
    map[state] ??
    (withBorder
      ? 'text-[var(--color-pink)] border-[var(--color-pink)]'
      : 'text-[var(--color-pink)]')
  );
}
