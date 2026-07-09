import { Module } from '@nestjs/common';
import { LastfmModule } from '../lastfm/lastfm.module';
import { SpotifyModule } from '../spotify/spotify.module';
import { AurralModule } from '../aurral/aurral.module';
import { PlaylistsModule } from '../playlists/playlists.module';
import { MetricsModule } from '../metrics/metrics.module';
import { GenerationService } from './generation.service';
import { PERIOD_GENERATORS } from './period-generator';
import { YearlyPeriodGenerator } from './generators/yearly.generator';
import { SeasonalPeriodGenerator } from './generators/seasonal.generator';
import { MonthlyPeriodGenerator } from './generators/monthly.generator';

@Module({
  imports: [
    LastfmModule,
    SpotifyModule,
    AurralModule,
    PlaylistsModule,
    MetricsModule,
  ],
  providers: [
    GenerationService,
    YearlyPeriodGenerator,
    SeasonalPeriodGenerator,
    MonthlyPeriodGenerator,
    {
      provide: PERIOD_GENERATORS,
      inject: [
        YearlyPeriodGenerator,
        SeasonalPeriodGenerator,
        MonthlyPeriodGenerator,
      ],
      useFactory: (
        yearly: YearlyPeriodGenerator,
        seasonal: SeasonalPeriodGenerator,
        monthly: MonthlyPeriodGenerator,
      ) => [yearly, seasonal, monthly],
    },
  ],
  exports: [GenerationService],
})
export class GenerationModule {}
