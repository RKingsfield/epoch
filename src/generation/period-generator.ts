import { Track } from '../lastfm/lastfm.service';
import { LastfmSessionData } from '../session/session.types';
import { PlaylistPeriod } from '../../shared/types';

export const PERIOD_GENERATORS = Symbol('PERIOD_GENERATORS');

export interface PeriodSpec {
  period: PlaylistPeriod;
  periodKey: string;
  title: string;
  tracks: Track[];
}

/**
 * Adds a new playlist period (e.g. weekly) by implementing this interface
 * and registering the class in GenerationModule's providers + multi-token.
 */
export interface PeriodGenerator {
  readonly period: PlaylistPeriod;
  readonly label: string;
  specs(
    lastfm: LastfmSessionData,
    startDate: Date,
    endDate: Date,
  ): Promise<PeriodSpec[]>;
}
