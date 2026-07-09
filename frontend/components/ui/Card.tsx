import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`relative rounded-none border border-[var(--color-border-soft)] bg-[var(--color-surface)]/70 p-6 backdrop-blur-sm ${className}`}
      style={{
        boxShadow:
          'inset 0 0 60px rgba(255, 0, 110, 0.05), 0 0 0 1px rgba(255, 0, 110, 0.05)',
      }}
      {...rest}
    />
  );
}

export function CardTitle({ className = '', ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`section-head ${className}`} {...rest} />;
}

export function CardSubtitle({ className = '', ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`mt-2 text-sm text-[var(--color-text-muted)] ${className}`}
      {...rest}
    />
  );
}
