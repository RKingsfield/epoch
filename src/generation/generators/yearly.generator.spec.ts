import { ConfigService } from '@nestjs/config';
import { YearlyPeriodGenerator } from './yearly.generator';
import { LastfmService } from '../../lastfm/lastfm.service';
import { LastfmSessionData } from '../../session/session.types';

const session: LastfmSessionData = { name: 'testuser', key: 'k' };

const tracks = [
  { artist: 'Burial', title: 'Archangel' },
  { artist: 'Air', title: "La Femme d'Argent" },
];

function makeGenerator() {
  const lastfm = {
    getTopOfYear: jest.fn().mockResolvedValue(tracks),
  } as unknown as LastfmService;
  const config = {
    getOrThrow: jest.fn().mockReturnValue('100'),
  } as unknown as ConfigService;
  return { gen: new YearlyPeriodGenerator(lastfm, config), lastfm };
}

describe('YearlyPeriodGenerator', () => {
  it('generates correct yearly specs', async () => {
    const { gen } = makeGenerator();
    const specs = await gen.specs(
      session,
      new Date(2021, 0, 1),
      new Date(2023, 11, 31),
    );
    expect(specs.map((s) => s.title)).toEqual([
      'Top of 2021',
      'Top of 2022',
    ]);
    expect(specs.map((s) => s.periodKey)).toEqual(['2021', '2022']);
    expect(specs.every((s) => s.period === 'yearly')).toBe(true);
    expect(specs.every((s) => s.tracks === tracks)).toBe(true);
  });

  it('excludes the current (incomplete) year', async () => {
    const { gen } = makeGenerator();
    const specs = await gen.specs(
      session,
      new Date(2024, 0, 1),
      new Date(2024, 11, 31),
    );
    expect(specs).toEqual([]);
  });

  it('passes correct args to lastfm.getTopOfYear', async () => {
    const { gen, lastfm } = makeGenerator();
    await gen.specs(session, new Date(2022, 0, 1), new Date(2023, 11, 31));
    expect(lastfm.getTopOfYear).toHaveBeenCalledWith(session, 2022, 100);
  });
});
