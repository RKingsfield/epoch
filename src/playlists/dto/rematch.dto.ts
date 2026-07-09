import { IsString, IsNotEmpty } from 'class-validator';

export class RematchDto {
  @IsString()
  @IsNotEmpty()
  spotifyTrackId!: string;
}
