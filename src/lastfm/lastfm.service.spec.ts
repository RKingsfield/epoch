import { Test } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import * as nock from 'nock';
import { endOfDay, subDays } from 'date-fns';
import { LastfmService } from './lastfm.service';
import { LastfmConfig } from './lastfm.config';
import { LastfmSessionData } from '../session/session.types';

const LASTFM = 'https://ws.audioscrobbler.com';
const session: LastfmSessionData = { name: 'testuser', key: 'sk-xxx' };

function userXml(name: string): string {
  return (
    `<lfm><user>` +
    `<name>${name}</name>` +
    `<realname>Test User</realname>` +
    `<registered>1 Jan 2010, 00:00</registered>` +
    `</user></lfm>`
  );
}

function tracksXml(tracks: { artist: string; name: string }[]): string {
  const tags = tracks
    .map(
      (t) =>
        `<track><artist>${t.artist}</artist><name>${t.name}</name></track>`,
    )
    .join('');
  return `<lfm><weeklytrackchart>${tags}</weeklytrackchart></lfm>`;
}

describe('LastfmService', () => {
  let service: LastfmService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [
        LastfmService,
        { provide: LastfmConfig, useValue: { apiKey: () => 'test-key' } },
      ],
    }).compile();
    service = mod.get(LastfmService);
  });

  afterEach(() => nock.cleanAll());

  describe('getUserData', () => {
    it('calls user.getInfo with correct params and parses the response', async () => {
      nock(LASTFM)
        .get('/2.0/')
        .query({
          method: 'user.getInfo',
          user: 'testuser',
          api_key: 'test-key',
        })
        .reply(200, userXml('testuser'));

      const result = await service.getUserData(session);
      expect(result.name).toBe('testuser');
      expect(result.realname).toBe('Test User');
    });

    it('throws when the response has no user element', async () => {
      nock(LASTFM).get('/2.0/').query(true).reply(200, '<lfm></lfm>');

      await expect(service.getUserData(session)).rejects.toThrow(
        'Last.fm user.getInfo returned no user',
      );
    });
  });

  describe('getTop', () => {
    it('wraps a single-track response in an array', async () => {
      const xml = tracksXml([{ artist: 'Solo', name: 'Only' }]);
      nock(LASTFM).get('/2.0/').query(true).reply(200, xml);

      const result = await service.getTop('testuser', '1000', '2000', 10);
      expect(result).toEqual([{ artist: 'Solo', name: 'Only' }]);
    });

    it('returns [] when the chart has no tracks', async () => {
      nock(LASTFM)
        .get('/2.0/')
        .query(true)
        .reply(200, '<lfm><weeklytrackchart /></lfm>');

      const result = await service.getTop('testuser', '1000', '2000', 10);
      expect(result).toEqual([]);
    });

    it('returns [] when weeklytrackchart is missing entirely', async () => {
      nock(LASTFM).get('/2.0/').query(true).reply(200, '<lfm></lfm>');

      const result = await service.getTop('testuser', '1000', '2000', 10);
      expect(result).toEqual([]);
    });

    it('slices to the requested amount', async () => {
      const xml = tracksXml([
        { artist: 'A', name: 'Alpha' },
        { artist: 'B', name: 'Beta' },
        { artist: 'C', name: 'Gamma' },
      ]);
      nock(LASTFM).get('/2.0/').query(true).reply(200, xml);

      const result = await service.getTop('testuser', '1000', '2000', 2);
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({ artist: 'B', name: 'Beta' });
    });
  });

  describe('getTopOfYear', () => {
    it('passes correct unix timestamps for year boundaries', async () => {
      let capturedQuery: Record<string, string> = {};
      nock(LASTFM)
        .get('/2.0/')
        .query((q) => {
          capturedQuery = q as Record<string, string>;
          return true;
        })
        .reply(200, tracksXml([{ artist: 'A', name: 'T' }]));

      await service.getTopOfYear(session, 2023, 100);

      const from = new Date(Number(capturedQuery.from) * 1000);
      expect(from.getFullYear()).toBe(2023);
      expect(from.getMonth()).toBe(0);
      expect(from.getDate()).toBe(1);
      expect(from.getHours()).toBe(0);

      const to = new Date(Number(capturedQuery.to) * 1000);
      expect(to.getFullYear()).toBe(2023);
      expect(to.getMonth()).toBe(11);
      expect(to.getDate()).toBe(31);
      expect(to.getHours()).toBe(23);
      expect(to.getMinutes()).toBe(59);
    });

    it('maps tracks to { artist, title }', async () => {
      nock(LASTFM)
        .get('/2.0/')
        .query(true)
        .reply(200, tracksXml([{ artist: 'Radiohead', name: 'Creep' }]));

      const result = await service.getTopOfYear(session, 2023, 100);
      expect(result).toEqual([{ artist: 'Radiohead', title: 'Creep' }]);
    });
  });

  describe('getTopOfSeason', () => {
    it('shifts endDate back by one day (exclusive boundary)', async () => {
      let capturedQuery: Record<string, string> = {};
      nock(LASTFM)
        .get('/2.0/')
        .query((q) => {
          capturedQuery = q as Record<string, string>;
          return true;
        })
        .reply(200, tracksXml([{ artist: 'A', name: 'T' }]));

      const start = new Date(2023, 5, 1); // Jun 1
      const end = new Date(2023, 8, 1); // Sep 1 (exclusive)
      await service.getTopOfSeason(session, start, end, 40);

      const from = Number(capturedQuery.from);
      expect(from).toBe(start.getTime() / 1000);

      const to = Number(capturedQuery.to);
      const expectedTo = Math.floor(
        endOfDay(subDays(new Date(end), 1)).getTime() / 1000,
      );
      expect(to).toBe(expectedTo);

      const toDate = new Date(to * 1000);
      expect(toDate.getMonth()).toBe(7); // August
      expect(toDate.getDate()).toBe(31);
      expect(toDate.getHours()).toBe(23);
    });
  });

  describe('getTopOfMonth', () => {
    it('uses first and last day of the month (leap-year February)', async () => {
      let capturedQuery: Record<string, string> = {};
      nock(LASTFM)
        .get('/2.0/')
        .query((q) => {
          capturedQuery = q as Record<string, string>;
          return true;
        })
        .reply(200, tracksXml([{ artist: 'A', name: 'T' }]));

      await service.getTopOfMonth(session, new Date(2024, 1), 25);

      const from = new Date(Number(capturedQuery.from) * 1000);
      expect(from.getFullYear()).toBe(2024);
      expect(from.getMonth()).toBe(1);
      expect(from.getDate()).toBe(1);

      const to = new Date(Number(capturedQuery.to) * 1000);
      expect(to.getMonth()).toBe(1);
      expect(to.getDate()).toBe(29);
      expect(to.getHours()).toBe(23);
    });
  });

  describe('fetchWithRetry', () => {
    it('retries once on a 5xx error then succeeds', async () => {
      nock(LASTFM).get('/2.0/').query(true).reply(503);
      nock(LASTFM)
        .get('/2.0/')
        .query(true)
        .reply(200, tracksXml([{ artist: 'A', name: 'T' }]));

      const result = await service.getTop('testuser', '1000', '2000', 10);
      expect(result).toEqual([{ artist: 'A', name: 'T' }]);
    });

    it('retries once on a network error (no status) then succeeds', async () => {
      nock(LASTFM).get('/2.0/').query(true).replyWithError('ECONNRESET');
      nock(LASTFM)
        .get('/2.0/')
        .query(true)
        .reply(200, tracksXml([{ artist: 'A', name: 'T' }]));

      const result = await service.getTop('testuser', '1000', '2000', 10);
      expect(result).toEqual([{ artist: 'A', name: 'T' }]);
    });

    it('does NOT retry on a 4xx error', async () => {
      nock(LASTFM).get('/2.0/').query(true).reply(404);
      const unused = nock(LASTFM)
        .get('/2.0/')
        .query(true)
        .reply(200, tracksXml([{ artist: 'A', name: 'T' }]));

      await expect(
        service.getTop('testuser', '1000', '2000', 10),
      ).rejects.toThrow();
      expect(unused.pendingMocks()).toHaveLength(1);
    });

    it('throws after exhausting all retry attempts on 5xx', async () => {
      nock(LASTFM).get('/2.0/').query(true).reply(500);
      nock(LASTFM).get('/2.0/').query(true).reply(500);

      await expect(
        service.getTop('testuser', '1000', '2000', 10),
      ).rejects.toThrow();
    });
  });

  describe('error propagation', () => {
    it('getTop propagates HTTP errors (does not swallow as [])', async () => {
      nock(LASTFM).get('/2.0/').query(true).reply(500);
      nock(LASTFM).get('/2.0/').query(true).reply(500);

      await expect(
        service.getTop('testuser', '1000', '2000', 10),
      ).rejects.toThrow();
    });

    it('getTopOfYear propagates HTTP errors', async () => {
      nock(LASTFM).get('/2.0/').query(true).reply(500);
      nock(LASTFM).get('/2.0/').query(true).reply(500);

      await expect(
        service.getTopOfYear(session, 2023, 100),
      ).rejects.toThrow();
    });
  });
});
