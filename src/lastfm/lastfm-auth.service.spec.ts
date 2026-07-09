import { LastfmAuthService } from './lastfm-auth.service';
import { LastfmConfig } from './lastfm.config';
import { HttpService } from '@nestjs/axios';
import { createHash } from 'crypto';

describe('LastfmAuthService.sign', () => {
  let service: LastfmAuthService;
  const sharedSecret = 'shh-secret';

  beforeEach(() => {
    const http = {} as HttpService;
    const config = {
      apiKey: () => 'k',
      sharedSecret: () => sharedSecret,
    } as unknown as LastfmConfig;
    service = new LastfmAuthService(http, config);
  });

  it('appends an api_sig matching md5(sortedKeyValues + sharedSecret)', () => {
    const params = new URLSearchParams({
      method: 'auth.getSession',
      api_key: 'k',
      token: 'tok',
    });
    const signed = service.sign(params);
    const sigFromService = signed.get('api_sig');

    const expected = createHash('md5')
      .update('api_keykmethodauth.getSessiontokentok' + sharedSecret)
      .digest('hex');
    expect(sigFromService).toBe(expected);
  });

  it('produces the same signature regardless of insertion order', () => {
    const a = new URLSearchParams();
    a.append('method', 'auth.getSession');
    a.append('api_key', 'k');
    a.append('token', 'tok');

    const b = new URLSearchParams();
    b.append('token', 'tok');
    b.append('api_key', 'k');
    b.append('method', 'auth.getSession');

    expect(service.sign(a).get('api_sig')).toBe(service.sign(b).get('api_sig'));
  });
});
