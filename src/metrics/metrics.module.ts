import { Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
} from '@willsoto/nestjs-prometheus';

export const METRIC_PLAYLISTS_CREATED = 'epoch_playlists_created_total';
export const METRIC_PLAYLISTS_SKIPPED = 'epoch_playlists_skipped_total';
export const METRIC_TRACKS_MATCHED = 'epoch_tracks_matched_total';
export const METRIC_TRACKS_UNMATCHED = 'epoch_tracks_unmatched_total';
export const METRIC_JOBS_COMPLETED = 'epoch_jobs_completed_total';
export const METRIC_JOBS_FAILED = 'epoch_jobs_failed_total';

const counters = [
  makeCounterProvider({
    name: METRIC_PLAYLISTS_CREATED,
    help: 'Spotify playlists epoch has created',
    labelNames: ['period'],
  }),
  makeCounterProvider({
    name: METRIC_PLAYLISTS_SKIPPED,
    help: 'Candidate playlists skipped (already existed or insufficient tracks)',
    labelNames: ['reason'],
  }),
  makeCounterProvider({
    name: METRIC_TRACKS_MATCHED,
    help: 'Last.fm tracks successfully matched to a Spotify track',
  }),
  makeCounterProvider({
    name: METRIC_TRACKS_UNMATCHED,
    help: "Last.fm tracks epoch couldn't find on Spotify",
  }),
  makeCounterProvider({
    name: METRIC_JOBS_COMPLETED,
    help: 'BullMQ playlist-generation jobs that finished successfully',
  }),
  makeCounterProvider({
    name: METRIC_JOBS_FAILED,
    help: 'BullMQ playlist-generation jobs that failed',
  }),
];

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      defaultLabels: { app: 'epoch' },
    }),
  ],
  providers: counters,
  exports: counters,
})
export class MetricsModule {}
