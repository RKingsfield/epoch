import { Test } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import * as nock from 'nock';
import { SpotifyHttpClient } from './spotify-http.client';
import { SpotifyAuthService } from './spotify-auth.service';
import { SpotifyTokenContext } from './spotify-token.context';
import { SpotifySessionData } from '../session/session.types';

const SPOTIFY_API = 'https://api.spotify.com';

function freshTokens(
  overrides: Partial<SpotifySessionData> = {},
): SpotifySessionData {
  return {
    access_token: 'access-1',
    refresh_token: 'refresh-1',
    scope: 'playlist-modify-private',
    token_type: 'Bearer',
    expires_at: Date.now() + 60 * 60 * 1000,
    ...overrides,
  };
}

function makeContext(
  initial: SpotifySessionData,
): SpotifyTokenContext & { setCalls: SpotifySessionData[] } {
  let tokens = initial;
  const setCalls: SpotifySessionData[] = [];
  return {
    get: () => tokens,
    set: async (next) => {
      setCalls.push(next);
      tokens = next;
    },
    setCalls,
  };
}

describe('SpotifyHttpClient', () => {
  let client: SpotifyHttpClient;
  let authRefresh: jest.Mock;

  beforeEach(async () => {
    authRefresh = jest.fn();
    const module = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [
        SpotifyHttpClient,
        { provide: SpotifyAuthService, useValue: { refresh: authRefresh } },
      ],
    }).compile();
    client = module.get(SpotifyHttpClient);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('issues a GET with the bearer token from the context', async () => {
    const ctx = makeContext(freshTokens());
    nock(SPOTIFY_API)
      .get('/v1/me')
      .matchHeader('authorization', 'Bearer access-1')
      .reply(200, { id: 'me' });

    const result = await client.get(`${SPOTIFY_API}/v1/me`, ctx);
    expect(result).toEqual({ id: 'me' });
  });

  it('refreshes preemptively when the access token is near expiry', async () => {
    authRefresh.mockResolvedValue(freshTokens({ access_token: 'access-2' }));
    const ctx = makeContext(
      freshTokens({ access_token: 'expiring', expires_at: Date.now() + 1000 }),
    );
    nock(SPOTIFY_API)
      .get('/v1/me')
      .matchHeader('authorization', 'Bearer access-2')
      .reply(200, { id: 'me' });

    await client.get(`${SPOTIFY_API}/v1/me`, ctx);
    expect(authRefresh).toHaveBeenCalledWith('refresh-1');
    expect(ctx.setCalls).toHaveLength(1);
  });

  it('refreshes and retries once on a 401', async () => {
    authRefresh.mockResolvedValue(freshTokens({ access_token: 'access-2' }));
    const ctx = makeContext(freshTokens());
    nock(SPOTIFY_API)
      .get('/v1/me')
      .matchHeader('authorization', 'Bearer access-1')
      .reply(401, { error: 'expired' });
    nock(SPOTIFY_API)
      .get('/v1/me')
      .matchHeader('authorization', 'Bearer access-2')
      .reply(200, { id: 'me' });

    const result = await client.get(`${SPOTIFY_API}/v1/me`, ctx);
    expect(result).toEqual({ id: 'me' });
    expect(authRefresh).toHaveBeenCalledTimes(1);
  });

  it('honours Retry-After on a 429 then succeeds', async () => {
    const ctx = makeContext(freshTokens());
    nock(SPOTIFY_API)
      .get('/v1/me')
      .reply(429, { error: 'slow down' }, { 'Retry-After': '0' });
    nock(SPOTIFY_API).get('/v1/me').reply(200, { id: 'me' });

    const result = await client.get(`${SPOTIFY_API}/v1/me`, ctx);
    expect(result).toEqual({ id: 'me' });
  });
});
