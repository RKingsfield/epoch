import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpotifyController } from './spotify.controller';
import { SpotifyService } from './spotify.service';
import { SpotifyAuthService } from './spotify-auth.service';
import { AppSession } from '../session/session.types';

const spotifySession = {
  access_token: 'tok',
  refresh_token: 'ref',
  scope: 'user-read-email',
  token_type: 'Bearer',
  expires_at: Date.now() + 3600_000,
};

const authedSession = {
  spotify: spotifySession,
  spotifyOauthState: 'abc123',
} as unknown as AppSession;

const anonSession = {} as AppSession;

function makeController() {
  const spotifyService = {
    getTrack: jest.fn(),
    search: jest.fn(),
  };
  const authService = {
    exchangeCode: jest.fn(),
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('https://epoch.example.com'),
  };
  const controller = new SpotifyController(
    spotifyService as unknown as SpotifyService,
    authService as unknown as SpotifyAuthService,
    configService as unknown as ConfigService,
  );
  return { controller, spotifyService, authService, configService };
}

describe('SpotifyController', () => {
  describe('login (GET /spotify/callback)', () => {
    it('rejects when code is missing', async () => {
      const { controller } = makeController();
      const res = { redirect: jest.fn() };
      await expect(
        controller.login(
          undefined as unknown as string,
          'state',
          authedSession,
          res as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when state is missing', async () => {
      const { controller } = makeController();
      const res = { redirect: jest.fn() };
      await expect(
        controller.login(
          'code',
          undefined as unknown as string,
          authedSession,
          res as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when session has no spotifyOauthState', async () => {
      const { controller } = makeController();
      const res = { redirect: jest.fn() };
      await expect(
        controller.login('code', 'state', anonSession, res as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when state does not match session', async () => {
      const { controller } = makeController();
      const res = { redirect: jest.fn() };
      await expect(
        controller.login('code', 'wrong-state', authedSession, res as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('exchanges code and redirects to / on success', async () => {
      const { controller, authService } = makeController();
      const tokens = { ...spotifySession };
      authService.exchangeCode.mockResolvedValue(tokens);
      const session = { spotifyOauthState: 'abc123' } as unknown as AppSession;
      const res = { redirect: jest.fn() };

      await controller.login('auth-code', 'abc123', session, res as any);

      expect(authService.exchangeCode).toHaveBeenCalledWith(
        'auth-code',
        'https://epoch.example.com/spotify/callback',
      );
      expect(session.spotify).toBe(tokens);
      expect(res.redirect).toHaveBeenCalledWith('/');
    });
  });

  describe('track (GET /spotify/tracks/:id)', () => {
    it('rejects when Spotify is not connected', async () => {
      const { controller } = makeController();
      await expect(controller.track(anonSession, 'abc')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns track data from service', async () => {
      const { controller, spotifyService } = makeController();
      const trackData = { spotifyId: '123', name: 'Song', artist: 'Artist' };
      spotifyService.getTrack.mockResolvedValue(trackData);

      const result = await controller.track(authedSession, '123');
      expect(result).toBe(trackData);
      expect(spotifyService.getTrack).toHaveBeenCalledWith(
        expect.anything(),
        '123',
      );
    });

    it('throws NotFoundException on 404 from Spotify', async () => {
      const { controller, spotifyService } = makeController();
      spotifyService.getTrack.mockRejectedValue({
        response: { status: 404 },
      });

      await expect(
        controller.track(authedSession, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('re-throws non-404 errors', async () => {
      const { controller, spotifyService } = makeController();
      const serverError = { response: { status: 500 }, message: 'boom' };
      spotifyService.getTrack.mockRejectedValue(serverError);

      await expect(controller.track(authedSession, 'x')).rejects.toBe(
        serverError,
      );
    });
  });

  describe('search (GET /spotify/search)', () => {
    it('rejects when Spotify is not connected', async () => {
      const { controller } = makeController();
      await expect(controller.search(anonSession, 'test')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns empty array for empty query', async () => {
      const { controller } = makeController();
      expect(await controller.search(authedSession, '')).toEqual([]);
    });

    it('returns empty array for whitespace-only query', async () => {
      const { controller } = makeController();
      expect(await controller.search(authedSession, '   ')).toEqual([]);
    });

    it('returns empty array for undefined query', async () => {
      const { controller } = makeController();
      expect(
        await controller.search(authedSession, undefined as unknown as string),
      ).toEqual([]);
    });

    it('trims query and passes to service', async () => {
      const { controller, spotifyService } = makeController();
      spotifyService.search.mockResolvedValue([]);

      await controller.search(authedSession, '  radiohead  ');
      expect(spotifyService.search).toHaveBeenCalledWith(
        expect.anything(),
        'radiohead',
        10,
      );
    });

    it('defaults limit to 10', async () => {
      const { controller, spotifyService } = makeController();
      spotifyService.search.mockResolvedValue([]);

      await controller.search(authedSession, 'test');
      expect(spotifyService.search).toHaveBeenCalledWith(
        expect.anything(),
        'test',
        10,
      );
    });

    it('clamps limit below 1 to 1', async () => {
      const { controller, spotifyService } = makeController();
      spotifyService.search.mockResolvedValue([]);

      await controller.search(authedSession, 'test', '-5');
      expect(spotifyService.search).toHaveBeenCalledWith(
        expect.anything(),
        'test',
        1,
      );
    });

    it('clamps limit above 25 to 25', async () => {
      const { controller, spotifyService } = makeController();
      spotifyService.search.mockResolvedValue([]);

      await controller.search(authedSession, 'test', '100');
      expect(spotifyService.search).toHaveBeenCalledWith(
        expect.anything(),
        'test',
        25,
      );
    });

    it('treats non-numeric limit as default 10', async () => {
      const { controller, spotifyService } = makeController();
      spotifyService.search.mockResolvedValue([]);

      await controller.search(authedSession, 'test', 'abc');
      expect(spotifyService.search).toHaveBeenCalledWith(
        expect.anything(),
        'test',
        10,
      );
    });
  });
});
