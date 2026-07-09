import { Injectable } from '@nestjs/common';
import { eachMonthOfInterval } from 'date-fns';
import { LastfmService } from '../../lastfm/lastfm.service';
import { LastfmSessionData } from '../../session/session.types';
import { PeriodGenerator, PeriodSpec } from '../period-generator';

@Injectable()
export class MonthlyPeriodGenerator implements PeriodGenerator {
  readonly period = 'monthly' as const;
  readonly label = 'monthly';

  constructor(private readonly lastfm: LastfmService) {}

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
      const monthShort = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      out.push({
        period: this.period,
        periodKey: `${year}-${month}`,
        title: `Top of ${monthShort} ${year}`,
        tracks: await this.lastfm.getTopOfMonth(session, date),
      });
    }
    return out;
  }
}
