import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLParser } from 'fast-xml-parser';

export const lastfmXmlParser = new XMLParser({ ignoreAttributes: true });

@Injectable()
export class LastfmConfig {
  constructor(private readonly config: ConfigService) {}

  apiKey(): string {
    return this.config.getOrThrow<string>('LASTFM_API_KEY');
  }

  sharedSecret(): string {
    return this.config.getOrThrow<string>('LASTFM_SHARED_SECRET');
  }
}
