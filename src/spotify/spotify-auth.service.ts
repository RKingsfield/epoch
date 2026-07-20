import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { SpotifySessionData } from '../session/session.types';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com';
const SPOTIFY_SCOPES =
  'playlist-read-private playlist-modify-private playlist-modify-public user-read-private user-read-email';

@Injectable()
export class SpotifyAuthService {
  private readonly logger = new Logger(SpotifyAuthService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<SpotifySessionData> {
    const data = await this.tokenRequest({
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    if (!data.refresh_token) {
      throw new Error('Spotify auth response missing refresh_token');
    }
    return this.toSession(data, data.refresh_token);
  }

  async refresh(refreshToken: string): Promise<SpotifySessionData> {
    const data = await this.tokenRequest({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    return this.toSession(data, data.refresh_token ?? refreshToken);
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.getClientId(),
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SPOTIFY_SCOPES,
      state,
    });
    return `${SPOTIFY_AUTH_URL}/authorize?${params.toString()}`;
  }

  private async tokenRequest(
    body: Record<string, string>,
  ): Promise<TokenResponse> {
    const url = `${SPOTIFY_AUTH_URL}/api/token`;
    const auth = Buffer.from(
      `${this.getClientId()}:${this.getClientSecret()}`,
    ).toString('base64');
    const response = await lastValueFrom(
      this.http.post(url, new URLSearchParams(body).toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
        },
      }),
    );
    return response.data;
  }

  private toSession(
    data: TokenResponse,
    refreshToken: string,
  ): SpotifySessionData {
    return {
      access_token: data.access_token,
      refresh_token: refreshToken,
      scope: data.scope,
      token_type: data.token_type,
      expires_at: Date.now() + data.expires_in * 1000,
    };
  }

  private getClientId(): string {
    return this.config.getOrThrow<string>('SPOTIFY_CLIENT_ID');
  }

  private getClientSecret(): string {
    return this.config.getOrThrow<string>('SPOTIFY_CLIENT_SECRET');
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}
