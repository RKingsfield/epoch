import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AurralService } from './aurral.service';

@Module({
  imports: [ConfigModule],
  providers: [AurralService],
  exports: [AurralService],
})
export class AurralModule {}
