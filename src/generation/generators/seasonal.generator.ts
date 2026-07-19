import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LastfmService } from '../../lastfm/lastfm.service';
import { LastfmSessionData } from '../../session/session.types';
import { Hemisphere, seasonsBetween } from '../../utils/seasons';
import { PeriodGenerator, PeriodSpec } from '../period-generator';

@Injectable()
export class SeasonalPeriodGenerator implements PeriodGenerator {
  readonly period = 'seasonal' as const;
  readonly label = 'seasonal';
  private readonly amount: number;

  constructor(
    private readonly lastfm: LastfmService,
    private readonly config: ConfigService,
  ) {
    this.amount = parseInt(
      config.getOrThrow<string>('TOP_TRACKS_SEASONAL'),
      10,
    );
  }

  async specs(
    session: LastfmSessionData,
    startDate: Date,
    endDate: Date,
  ): Promise<PeriodSpec[]> {
    const out: PeriodSpec[] = [];
    for (const season of seasonsBetween(
      startDate,
      endDate,
      this.hemisphere(),
    )) {
      out.push({
        period: this.period,
        periodKey: `${season.name.toLowerCase()}-${season.year}`,
        title: `Top of ${season.name} ${season.year}`,
        tracks: await this.lastfm.getTopOfSeason(
          session,
          season.start,
          season.end,
          this.amount,
        ),
      });
    }
    return out;
  }

  private hemisphere(): Hemisphere {
    const v = (
      this.config.get<string>('SEASONS_HEMISPHERE') ?? 'north'
    ).toLowerCase();
    return v === 'south' ? 'south' : 'north';
  }
}
