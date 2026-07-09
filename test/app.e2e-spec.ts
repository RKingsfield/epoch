import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as session from 'express-session';
import { getQueueToken } from '@nestjs/bullmq';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { JobsController } from '../src/jobs/jobs.controller';
import { PlaylistsController } from '../src/playlists/playlists.controller';
import { PlaylistsService } from '../src/playlists/playlists.service';
import { SpotifyService } from '../src/spotify/spotify.service';
import { HttpExceptionFilter } from '../src/filters/http-exception.filter';
import { PLAYLIST_QUEUE } from '../src/jobs/playlist-generation.processor';
import { AuthStatus } from '../shared/types';

const MOCK_STATUS: AuthStatus = {
  links: { lastfm: 'http://test/lastfm', spotify: 'http://test/spotify' },
  status: { lastfm: 'UNCONNECTED', spotify: 'UNCONNECTED' },
  loginUrls: {
    lastfm: 'https://last.fm/api/auth?api_key=test',
    spotify: 'https://accounts.spotify.com/authorize?client_id=test',
  },
};

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController, JobsController, PlaylistsController],
      providers: [
        {
          provide: AppService,
          useValue: { getStatus: jest.fn().mockResolvedValue(MOCK_STATUS) },
        },
        {
          provide: getQueueToken(PLAYLIST_QUEUE),
          useValue: {
            add: jest.fn(),
            getJobs: jest.fn().mockResolvedValue([]),
            getJob: jest.fn(),
          },
        },
        { provide: PlaylistsService, useValue: {} },
        { provide: SpotifyService, useValue: {} },
      ],
    }).compile();

    app = module.createNestApplication();
    app.use(
      session({
        secret: 'e2e-test-secret-long-enough-for-32-chars',
        resave: false,
        saveUninitialized: true,
      }),
    );
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'metrics', 'spotify/callback', 'lastfm/callback'],
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('GET /api/v1/status returns auth status shape', () => {
    return request(app.getHttpServer())
      .get('/api/v1/status')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('links');
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('loginUrls');
        expect(res.body.status.lastfm).toBe('UNCONNECTED');
        expect(res.body.status.spotify).toBe('UNCONNECTED');
      });
  });

  it('POST /api/v1/jobs/generate returns 400 without session auth', () => {
    return request(app.getHttpServer())
      .post('/api/v1/jobs/generate')
      .send({})
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('Last.fm not connected');
      });
  });

  it('POST /api/v1/jobs/generate rejects invalid periods', () => {
    return request(app.getHttpServer())
      .post('/api/v1/jobs/generate')
      .send({ periods: ['bogus'] })
      .expect(400);
  });

  it('GET /api/v1/playlists returns 400 without session auth', () => {
    return request(app.getHttpServer())
      .get('/api/v1/playlists')
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('Last.fm not connected');
      });
  });

  it('PUT /api/v1/playlists/:id/tracks/:position returns 400 without session auth', () => {
    return request(app.getHttpServer())
      .put('/api/v1/playlists/abc123/tracks/0')
      .send({ spotifyTrackId: 'spotify:track:123' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('Last.fm not connected');
      });
  });

  it('PUT /api/v1/playlists/:id/tracks/:position rejects missing body', () => {
    return request(app.getHttpServer())
      .put('/api/v1/playlists/abc123/tracks/0')
      .send({})
      .expect(400);
  });

  it('GET /nonexistent returns 404', () => {
    return request(app.getHttpServer()).get('/api/v1/nonexistent').expect(404);
  });
});
