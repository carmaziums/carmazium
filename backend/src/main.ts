import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const session = require('express-session');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pgConnect = require('connect-pg-simple');
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { HttpAdapterHost } from '@nestjs/core';
import helmet from 'helmet';
import { RedisIoAdapter } from './core/adapters/redis-io.adapter';
import { loggerConfig } from './core/config/logger.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: loggerConfig,
    rawBody: true,
  });

  // ---------------------------------------------------------------------------
  // Raw body capture for Stripe webhook signature verification
  // ---------------------------------------------------------------------------
  app.use('/api/payments/webhook', (req: any, _res: any, next: any) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => { req.rawBody = Buffer.concat(chunks); });
    next();
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
  // Always include core production origins, plus any extras from ALLOWED_ORIGINS
  const CORE_ORIGINS = [
    'http://localhost:3000',
    'https://carmazium.vercel.app',
    'https://carmazium.fly.dev',
    'https://carmazium-hjoh9w.fly.dev',
  ];
  const extraOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const allowedOrigins = [...new Set([...CORE_ORIGINS, ...extraOrigins])];
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
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    }),
  );

  // ---------------------------------------------------------------------------
  // Session user hydration middleware
  // Populates req.user from the session on every request so that
  // @CurrentUser() and RolesGuard work seamlessly.
  // ---------------------------------------------------------------------------
  const authService = app.get(AuthService);

  app.use(async (req: any, _res: any, next: any) => {
    if (req.session?.userId && !req.user) {
      const user = await authService.validateSession(req.session.userId);
      if (user) {
        req.user = user;
      } else {
        // Session references a deleted/invalid user — clear it
        req.session.destroy(() => { });
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

  // Graceful shutdown: close Redis adapter connections when present
  const shutdown = async () => {
    if (typeof redisIoAdapter.close === 'function') {
      await redisIoAdapter.close();
    }
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 Swagger docs available at http://localhost:${port}/api`);
}

bootstrap();
