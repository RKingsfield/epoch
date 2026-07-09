import { LinkButton } from './ui/Button';

interface Props {
  label: string;
  connected: boolean;
  loginUrl: string;
}

export function AuthRow({ label, connected, loginUrl }: Props) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] py-4 last:border-b-0">
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className={`h-3 w-3 rounded-full ${
            connected
              ? 'bg-[var(--color-success)] live-dot'
              : 'bg-[var(--color-text-muted)]/40'
          }`}
        />
        <span className="font-mono text-sm uppercase tracking-widest">
          {label}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
          {connected ? 'connected' : 'disconnected'}
        </span>
      </div>
      <LinkButton href={loginUrl} variant={connected ? 'ghost' : 'secondary'}>
        {connected ? 're-auth' : 'jack in'}
      </LinkButton>
    </div>
  );
}
