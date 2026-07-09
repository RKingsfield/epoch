import { IsArray, IsEnum, IsOptional, ArrayNotEmpty } from 'class-validator';
import { PlaylistPeriod } from '../../../shared/types';

const VALID_PERIODS: PlaylistPeriod[] = ['yearly', 'seasonal', 'monthly'];

export class GenerateDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(VALID_PERIODS, {
    each: true,
    message: 'Each period must be one of: yearly, seasonal, monthly',
  })
  periods?: PlaylistPeriod[];
}
