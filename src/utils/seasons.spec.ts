import { seasonsBetween } from './seasons';

describe('seasonsBetween', () => {
  it('returns the four seasons of a full calendar year', () => {
    const seasons = seasonsBetween(
      new Date(2024, 0, 1),
      new Date(2025, 11, 31),
    );
    const labels = seasons.map((s) => `${s.name} ${s.year}`);
    expect(labels).toEqual([
      'Spring 2024',
      'Summer 2024',
      'Autumn 2024',
      'Winter 2024',
      'Spring 2025',
      'Summer 2025',
      'Autumn 2025',
    ]);
  });

  it('only includes seasons fully within the interval', () => {
    const seasons = seasonsBetween(
      new Date(2024, 3, 15),
      new Date(2024, 8, 15),
    );
    expect(seasons.map((s) => s.name)).toEqual(['Summer']);
  });

  it('Winter spans Dec into Feb of next year', () => {
    const seasons = seasonsBetween(
      new Date(2023, 11, 1),
      new Date(2024, 1, 28),
    );
    expect(seasons).toHaveLength(0);
    const includesEnd = seasonsBetween(
      new Date(2023, 11, 1),
      new Date(2024, 2, 1),
    );
    expect(includesEnd).toEqual([
      expect.objectContaining({
        name: 'Winter',
        year: 2023,
        start: new Date(2023, 11, 1),
        end: new Date(2024, 2, 1),
      }),
    ]);
  });

  it('returns empty for an interval shorter than any season', () => {
    expect(seasonsBetween(new Date(2024, 0, 1), new Date(2024, 1, 28))).toEqual(
      [],
    );
  });

  it('flips season names when hemisphere is south (same dates)', () => {
    const north = seasonsBetween(
      new Date(2024, 0, 1),
      new Date(2024, 11, 31),
      'north',
    );
    const south = seasonsBetween(
      new Date(2024, 0, 1),
      new Date(2024, 11, 31),
      'south',
    );
    expect(south.map((s) => s.name)).toEqual(['Autumn', 'Winter', 'Spring']);
    expect(north.map((s) => s.start)).toEqual(south.map((s) => s.start));
    expect(north.map((s) => s.end)).toEqual(south.map((s) => s.end));
  });
});
