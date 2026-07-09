'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, PlaylistDetail } from '../../lib/api';
import { Card, CardSubtitle, CardTitle } from '../../components/ui/Card';
import { LinkButton } from '../../components/ui/Button';
import { RematchModal } from '../../components/RematchModal';

interface ActiveRematch {
  position: number;
  artist: string;
  title: string;
  currentTrackId: string | null;
}

function PlaylistInner() {
  const params = useSearchParams();
  const id = params.get('id');
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveRematch | null>(null);
  const [lastPropagation, setLastPropagation] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    api
      .playlist(id)
      .then((p) => alive && setPlaylist(p))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (lastPropagation === null) return;
    const t = setTimeout(() => setLastPropagation(null), 6000);
    return () => clearTimeout(t);
  }, [lastPropagation]);

  function handleRematched(
    position: number,
    newTrackId: string,
    propagatedTo: number,
  ) {
    setPlaylist((prev) =>
      prev
        ? {
            ...prev,
            tracks: prev.tracks.map((t) =>
              t.position === position
                ? { ...t, spotifyTrackId: newTrackId, manualOverride: true }
                : t,
            ),
            matchedCount:
              prev.tracks.find((t) => t.position === position)?.spotifyTrackId
                ? prev.matchedCount
                : prev.matchedCount + 1,
          }
        : prev,
    );
    setLastPropagation(propagatedTo);
  }

  if (!id)
    return (
      <p className="font-mono text-sm text-[var(--color-danger)]">
        ! no playlist id
      </p>
    );
  if (error)
    return <p className="font-mono text-sm text-[var(--color-danger)]">! {error}</p>;
  if (!playlist)
    return (
      <p className="font-mono text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
        ▸ loading…
      </p>
    );

  const unmatchedCount = playlist.trackCount - playlist.matchedCount;
  const spotifyUrl = `https://open.spotify.com/playlist/${playlist.spotifyPlaylistId}`;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{playlist.title}</CardTitle>
            <CardSubtitle>
              <span className="text-[var(--color-cyan)]">{playlist.matchedCount}</span>{' '}
              of {playlist.trackCount} matched on Spotify
              {playlist.aurralExported && ' · also exported to aurral'}
            </CardSubtitle>
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-yellow)]">
            {playlist.periodKey}
          </span>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <LinkButton
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
          >
            open on spotify ↗
          </LinkButton>
          <LinkButton href="/playlists/" variant="ghost">
            ← vault
          </LinkButton>
        </div>
      </Card>

      <Card>
        <CardTitle>Tracks</CardTitle>
        <CardSubtitle>
          From your scrobbles. Wrong match? Hit{' '}
          <span className="text-[var(--color-pink)]">rematch</span> — it swaps
          the track here, locks it as canonical, and fixes every other playlist
          where the same scrobble showed up.
        </CardSubtitle>
        {unmatchedCount > 0 && (
          <p className="mt-3 font-mono text-xs text-[var(--color-danger)]">
            ● {unmatchedCount} unmatched
          </p>
        )}
        {lastPropagation !== null && (
          <p className="mt-3 font-mono text-xs uppercase tracking-widest text-[var(--color-cyan)]">
            ▸ canonical match saved
            {lastPropagation > 0
              ? ` · also propagated to ${lastPropagation} other playlist${lastPropagation === 1 ? '' : 's'}`
              : ' · no other playlists needed updating'}
          </p>
        )}
        <ul className="mt-4 divide-y divide-[var(--color-border-soft)]">
          {playlist.tracks.map((t) => {
            const matched = !!t.spotifyTrackId;
            return (
              <li
                key={t.position}
                className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 py-3"
              >
                <span className="font-mono text-xs text-[var(--color-text-muted)]">
                  {String(t.position + 1).padStart(2, '0')}
                </span>
                <div>
                  <div className="font-mono text-sm text-[var(--color-text)]">
                    {t.lastfmTitle}
                    {t.manualOverride && (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.3em] text-[var(--color-yellow)]">
                        manual
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-[var(--color-text-muted)]">
                    {t.lastfmArtist}
                  </div>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs">
                  {matched ? (
                    <a
                      href={`https://open.spotify.com/track/${t.spotifyTrackId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-cyan)] hover:text-[var(--color-pink)]"
                    >
                      open ↗
                    </a>
                  ) : (
                    <span className="text-[var(--color-danger)]">no match</span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setActive({
                        position: t.position,
                        artist: t.lastfmArtist,
                        title: t.lastfmTitle,
                        currentTrackId: t.spotifyTrackId,
                      })
                    }
                    className="uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-pink)]"
                  >
                    rematch
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {active && (
        <RematchModal
          playlistId={id}
          position={active.position}
          artist={active.artist}
          title={active.title}
          currentTrackId={active.currentTrackId}
          onClose={() => setActive(null)}
          onRematched={(newId, propagatedTo) =>
            handleRematched(active.position, newId, propagatedTo)
          }
        />
      )}
    </div>
  );
}

export default function PlaylistPage() {
  return (
    <Suspense
      fallback={
        <p className="font-mono text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
          ▸ loading…
        </p>
      }
    >
      <PlaylistInner />
    </Suspense>
  );
}
