export type SeasonName = 'Spring' | 'Summer' | 'Autumn' | 'Winter';
export type Hemisphere = 'north' | 'south';

export interface Season {
  name: SeasonName;
  year: number;
  start: Date;
  /** Exclusive end — first day of next season. */
  end: Date;
}

const NORTH_NAMES: SeasonName[] = ['Spring', 'Summer', 'Autumn', 'Winter'];
const SOUTH_NAMES: SeasonName[] = ['Autumn', 'Winter', 'Spring', 'Summer'];
const SEASON_START_MONTHS = [2, 5, 8, 11];

function namesFor(hemisphere: Hemisphere): SeasonName[] {
  return hemisphere === 'south' ? SOUTH_NAMES : NORTH_NAMES;
}

function seasonStartingIn(year: number, idx: number): Date {
  return new Date(year, SEASON_START_MONTHS[idx], 1);
}

function nextSeason(year: number, idx: number): { year: number; idx: number } {
  if (idx === SEASON_START_MONTHS.length - 1) return { year: year + 1, idx: 0 };
  return { year, idx: idx + 1 };
}

/**
 * Meteorological seasons (Mar/Jun/Sep/Dec starts) fully contained within
 * [start, end]. A season is named by the year it begins — "Winter 2024" runs
 * Dec 2024 – Feb 2025. Hemisphere only swaps the names; date ranges are
 * identical because the calendar is.
 */
export function seasonsBetween(
  start: Date,
  end: Date,
  hemisphere: Hemisphere = 'north',
): Season[] {
  const names = namesFor(hemisphere);
  const seasons: Season[] = [];
  let cursor = { year: start.getFullYear() - 1, idx: 0 };
  while (seasonStartingIn(cursor.year, cursor.idx) < start) {
    cursor = nextSeason(cursor.year, cursor.idx);
  }

  while (true) {
    const startsAt = seasonStartingIn(cursor.year, cursor.idx);
    const next = nextSeason(cursor.year, cursor.idx);
    const endsAt = seasonStartingIn(next.year, next.idx);
    if (endsAt > end) break;
    seasons.push({
      name: names[cursor.idx],
      year: cursor.year,
      start: startsAt,
      end: endsAt,
    });
    cursor = next;
  }

  return seasons;
}
