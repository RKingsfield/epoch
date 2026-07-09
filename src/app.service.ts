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

  async getStatus(connected: {
    lastfm: boolean;
    spotify: boolean;
  }): Promise<AuthStatus> {
    const publicUrl = this.publicUrl();
    return {
      links: {
        lastfm: `${publicUrl}/lastfm`,
        spotify: `${publicUrl}/spotify`,
      },
      status: {
        lastfm: connected.lastfm ? 'CONNECTED' : 'UNCONNECTED',
        spotify: connected.spotify ? 'CONNECTED' : 'UNCONNECTED',
      },
      loginUrls: {
        lastfm: await this.lastfmAuth.getAuthUrl(publicUrl),
        spotify: this.spotifyAuth.getAuthUrl(
          `${publicUrl}/spotify/callback`,
          'init',
        ),
      },
    };
  }

  private publicUrl(): string {
    return this.config.get<string>('PUBLIC_URL') ?? 'http://localhost:5342';
  }
}
