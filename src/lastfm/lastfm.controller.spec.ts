import { BadRequestException } from '@nestjs/common';
import { LastfmController } from './lastfm.controller';
import { LastfmAuthService } from './lastfm-auth.service';
import { AppSession } from '../session/session.types';

function makeController() {
  const authService = {
    exchangeToken: jest.fn(),
  };
  const controller = new LastfmController(
    authService as unknown as LastfmAuthService,
  );
  return { controller, authService };
}

describe('LastfmController', () => {
  describe('login (GET /lastfm/callback)', () => {
    it('rejects when token is missing', async () => {
      const { controller } = makeController();
      const session = {} as AppSession;
      const res = { redirect: jest.fn() };

      await expect(
        controller.login(undefined as unknown as string, session, res as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when token is empty string', async () => {
      const { controller } = makeController();
      const session = {} as AppSession;
      const res = { redirect: jest.fn() };

      await expect(
        controller.login('', session, res as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('exchanges token, sets session.lastfm, and redirects to /', async () => {
      const { controller, authService } = makeController();
      const lastfmData = { name: 'testuser', key: 'session-key-abc' };
      authService.exchangeToken.mockResolvedValue(lastfmData);
      const session = {} as AppSession;
      const res = { redirect: jest.fn() };

      await controller.login('lfm-token-123', session, res as any);

      expect(authService.exchangeToken).toHaveBeenCalledWith('lfm-token-123');
      expect(session.lastfm).toBe(lastfmData);
      expect(res.redirect).toHaveBeenCalledWith('/');
    });

    it('throws BadRequestException when token exchange fails', async () => {
      const { controller, authService } = makeController();
      authService.exchangeToken.mockRejectedValue(new Error('network error'));
      const session = {} as AppSession;
      const res = { redirect: jest.fn() };

      await expect(
        controller.login('bad-token', session, res as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.login('bad-token', session, res as any),
      ).rejects.toThrow('Last.fm authentication failed');
    });

    it('does not redirect when token exchange fails', async () => {
      const { controller, authService } = makeController();
      authService.exchangeToken.mockRejectedValue(new Error('boom'));
      const session = {} as AppSession;
      const res = { redirect: jest.fn() };

      await controller.login('bad-token', session, res as any).catch(() => {});

      expect(res.redirect).not.toHaveBeenCalled();
    });
  });
});
