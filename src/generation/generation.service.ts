import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import {
  SpotifyService,
  SimplifiedPlaylistObj,
} from '../spotify/spotify.service';
import { SpotifyTokenContext } from '../spotify/spotify-token.context';
import { AurralService } from '../aurral/aurral.service';
import { LastfmService, Track } from '../lastfm/lastfm.service';
import { PlaylistsService } from '../playlists/playlists.service';
import { PlaylistPeriod, ProcessSummary } from '../../shared/types';
import { LastfmSessionData } from '../session/session.types';
import {
  METRIC_PLAYLISTS_CREATED,
  METRIC_PLAYLISTS_SKIPPED,
  METRIC_TRACKS_MATCHED,
  METRIC_TRACKS_UNMATCHED,
} from '../metrics/metrics.module';
import {
  PERIOD_GENERATORS,
  PeriodGenerator,
  PeriodSpec,
} from './period-generator';
import { errorMessage } from '../utils/errors';
import { ConfigService } from '@nestjs/config';

export type ProgressReporter = (msg: string) => Promise<void> | void;

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);
  private readonly minLastfmTracks: number;
  private readonly minTracksForPlaylist: number;

  constructor(
    config: ConfigService,
    private readonly lastfm: LastfmService,
    private readonly spotify: SpotifyService,
    private readonly aurral: AurralService,
    private readonly playlists: PlaylistsService,
    @Inject(PERIOD_GENERATORS) private readonly generators: PeriodGenerator[],
    @InjectMetric(METRIC_PLAYLISTS_CREATED)
    private readonly playlistsCreated: Counter<string>,
    @InjectMetric(METRIC_PLAYLISTS_SKIPPED)
    private readonly playlistsSkipped: Counter<string>,
    @InjectMetric(METRIC_TRACKS_MATCHED)
    private readonly tracksMatched: Counter<string>,
    @InjectMetric(METRIC_TRACKS_UNMATCHED)
    private readonly tracksUnmatched: Counter<string>,
  ) {
    this.minLastfmTracks = parseInt(
      config.getOrThrow<string>('MIN_LASTFM_TRACKS'),
      10,
    );
    this.minTracksForPlaylist = parseInt(
      config.getOrThrow<string>('MIN_TRACKS_FOR_PLAYLIST'),
      10,
    );
  }

  async generate(
    lastfm: LastfmSessionData,
    ctx: SpotifyTokenContext,
    onProgress: ProgressReporter = () => {},
    periods?: PlaylistPeriod[],
    shouldCancel: () => Promise<boolean> = async () => false,
  ): Promise<ProcessSummary> {
    const userData = await this.lastfm.getUserData(lastfm);
    const startDate = new Date(Number(userData.registered) * 1000);
    const endDate = new Date();
    const existing = await this.spotify.getMyPlaylists(ctx);

    const filter = periods && periods.length > 0 ? new Set(periods) : null;
    const summary: ProcessSummary = { created: [], skipped: [] };
    for (const generator of this.generators) {
      if (filter && !filter.has(generator.period)) continue;
      if (await shouldCancel()) throw new Error('Cancelled by user');
      await onProgress(`Generating ${generator.label} playlists`);
      let specs: PeriodSpec[];
      try {
        specs = await generator.specs(lastfm, startDate, endDate);
      } catch (err: unknown) {
        this.logger.error(
          `Failed to gather ${generator.label} specs: ${errorMessage(err)}`,
        );
        summary.skipped.push({
          title: generator.label,
          reason: 'gather_error',
          detail: errorMessage(err),
        });
        continue;
      }
      for (const spec of specs) {
        // Outside the try — cancellation must abort the run, not get
        // recorded as a per-spec error and carry on.
        if (await shouldCancel()) throw new Error('Cancelled by user');
        try {
          await this.tryCreate(
            lastfm.name,
            ctx,
            existing,
            spec,
            summary,
            onProgress,
          );
        } catch (err: unknown) {
          this.logger.error(
            `Failed to process "${spec.title}": ${errorMessage(err)}`,
          );
          summary.skipped.push({
            title: spec.title,
            reason: 'error',
            detail: errorMessage(err),
          });
        }
      }
    }
    return summary;
  }

  private async tryCreate(
    userId: string,
    ctx: SpotifyTokenContext,
    existing: SimplifiedPlaylistObj[],
    spec: PeriodSpec,
    summary: ProcessSummary,
    onProgress: ProgressReporter,
  ): Promise<void> {
    const existingMatch = existing.find((p) => p.name === spec.title);
    if (existingMatch) {
      // Heal the vault: if a previous run created the Spotify playlist but
      // the DB write failed, the playlist would otherwise stay invisible
      // forever — it's skipped here on every run and never re-recorded.
      let detail: string | undefined;
      if (
        !(await this.playlists.hasRecord(userId, spec.period, spec.periodKey))
      ) {
        const matches = await this.matchTracks(ctx, spec.tracks);
        await this.playlists.record({
          userId,
          title: spec.title,
          period: spec.period,
          periodKey: spec.periodKey,
          spotifyPlaylistId: existingMatch.id,
          aurralExported: false,
          tracks: matches,
        });
        detail = 'restored missing record';
      }
      summary.skipped.push({
        title: spec.title,
        reason: 'already_exists',
        detail,
      });
      this.playlistsSkipped.inc({ reason: 'already_exists' });
      return;
    }
    if (spec.tracks.length < this.minLastfmTracks) {
      summary.skipped.push({
        title: spec.title,
        reason: 'insufficient_scrobbles',
        detail: `${spec.tracks.length} scrobbles`,
      });
      this.playlistsSkipped.inc({ reason: 'insufficient_scrobbles' });
      return;
    }

    await onProgress(`Building "${spec.title}"`);
    const matches = await this.matchTracks(ctx, spec.tracks);

    const matchedIds = matches
      .map((m) => m.spotifyTrackId)
      .filter((id): id is string => Boolean(id));

    if (matchedIds.length < this.minTracksForPlaylist) {
      summary.skipped.push({
        title: spec.title,
        reason: 'insufficient_matches',
        detail: `${matchedIds.length} matched`,
      });
      this.playlistsSkipped.inc({ reason: 'insufficient_matches' });
      return;
    }

    const { spotifyPlaylistId } = await this.spotify.createPlaylist(
      ctx,
      spec.title,
      matchedIds,
    );

    let aurralExported = false;
    if (this.aurral.enabled()) {
      await this.aurral.export(spec.title, spec.tracks);
      aurralExported = true;
    }

    try {
      await this.playlists.record({
        userId,
        title: spec.title,
        period: spec.period,
        periodKey: spec.periodKey,
        spotifyPlaylistId,
        aurralExported,
        tracks: matches,
      });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to persist playlist record for "${spec.title}": ${errorMessage(err)}`,
      );
      summary.created.push({ title: spec.title, tracks: matchedIds.length });
      summary.skipped.push({
        title: spec.title,
        reason: 'error',
        detail: 'Spotify playlist created but DB record failed — will heal on next run',
      });
      this.playlistsCreated.inc({ period: spec.period });
      return;
    }

    summary.created.push({ title: spec.title, tracks: matchedIds.length });
    this.playlistsCreated.inc({ period: spec.period });
  }

  private async matchTracks(
    ctx: SpotifyTokenContext,
    tracks: Track[],
  ): Promise<
    Array<{
      lastfmArtist: string;
      lastfmTitle: string;
      spotifyTrackId: string | null;
    }>
  > {
    const results = await Promise.all(
      tracks.map(async (track) => {
        const id = await this.spotify.findTrackId(
          ctx,
          track.artist,
          track.title,
        );
        if (id) {
          this.tracksMatched.inc();
        } else {
          this.tracksUnmatched.inc();
        }
        return {
          lastfmArtist: track.artist,
          lastfmTitle: track.title,
          spotifyTrackId: id,
        };
      }),
    );
    return results;
  }
}
