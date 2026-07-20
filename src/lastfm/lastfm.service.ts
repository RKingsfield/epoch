import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { endOfDay, subDays } from 'date-fns';
import { LastfmConfig, lastfmXmlParser } from './lastfm.config';
import { LastfmSessionData } from '../session/session.types';
import { httpStatus } from '../utils/errors';

const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

@Injectable()
export class LastfmService {
  private readonly logger = new Logger(LastfmService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: LastfmConfig,
  ) {}

  async getUserData(session: LastfmSessionData): Promise<UserResponse> {
    const params = new URLSearchParams({
      method: 'user.getInfo',
      user: session.name,
      api_key: this.config.apiKey(),
    });
    const res = await this.processXMLQuery(
      `${LASTFM_API_URL}?${params.toString()}`,
    );
    if (!res.lfm.user) throw new Error('Last.fm user.getInfo returned no user');
    return res.lfm.user;
  }

  async getTop(
    username: string,
    startDate: string,
    endDate: string,
    amount: number,
  ): Promise<TrackResponse[]> {
    const params = new URLSearchParams({
      method: 'user.getWeeklyTrackChart',
      user: username,
      from: startDate,
      to: endDate,
      api_key: this.config.apiKey(),
    });
    // Failures propagate (after the retry) rather than returning [] — an
    // empty chart and a Last.fm outage must not look the same to callers,
    // or outages get reported as "not enough scrobbles".
    const res = await this.processXMLQuery(
      `${LASTFM_API_URL}?${params.toString()}`,
    );
    const tracks = res?.lfm?.weeklytrackchart?.track;
    if (!tracks) return [];
    return (Array.isArray(tracks) ? tracks : [tracks]).slice(0, amount);
  }

  async getTopOfYear(
    session: LastfmSessionData,
    year: number,
    amount: number,
  ): Promise<Track[]> {
    const tracks = await this.getTop(
      session.name,
      String(new Date(year, 0, 1).getTime() / 1000),
      String(Math.floor(endOfDay(new Date(year, 11, 31)).getTime() / 1000)),
      amount,
    );
    return tracks.map((t) => ({ artist: t.artist, title: t.name }));
  }

  async getTopOfSeason(
    session: LastfmSessionData,
    startDate: Date,
    endDate: Date,
    amount: number,
  ): Promise<Track[]> {
    const tracks = await this.getTop(
      session.name,
      String(startDate.getTime() / 1000),
      String(
        Math.floor(endOfDay(subDays(new Date(endDate), 1)).getTime() / 1000),
      ),
      amount,
    );
    return tracks.map((t) => ({ artist: t.artist, title: t.name }));
  }

  async getTopOfMonth(
    session: LastfmSessionData,
    month: Date,
    amount: number,
  ): Promise<Track[]> {
    const tracks = await this.getTop(
      session.name,
      String(
        new Date(month.getFullYear(), month.getMonth(), 1).getTime() / 1000,
      ),
      String(
        Math.floor(
          endOfDay(
            new Date(month.getFullYear(), month.getMonth() + 1, 0),
          ).getTime() / 1000,
        ),
      ),
      amount,
    );
    return tracks.map((t) => ({ artist: t.artist, title: t.name }));
  }

  private async processXMLQuery(url: string): Promise<LastfmXmlResponse> {
    const response = await this.fetchWithRetry(() =>
      lastValueFrom(this.http.get(url)),
    );
    return lastfmXmlParser.parse(response.data);
  }

  private async fetchWithRetry<T>(
    fn: () => Promise<T>,
    attempts = 2,
  ): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastErr = err;
        const status = httpStatus(err);
        const transient = !status || status >= 500;
        if (i === attempts - 1 || !transient) throw err;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw lastErr;
  }
}

export interface Track {
  artist: string;
  title: string;
}

interface UserResponse {
  name: string;
  realname: string;
  registered: string;
}

interface TrackResponse {
  artist: string;
  name: string;
}

interface LastfmXmlResponse {
  lfm: {
    user?: UserResponse;
    weeklytrackchart?: { track?: TrackResponse | TrackResponse[] };
  };
}
