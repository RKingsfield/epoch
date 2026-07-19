import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import * as session from 'express-session';
import helmet from 'helmet';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import './session/session.types';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Trust the reverse proxy so req.secure reflects the original HTTPS
  // connection from Traefik. Without this, express-session silently refuses
  // to set the secure cookie because req.protocol comes through as 'http'.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false }));

  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('PUBLIC_URL'),
    credentials: true,
  });

  // All HTTP API endpoints live under /api so the static frontend's routes
  // (/playlists/, /jobs/, etc) don't collide with controller paths. OAuth
  // callbacks and ops endpoints stay at the root because external services
  // and scrapers point at fixed URLs.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'metrics', 'spotify/callback', 'lastfm/callback'],
  });

  const redisUrl = config.getOrThrow<string>('REDIS_URL');
  const sessionSecret = config.getOrThrow<string>('SESSION_SECRET');

  const redisLogger = new NestLogger('SessionRedis');
  const sessionClient = createClient({ url: redisUrl });
  sessionClient.on('error', (err) => redisLogger.error(err.message));
  await sessionClient.connect();

  app.use(
    session({
      store: new RedisStore({ client: sessionClient, prefix: 'epoch:sess:' }),
      name: 'epoch.sid',
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.get<string>('NODE_ENV') === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 30,
      },
    }),
  );

  const port = parseInt(config.getOrThrow<string>('PORT'), 10);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
