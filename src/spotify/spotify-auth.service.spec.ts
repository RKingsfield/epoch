import { SpotifyAuthService } from './spotify-auth.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';

const CLIENT_ID = 'test-client-id';
const CLIENT_SECRET = 'test-client-secret';

function mockConfigService(): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'SPOTIFY_CLIENT_ID') return CLIENT_ID;
      if (key === 'SPOTIFY_CLIENT_SECRET') return CLIENT_SECRET;
      throw new Error(`unexpected config key: ${key}`);
    }),
  } as unknown as ConfigService;
}

function tokenResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'acc-tok',
    refresh_token: 'ref-tok',
    expires_in: 3600,
    scope: 'playlist-modify-private',
    token_type: 'Bearer',
    ...overrides,
  };
}

function axiosOk(data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config: {} } as AxiosResponse;
}

describe('SpotifyAuthService', () => {
  let service: SpotifyAuthService;
  let httpPost: jest.Mock;

  beforeEach(() => {
    httpPost = jest.fn();
    const http = { post: httpPost } as unknown as HttpService;
    service = new SpotifyAuthService(http, mockConfigService());
  });

  describe('exchangeCode', () => {
    it('returns session data from a successful token exchange', async () => {
      httpPost.mockReturnValue(of(axiosOk(tokenResponse())));
      const now = Date.now();

      const result = await service.exchangeCode('the-code', 'http://localhost/callback');

      expect(result.access_token).toBe('acc-tok');
      expect(result.refresh_token).toBe('ref-tok');
      expect(result.scope).toBe('playlist-modify-private');
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_at).toBeGreaterThanOrEqual(now + 3600 * 1000 - 100);

      const [url, body, opts] = httpPost.mock.calls[0];
      expect(url).toBe('https://accounts.spotify.com/api/token');
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('code=the-code');
      expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(opts.headers['Authorization']).toMatch(/^Basic /);
    });

    it('throws when the response has no refresh_token', async () => {
      httpPost.mockReturnValue(of(axiosOk(tokenResponse({ refresh_token: undefined }))));

      await expect(service.exchangeCode('code', 'http://x')).rejects.toThrow(
        'missing refresh_token',
      );
    });
  });

  describe('refresh', () => {
    it('returns new session data on success', async () => {
      httpPost.mockReturnValue(of(axiosOk(tokenResponse({ access_token: 'new-acc' }))));

      const result = await service.refresh('old-ref');

      expect(result.access_token).toBe('new-acc');
      expect(result.refresh_token).toBe('ref-tok');

      const [, body] = httpPost.mock.calls[0];
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=old-ref');
    });

    it('preserves the old refresh_token when the response omits one', async () => {
      httpPost.mockReturnValue(
        of(axiosOk(tokenResponse({ refresh_token: undefined }))),
      );

      const result = await service.refresh('keep-me');

      expect(result.refresh_token).toBe('keep-me');
    });
  });

  describe('getAuthUrl', () => {
    it('returns a URL with the expected query params', () => {
      const url = new URL(service.getAuthUrl('http://localhost/cb', 'rand-state'));

      expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
      expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost/cb');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('state')).toBe('rand-state');
      expect(url.searchParams.get('scope')).toContain('playlist-modify-private');
    });
  });
});
