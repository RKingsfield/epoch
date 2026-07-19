import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { RunningJobBadge } from '../components/RunningJobBadge';

const orbitron = localFont({
  src: '../public/fonts/orbitron-latin.woff2',
  weight: '700 900',
  variable: '--font-orbitron',
});
const jetbrains = localFont({
  src: '../public/fonts/jetbrains-mono-latin.woff2',
  weight: '400 500',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'EPOCH // your music history, etched',
  description: 'Every year, every season, every month of your listening — turned into a playlist.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${jetbrains.variable}`}
    >
      <body>
        <div className="mx-auto max-w-4xl px-6 py-10">
          <header className="mb-10 flex items-center justify-between border-b border-[var(--color-border-soft)] pb-4">
            <a href="/" className="group flex items-baseline gap-3">
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-pink)] transition group-hover:text-[var(--color-cyan)]">
                ◆ epoch
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                v0.1
              </span>
            </a>
            <nav className="flex items-center gap-5 font-mono text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
              <RunningJobBadge />
              <a href="/playlists/" className="transition hover:text-[var(--color-pink)]">
                playlists
              </a>
              <a href="/jobs/" className="transition hover:text-[var(--color-cyan)]">
                jobs
              </a>
            </nav>
          </header>
          <main>{children}</main>
          <footer className="mt-24 border-t border-[var(--color-border-soft)] pt-4 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            <span>// scrobbles in // eras out // run hot //</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
