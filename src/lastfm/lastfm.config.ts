import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LastfmConfig {
  constructor(private readonly config: ConfigService) {}

  apiKey(): string {
    const v = this.config.get<string>('LASTFM_API_KEY');
    if (!v) throw new Error('LASTFM_API_KEY missing');
    return v;
  }

  sharedSecret(): string {
    const v = this.config.get<string>('LASTFM_SHARED_SECRET');
    if (!v) throw new Error('LASTFM_SHARED_SECRET missing');
    return v;
  }
}
