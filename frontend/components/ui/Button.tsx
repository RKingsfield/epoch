import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';

const base =
  'inline-flex items-center justify-center gap-2 rounded-none px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.2em] transition disabled:opacity-40 disabled:cursor-not-allowed';

const variants = {
  primary:
    'bg-[var(--color-pink)] text-[var(--color-bg)] glow-pink border border-[var(--color-pink)] hover:bg-[var(--color-cyan)] hover:border-[var(--color-cyan)]',
  secondary:
    'border border-[var(--color-cyan)] text-[var(--color-cyan)] glow-cyan hover:bg-[var(--color-cyan)] hover:text-[var(--color-bg)]',
  ghost:
    'border border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-pink)] hover:border-[var(--color-border-soft)]',
};

type Variant = keyof typeof variants;

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      <span aria-hidden>[</span>
      <span>{children}</span>
      <span aria-hidden>]</span>
    </button>
  );
}

export function LinkButton({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return (
    <a className={`${base} ${variants[variant]} ${className}`} {...rest}>
      <span aria-hidden>[</span>
      <span>{children}</span>
      <span aria-hidden>]</span>
    </a>
  );
}
