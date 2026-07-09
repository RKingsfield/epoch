import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import Bottleneck from 'bottleneck';
import { lastValueFrom } from 'rxjs';
import { SpotifyAuthService } from './spotify-auth.service';
import { SpotifyTokenContext } from './spotify-token.context';
import { errorMessage, httpStatus } from '../utils/errors';

const REFRESH_BUFFER_MS = 60_000;

const limiter = new Bottleneck({
  maxConcurrent: 4,
  minTime: 100,
  reservoir: 50,
  reservoirRefreshAmount: 50,
  reservoirRefreshInterval: 5_000,
});

@Injectable()
export class SpotifyHttpClient {
  private readonly logger = new Logger(SpotifyHttpClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly auth: SpotifyAuthService,
  ) {}

  async get<T = unknown>(url: string, ctx: SpotifyTokenContext): Promise<T> {
    return this.request<T>('GET', url, ctx);
  }

  async post<T = unknown>(
    url: string,
    ctx: SpotifyTokenContext,
    body: unknown,
  ): Promise<T> {
    return this.request<T>('POST', url, ctx, body);
  }

  async delete<T = unknown>(
    url: string,
    ctx: SpotifyTokenContext,
    body?: unknown,
  ): Promise<T> {
    return this.request<T>('DELETE', url, ctx, body);
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    ctx: SpotifyTokenContext,
    body?: unknown,
  ): Promise<T> {
    await this.ensureFreshToken(ctx);

    const send = async (): Promise<T> => {
      const accessToken = ctx.get().access_token;
      const headers = this.headers(accessToken);
      const response = await lastValueFrom(
        method === 'GET'
          ? this.http.get(url, { headers })
          : method === 'POST'
            ? this.http.post(url, body, {
                headers: { ...headers, 'Content-Type': 'application/json' },
              })
            : this.http.delete(url, {
                headers: { ...headers, 'Content-Type': 'application/json' },
                data: body,
              }),
      );
      return response.data as T;
    };

    return limiter.schedule(async () => {
      try {
        return await send();
      } catch (err: unknown) {
        const status = httpStatus(err);
        if (status === 401) {
          this.logger.log('Spotify 401 — refreshing token and retrying once');
          await this.refreshAndPersist(ctx);
          return await send();
        }
        if (status === 429) {
          const retryAfter = this.parseRetryAfter(err);
          this.logger.warn(`Spotify 429 — backing off ${retryAfter}s`);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          return await send();
        }
        this.logger.error(
          `Spotify ${method} ${url} failed: ${status ?? '?'} ${errorMessage(err)}`,
        );
        throw err;
      }
    });
  }

  private async ensureFreshToken(ctx: SpotifyTokenContext): Promise<void> {
    if (Date.now() >= ctx.get().expires_at - REFRESH_BUFFER_MS) {
      await this.refreshAndPersist(ctx);
    }
  }

  private async refreshAndPersist(ctx: SpotifyTokenContext): Promise<void> {
    const fresh = await this.auth.refresh(ctx.get().refresh_token);
    await ctx.set(fresh);
  }

  private parseRetryAfter(err: unknown): number {
    if (typeof err === 'object' && err !== null && 'response' in err) {
      const headers = (
        err as { response?: { headers?: Record<string, string> } }
      ).response?.headers;
      return parseInt(headers?.['retry-after'] ?? '1', 10);
    }
    return 1;
  }

  private headers(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
  }
}
