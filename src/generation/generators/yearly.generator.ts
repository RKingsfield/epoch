import { Injectable } from '@nestjs/common';
import { eachYearOfInterval } from 'date-fns';
import { LastfmService } from '../../lastfm/lastfm.service';
import { LastfmSessionData } from '../../session/session.types';
import { PeriodGenerator, PeriodSpec } from '../period-generator';

@Injectable()
export class YearlyPeriodGenerator implements PeriodGenerator {
  readonly period = 'yearly' as const;
  readonly label = 'yearly';

  constructor(private readonly lastfm: LastfmService) {}

  async specs(
    session: LastfmSessionData,
    startDate: Date,
    endDate: Date,
  ): Promise<PeriodSpec[]> {
    const years = eachYearOfInterval({ start: startDate, end: endDate }).slice(
      0,
      -1,
    );
    const out: PeriodSpec[] = [];
    for (const year of years) {
      const y = year.getFullYear();
      out.push({
        period: this.period,
        periodKey: String(y),
        title: `Top of ${y}`,
        tracks: await this.lastfm.getTopOfYear(session, y),
      });
    }
    return out;
  }
}
