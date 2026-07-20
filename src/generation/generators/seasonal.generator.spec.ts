import { ConfigService } from '@nestjs/config';
import { SeasonalPeriodGenerator } from './seasonal.generator';
import { LastfmService } from '../../lastfm/lastfm.service';
import { LastfmSessionData } from '../../session/session.types';

const session: LastfmSessionData = { name: 'testuser', key: 'k' };

function makeGenerator(hemisphere: string) {
  const lastfm = {
    getTopOfSeason: jest.fn().mockResolvedValue([
      { artist: 'Burial', title: 'Archangel' },
      { artist: 'Air', title: "La Femme d'Argent" },
    ]),
  } as unknown as LastfmService;
  const values: Record<string, string> = {
    TOP_TRACKS_SEASONAL: '40',
    SEASONS_HEMISPHERE: hemisphere,
  };
  const config = {
    getOrThrow: jest.fn().mockImplementation((key: string) => values[key]),
  } as unknown as ConfigService;
  return new SeasonalPeriodGenerator(lastfm, config);
}

describe('SeasonalPeriodGenerator', () => {
  it('emits Northern season names when SEASONS_HEMISPHERE is north', async () => {
    const gen = makeGenerator('north');
    const specs = await gen.specs(
      session,
      new Date(2024, 0, 1),
      new Date(2024, 11, 31),
    );
    expect(specs.map((s) => s.title)).toEqual([
      'Top of Spring 2024',
      'Top of Summer 2024',
      'Top of Autumn 2024',
    ]);
    expect(specs[0].periodKey).toBe('spring-2024');
    expect(specs.every((s) => s.period === 'seasonal')).toBe(true);
  });

  it('emits Southern season names when SEASONS_HEMISPHERE=south', async () => {
    const gen = makeGenerator('south');
    const specs = await gen.specs(
      session,
      new Date(2024, 0, 1),
      new Date(2024, 11, 31),
    );
    expect(specs.map((s) => s.title)).toEqual([
      'Top of Autumn 2024',
      'Top of Winter 2024',
      'Top of Spring 2024',
    ]);
    expect(specs[0].periodKey).toBe('autumn-2024');
  });

  it('falls back to north for any other value', async () => {
    const gen = makeGenerator('weird-value');
    const specs = await gen.specs(
      session,
      new Date(2024, 0, 1),
      new Date(2024, 11, 31),
    );
    expect(specs[0].title).toBe('Top of Spring 2024');
  });
});
