import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import { LastfmConfig, lastfmXmlParser } from './lastfm.config';
import { LastfmSessionData } from '../session/session.types';

const LASTFM_AUTH_URL = 'https://www.last.fm/api/auth/';
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

@Injectable()
export class LastfmAuthService {
  constructor(
    private readonly http: HttpService,
    private readonly config: LastfmConfig,
  ) {}

  getAuthUrl(publicUrl: string): string {
    const params = new URLSearchParams({
      api_key: this.config.apiKey(),
      cb: `${publicUrl}/lastfm/callback`,
    });
    return `${LASTFM_AUTH_URL}?${params.toString()}`;
  }

  async exchangeToken(token: string): Promise<LastfmSessionData> {
    const params = new URLSearchParams({
      method: 'auth.getSession',
      api_key: this.config.apiKey(),
      token,
    });
    const signed = this.sign(params).toString();
    const response = await lastValueFrom(
      this.http.get(`${LASTFM_API_URL}?${signed}`),
    );
    const json = lastfmXmlParser.parse(response.data);
    return {
      name: json.lfm.session.name,
      key: json.lfm.session.key,
    };
  }

  /**
   * Last.fm's signed-call recipe: sort params alphabetically by key, concat
   * key+value pairs without separators, append the shared secret, MD5.
   */
  sign(params: URLSearchParams): URLSearchParams {
    params.sort();
    let sig = '';
    params.forEach((value, key) => {
      sig += key + value;
    });
    sig += this.config.sharedSecret();
    params.append('api_sig', createHash('md5').update(sig).digest('hex'));
    return params;
  }
}
