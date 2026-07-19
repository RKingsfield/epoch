import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthStatus } from '../shared/types';
import { LastfmAuthService } from './lastfm/lastfm-auth.service';
import { SpotifyAuthService } from './spotify/spotify-auth.service';

@Injectable()
export class AppService {
  constructor(
    private readonly lastfmAuth: LastfmAuthService,
    private readonly spotifyAuth: SpotifyAuthService,
    private readonly config: ConfigService,
  ) {}

  async getStatus(
    connected: { lastfm: boolean; spotify: boolean },
    spotifyOauthState: string,
  ): Promise<AuthStatus> {
    const publicUrl = this.publicUrl();
    return {
      status: {
        lastfm: connected.lastfm ? 'CONNECTED' : 'UNCONNECTED',
        spotify: connected.spotify ? 'CONNECTED' : 'UNCONNECTED',
      },
      loginUrls: {
        lastfm: await this.lastfmAuth.getAuthUrl(publicUrl),
        spotify: this.spotifyAuth.getAuthUrl(
          `${publicUrl}/spotify/callback`,
          spotifyOauthState,
        ),
      },
    };
  }

  private publicUrl(): string {
    return this.config.getOrThrow<string>('PUBLIC_URL');
  }
}
