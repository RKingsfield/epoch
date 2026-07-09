import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import {
  SpotifyService,
  SimplifiedPlaylistObj,
} from '../spotify/spotify.service';
import { SpotifyTokenContext } from '../spotify/spotify-token.context';
import { AurralService } from '../aurral/aurral.service';
import { LastfmService } from '../lastfm/lastfm.service';
import { PlaylistsService } from '../playlists/playlists.service';
import {
  PlaylistPeriod,
  SkipReason,
  SkippedEntry,
  ProcessSummary,
} from '../../shared/types';
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

const MIN_TRACKS_FOR_PLAYLIST = 10;
const MIN_LASTFM_TRACKS = 5;

export type ProgressReporter = (msg: string) => Promise<void> | void;

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
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
  ) {}

  async generate(
    lastfm: LastfmSessionData,
    ctx: SpotifyTokenContext,
    onProgress: ProgressReporter = () => {},
    periods?: PlaylistPeriod[],
  ): Promise<ProcessSummary> {
    const userData = await this.lastfm.getUserData(lastfm);
    const startDate = new Date(Number(userData.registered) * 1000);
    const endDate = new Date();
    const existing = await this.spotify.getMyPlaylists(ctx);

    const filter = periods && periods.length > 0 ? new Set(periods) : null;
    const summary: ProcessSummary = { created: [], skipped: [] };
    for (const generator of this.generators) {
      if (filter && !filter.has(generator.period)) continue;
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
    if (existing.find((p) => p.name === spec.title)) {
      summary.skipped.push({ title: spec.title, reason: 'already_exists' });
      this.playlistsSkipped.inc({ reason: 'already_exists' });
      return;
    }
    if (spec.tracks.length < MIN_LASTFM_TRACKS) {
      summary.skipped.push({
        title: spec.title,
        reason: 'insufficient_scrobbles',
        detail: `${spec.tracks.length} scrobbles`,
      });
      this.playlistsSkipped.inc({ reason: 'insufficient_scrobbles' });
      return;
    }

    await onProgress(`Building "${spec.title}"`);
    const matches: Array<{
      lastfmArtist: string;
      lastfmTitle: string;
      spotifyTrackId: string | null;
    }> = [];
    for (const track of spec.tracks) {
      const id = await this.spotify.findTrackId(ctx, track.artist, track.title);
      matches.push({
        lastfmArtist: track.artist,
        lastfmTitle: track.title,
        spotifyTrackId: id,
      });
      if (id) {
        this.tracksMatched.inc();
      } else {
        this.tracksUnmatched.inc();
      }
    }

    const matchedIds = matches
      .map((m) => m.spotifyTrackId)
      .filter((id): id is string => Boolean(id));

    if (matchedIds.length < MIN_TRACKS_FOR_PLAYLIST) {
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
    }

    summary.created.push({ title: spec.title, tracks: matchedIds.length });
    this.playlistsCreated.inc({ period: spec.period });
  }
}
