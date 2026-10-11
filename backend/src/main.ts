import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import session from 'express-session';
import pgConnect = require('connect-pg-simple');
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { HttpAdapterHost } from '@nestjs/core';
import helmet from 'helmet';
import { RedisIoAdapter } from './core/adapters/redis-io.adapter';
import { loggerConfig } from './core/config/logger.config';
import { getAllowedOrigins } from './core/allowed-origins';
import { ABSOLUTE_SESSION_LIFETIME_MS, remainingSessionLifetimeMs } from './auth/session-lifetime';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: loggerConfig,
    rawBody: true,
  });

  // ---------------------------------------------------------------------------
  // WebSocket Redis Adapter (Scalability)
  // ---------------------------------------------------------------------------
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // ---------------------------------------------------------------------------
  // CORS — allow frontend origins with credentials (cookies)
  // Production (Vercel): set ALLOWED_ORIGINS=https://carmazium.vercel.app,https://yourdomain.com
  // ---------------------------------------------------------------------------
  // Shared with the WebSocket gateways — see core/allowed-origins.ts. They
  // used to keep their own copies of this list and drifted out of sync.
  const allowedOrigins = getAllowedOrigins();
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // ---------------------------------------------------------------------------
  // Trust proxy so secure cookies work behind reverse proxies (Render, etc.)
  // ---------------------------------------------------------------------------
  app.set('trust proxy', 1);

  // ---------------------------------------------------------------------------
  // Session middleware — PostgreSQL-backed session store
  // Production (Render): set SESSION_SECRET and ensure NODE_ENV=production
  // so cookie is Secure + SameSite=None for cross-origin (Vercel → Render).
  // ---------------------------------------------------------------------------
  const PgSession = pgConnect(session);
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set — session store will fail to initialize');
    process.exit(1);
  }

  if (isProduction && !process.env.SESSION_SECRET) {
    console.warn('SESSION_SECRET is not set in production — session cookies may be insecure');
  }

  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: 'sessions',
        createTableIfMissing: true,
      }),
      name: 'sid',
      secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: ABSOLUTE_SESSION_LIFETIME_MS, // 24-hour absolute sign-in limit
      },
    }),
  );

  // ---------------------------------------------------------------------------
  // Session user hydration middleware
  // Populates req.user from the session on every request so that
  // @CurrentUser() and RolesGuard work seamlessly.
  // ---------------------------------------------------------------------------
  const authService = app.get(AuthService);

  app.use(async (req: any, res: any, next: any) => {
    if (req.session?.userId && !req.user) {
      // Login/logout endpoints must remain accessible to recover a real
      // expired session without trapping the user in a redirect loop.
      const isExplicitAuth = ['/auth/supabase-session', '/auth/login', '/auth/register', '/auth/logout']
        .includes(req.path);
      if (!isExplicitAuth) {
        // Migration of legacy seven-day cookies: begin a ONE-TIME 24-hour
        // grace period on first use. Do not log everyone out on deployment.
        // Once stored, authenticatedAt is immutable until a NEW login.
        if (typeof req.session.authenticatedAt !== 'number') {
          req.session.authenticatedAt = Date.now();
        }
        const remaining = remainingSessionLifetimeMs(req.session.authenticatedAt);
        if (remaining === 0) {
          return req.session.destroy((error: Error | undefined) => {
            res.clearCookie('sid', {
              httpOnly: true,
              secure: isProduction,
              sameSite: isProduction ? 'none' : 'lax',
            });
            if (error) {
              return res.status(503).json({ message: 'Unable to end expired session' });
            }
            return res.status(401).json({ message: 'SESSION_EXPIRED_24H' });
          });
        }
        // express-session cookie touch may reset Max-Age; cap it to the
        // REMAINING absolute lifetime on every request, never another 24h.
        req.session.cookie.maxAge = remaining;
      }
      if (req.session.cachedUser) {
        // Use the user object cached in the session store — no extra DB query needed
        req.user = req.session.cachedUser;
      } else {
        // Fallback for existing sessions that pre-date this optimisation
        const user = await authService.validateSession(req.session.userId);
        if (user) {
          req.user = user;
          req.session.cachedUser = user;
        } else {
          // Session references a deleted/invalid user — clear it
          req.session.destroy(() => { });
        }
      }
    }
    next();
  });

  // ---------------------------------------------------------------------------
  // Global validation pipe for DTOs
  // ---------------------------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ---------------------------------------------------------------------------
  // Security: Helmet & Global Exception Filter
  // ---------------------------------------------------------------------------
  app.use(helmet());

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  // ---------------------------------------------------------------------------
  // Swagger configuration
  // ---------------------------------------------------------------------------
  const config = new DocumentBuilder()
    .setTitle('Carmazium API')
    .setDescription('Core Marketplace Engine API for Carmazium')
    .setVersion('1.0')
    .addTag('Auth', 'User authentication')
    .addTag('Users', 'User profile management')
    .addTag('Listings', 'Vehicle listings management')
    .addTag('Bids', 'Auction bidding')
    .addTag('Watchlist', 'Saved listings')
    .addTag('Transactions', 'Payment & transaction history')
    .addTag('Service Requests', 'Contractor service requests')
    .addTag('Chat', 'Real-time messaging')
    .addCookieAuth('sid')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // ---------------------------------------------------------------------------
  // Start server
  // ---------------------------------------------------------------------------
  const port = process.env.PORT ?? 8080;
  await app.listen(port, '0.0.0.0');

  // Graceful shutdown for Fly deploys/restarts.
  //
  // The previous handler closed Redis and immediately called process.exit(0).
  // That could sever an in-flight auction GET/POST or websocket at the exact
  // moment Fly replaced the machine, surfacing upstream as ECONNRESET /
  // UND_ERR_SOCKET / ETIMEDOUT. Stop accepting new work through Nest first and
  // let active HTTP/socket resources drain. fly.toml gives this process up to
  // 30 seconds before a forced kill.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; draining CarMazium API connections...`);

    const hardStop = setTimeout(() => {
      console.error('Graceful shutdown exceeded 25 seconds; exiting before Fly force-kills the machine.');
      process.exit(1);
    }, 25_000);
    hardStop.unref();

    try {
      await app.close();
      await redisIoAdapter.closeRedisConnections();
      clearTimeout(hardStop);
      console.log('CarMazium API shutdown completed cleanly.');
    } catch (error) {
      clearTimeout(hardStop);
      console.error('Graceful shutdown failed', error);
      process.exitCode = 1;
    }
  };

  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.once('SIGINT', () => { void shutdown('SIGINT'); });

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 Swagger docs available at http://localhost:${port}/api`);
}

bootstrap();
