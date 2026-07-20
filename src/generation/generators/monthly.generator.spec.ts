import { ConfigService } from '@nestjs/config';
import { MonthlyPeriodGenerator } from './monthly.generator';
import { LastfmService } from '../../lastfm/lastfm.service';
import { LastfmSessionData } from '../../session/session.types';

const session: LastfmSessionData = { name: 'testuser', key: 'k' };

function makeGenerator() {
  const lastfm = {
    getTopOfMonth: jest.fn().mockResolvedValue([
      { artist: 'Burial', title: 'Archangel' },
      { artist: 'Air', title: "La Femme d'Argent" },
    ]),
  } as unknown as LastfmService;
  const config = {
    getOrThrow: jest.fn().mockReturnValue('25'),
  } as unknown as ConfigService;
  return { gen: new MonthlyPeriodGenerator(lastfm, config), lastfm };
}

describe('MonthlyPeriodGenerator', () => {
  it('generates correct monthly specs with "Top of Mon YYYY" titles', async () => {
    const { gen } = makeGenerator();
    const specs = await gen.specs(
      session,
      new Date(2024, 0, 1),
      new Date(2024, 5, 30),
    );
    expect(specs.map((s) => s.title)).toEqual([
      'Top of Jan 2024',
      'Top of Feb 2024',
      'Top of Mar 2024',
      'Top of Apr 2024',
      'Top of May 2024',
    ]);
    expect(specs.map((s) => s.periodKey)).toEqual([
      '2024-01',
      '2024-02',
      '2024-03',
      '2024-04',
      '2024-05',
    ]);
    expect(specs.every((s) => s.period === 'monthly')).toBe(true);
  });

  it('excludes the last (incomplete) month via slice(0, -1)', async () => {
    const { gen } = makeGenerator();
    const specs = await gen.specs(
      session,
      new Date(2024, 9, 1),
      new Date(2024, 11, 15),
    );
    expect(specs.map((s) => s.title)).toEqual([
      'Top of Oct 2024',
      'Top of Nov 2024',
    ]);
  });

  it('passes session and amount to lastfm.getTopOfMonth', async () => {
    const { gen, lastfm } = makeGenerator();
    await gen.specs(session, new Date(2024, 3, 1), new Date(2024, 4, 30));
    const mock = lastfm.getTopOfMonth as jest.Mock;
    expect(mock).toHaveBeenCalledWith(session, new Date(2024, 3, 1), 25);
  });

  it('returns empty array when interval spans a single month', async () => {
    const { gen } = makeGenerator();
    const specs = await gen.specs(
      session,
      new Date(2024, 5, 1),
      new Date(2024, 5, 30),
    );
    expect(specs).toEqual([]);
  });
});
