import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eachMonthOfInterval } from 'date-fns';
import { LastfmService } from '../../lastfm/lastfm.service';
import { LastfmSessionData } from '../../session/session.types';
import { PeriodGenerator, PeriodSpec } from '../period-generator';

@Injectable()
export class MonthlyPeriodGenerator implements PeriodGenerator {
  readonly period = 'monthly' as const;
  readonly label = 'monthly';
  private readonly amount: number;

  constructor(
    private readonly lastfm: LastfmService,
    config: ConfigService,
  ) {
    this.amount = parseInt(config.getOrThrow<string>('TOP_TRACKS_MONTHLY'), 10);
  }

  async specs(
    session: LastfmSessionData,
    startDate: Date,
    endDate: Date,
  ): Promise<PeriodSpec[]> {
    const months = eachMonthOfInterval({
      start: startDate,
      end: endDate,
    }).slice(0, -1);
    const out: PeriodSpec[] = [];
    for (const date of months) {
      // Fixed locale — titles feed the skip-if-exists check, so they must
      // never vary with the server's locale.
      const monthShort = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      out.push({
        period: this.period,
        periodKey: `${year}-${month}`,
        title: `Top of ${monthShort} ${year}`,
        tracks: await this.lastfm.getTopOfMonth(session, date, this.amount),
      });
    }
    return out;
  }
}
