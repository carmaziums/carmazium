import { Controller, Get, Header, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import helmet from 'helmet';
import { SimpleDmsGuard } from './simpledms.guard';
import { SimpleDmsController } from './simpledms.controller';
import { SimpleDmsService } from './simpledms.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Completely isolated partner-contract staging service.
 * No AppModule, Supabase DB, payment credentials, cron jobs, or live inventory.
 * Reuses the exact production guard/controller/service on synthetic fixtures.
 */
const STAGING_AUCTION_ID = '11111111-1111-4111-8111-111111111111';
const STAGING_LISTING_ID = '22222222-2222-4222-8222-222222222222';

type SyntheticScenario =
  | 'single'
  | 'pagination'
  | 'withdrawn'
  | 'ended'
  | 'history-a'
  | 'history-bid'
  | 'history-extended'
  | 'history-return'
  | 'photo-display';

function scenario(): SyntheticScenario {
  const raw = (process.env.STAGING_SYNTHETIC_SCENARIO || 'single').toLowerCase();
  if (
    raw === 'pagination' ||
    raw === 'withdrawn' ||
    raw === 'ended' ||
    raw === 'history-a' ||
    raw === 'history-bid' ||
    raw === 'history-extended' ||
    raw === 'history-return' ||
    raw === 'photo-display'
  ) return raw;
  return 'single';
}

function syntheticUuid(prefix: '1' | '2', index: number): string {
  if (index === 1) return prefix === '1' ? STAGING_AUCTION_ID : STAGING_LISTING_ID;
  return prefix.repeat(8) + '-' + prefix.repeat(4) + '-4' + prefix.repeat(3) +
    '-8' + prefix.repeat(3) + '-' + String(index).padStart(12, '0');
}

function fixtures() {
  const mode = scenario();

  // v1 is a live-only full snapshot. Withdrawn and ended auctions are not
  // tombstones/status rows: they are absent from the next complete feed.
  if (mode === 'withdrawn' || mode === 'ended') return [];

  const now = new Date();
  const publicHost = (process.env.STAGING_PUBLIC_HOST || '').toLowerCase();
  const image = /^[a-z0-9.-]+\.up\.railway\.app$/.test(publicHost)
    ? mode === 'photo-display'
      ? [
          'https://' + publicHost + '/staging-assets/vehicle-photo-1',
          'https://' + publicHost + '/staging-assets/vehicle-photo-2',
          'https://' + publicHost + '/staging-assets/vehicle-photo-3',
        ]
      : ['https://' + publicHost + '/staging-assets/demo-vehicle.svg']
    : [];
  const count = mode === 'pagination' ? 51 : 1;
  const returningVehicle = mode === 'history-return' || mode === 'photo-display';

  return Array.from({ length: count }, (_, offset) => {
    const baseIndex = offset + 1;
    const index = returningVehicle && baseIndex === 1 ? 2 : baseIndex;
    const isHistoricalFixture = mode.startsWith('history-') || mode === 'photo-display';
    const endOffsetMs = mode === 'history-extended'
      ? 4 * 3600_000
      : mode === 'history-return'
        ? 2 * 3600_000
        : 3600_000;
    const mileage = returningVehicle && baseIndex === 1 ? 40125 : 40000 + baseIndex - 1;
    return {
      id: syntheticUuid('1', index),
      listingId: syntheticUuid('2', index),
      startTime: new Date(now.getTime() - (returningVehicle ? 1800_000 : 3600_000)),
      endTime: new Date(now.getTime() + endOffsetMs + baseIndex * 1_000),
      updatedAt: now,
      startingBid: (5000 + baseIndex - 1).toFixed(2),
      listing: {
        title: isHistoricalFixture
          ? 'SYNTHETIC HISTORY TEST: Example 2020 Vehicle'
          : 'SYNTHETIC TEST: Example 2020 Vehicle #' + baseIndex,
        make: 'Example', model: 'Test Vehicle', variant: 'Demonstration',
        year: 2020, mileage, vehicleType: 'CAR', fuelType: 'PETROL',
        transmission: 'AUTOMATIC', bodyType: 'HATCHBACK', color: 'Blue',
        engineSize: 1500, images: image,
        // history-return deliberately presents the same fictional registration
        // under a new auction/listing ID so SimpleDMS can prove repeat matching
        // without any real customer or vehicle data.
        vrm: isHistoricalFixture
          ? 'STAGING-NOT-A-REAL-VRM'
          : baseIndex === 1
            ? 'STAGING-NOT-A-REAL-VRM'
            : 'STAGING-FAKE-' + String(baseIndex).padStart(3, '0'),
        location: 'Birmingham', updatedAt: now,
      },
    };
  });
}

function currentSyntheticBid(): string {
  const mode = scenario();
  if (mode === 'history-bid' || mode === 'history-extended') return '5450.00';
  if (mode === 'history-return' || mode === 'photo-display') return '5600.00';
  return '5200.00';
}

@Controller('health')
class SyntheticHealthController {
  @Get('live')
  @Header('Cache-Control', 'no-store')
  live() { return { ok: true, syntheticOnly: true }; }
}

@Controller('staging-assets')
class SyntheticAssetsController {

  @Get('demo-vehicle.svg')
  @Header('Content-Type', 'image/svg+xml')
  @Header('X-Robots-Tag', 'noindex')
  image() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#273447"/><rect x="100" y="100" width="760" height="340" rx="22" fill="#385977"/><text x="480" y="242" font-size="51" fill="white" text-anchor="middle" font-family="sans-serif">SYNTHETIC TEST VEHICLE</text><text x="480" y="312" font-size="24" fill="#deefff" text-anchor="middle" font-family="sans-serif">CarMazium staging only - not for live resale</text></svg>';
  }

  // Controlled, staging-only representative vehicle artwork. Serve the bytes
  // directly from the isolated Railway host: no redirects, customer media,
  // registration marks, people or private listing assets.
  private vehicleArtwork(label: string, body: string, accent: string) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="${label}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0f172a"/>
          <stop offset="1" stop-color="#334155"/>
        </linearGradient>
        <linearGradient id="car" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${accent}"/>
          <stop offset="1" stop-color="#e2e8f0"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="675" fill="url(#bg)"/>
      <rect x="70" y="70" width="1060" height="535" rx="36" fill="#111827" stroke="#64748b" stroke-width="2"/>
      <ellipse cx="600" cy="505" rx="390" ry="42" fill="#020617" opacity=".72"/>
      <path d="${body}" fill="url(#car)" stroke="#f8fafc" stroke-width="6" stroke-linejoin="round"/>
      <path d="M430 320 L505 230 H710 L790 320" fill="#94a3b8" opacity=".9"/>
      <path d="M520 245 H695 L752 315 H462 Z" fill="#dbeafe" opacity=".82"/>
      <circle cx="395" cy="455" r="58" fill="#111827" stroke="#cbd5e1" stroke-width="14"/>
      <circle cx="805" cy="455" r="58" fill="#111827" stroke="#cbd5e1" stroke-width="14"/>
      <circle cx="395" cy="455" r="22" fill="#94a3b8"/>
      <circle cx="805" cy="455" r="22" fill="#94a3b8"/>
      <rect x="95" y="95" width="320" height="54" rx="27" fill="#ffffff" opacity=".94"/>
      <text x="255" y="131" text-anchor="middle" font-size="25" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a">CarMazium staging only</text>
      <text x="600" y="585" text-anchor="middle" font-size="30" font-family="Arial, sans-serif" font-weight="700" fill="#f8fafc">${label}</text>
      <text x="600" y="620" text-anchor="middle" font-size="18" font-family="Arial, sans-serif" fill="#cbd5e1">Representative synthetic vehicle artwork — not a customer vehicle</text>
    </svg>`;
  }

  @Get('vehicle-photo-1')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex')
  photo1() {
    return this.vehicleArtwork(
      'Representative SUV',
      'M250 400 L315 325 L430 305 L505 230 H710 L790 320 L930 350 L980 420 L945 465 H255 Z',
      '#38bdf8',
    );
  }

  @Get('vehicle-photo-2')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex')
  photo2() {
    return this.vehicleArtwork(
      'Representative Sports Car',
      'M220 420 L300 355 L455 325 L535 250 H720 L820 340 L955 370 L995 425 L955 465 H240 Z',
      '#f97316',
    );
  }

  @Get('vehicle-photo-3')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex')
  photo3() {
    return this.vehicleArtwork(
      'Representative Hatchback',
      'M245 410 L315 345 L445 320 L515 245 H680 L785 330 L915 355 L970 415 L945 465 H255 Z',
      '#22c55e',
    );
  }
}

const syntheticPrisma = {
  auction: {
    // Honour the real service's Prisma pagination contract; otherwise the
    // synthetic partner demo repeats vehicles on every page.
    findMany: async (args: { skip?: number; take?: number } = {}) => {
      const skip = args.skip ?? 0;
      const take = args.take ?? 25;
      return fixtures().slice(skip, skip + take);
    },
    count: async () => fixtures().length,
    findFirst: async (args: any) => {
      return fixtures().find((auction) => auction.id === args?.where?.id) || null;
    },
  },
  bid: { findFirst: async () => ({ amount: currentSyntheticBid() }) },
};

@Controller('staging-auctions')
class SyntheticAuctionController {
  @Get(':id')
  @Header('X-Robots-Tag', 'noindex')
  preview() {
    return { syntheticOnly: true, biddingEnabled: false, message: 'Synthetic integration test vehicle; no real sale or dealer registration.' };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ThrottlerModule.forRoot([{
    ttl: 60_000, limit: 60,
  }])],
  controllers: [SimpleDmsController, SyntheticAssetsController, SyntheticAuctionController, SyntheticHealthController],
  providers: [
    SimpleDmsGuard, SimpleDmsService,
    { provide: PrismaService, useValue: syntheticPrisma },
  ],
})
class SyntheticStagingModule {}

async function bootstrap() {
  if (process.env.STAGING_SYNTHETIC_ONLY !== 'true') {
    throw new Error('Refusing to start without STAGING_SYNTHETIC_ONLY=true');
  }
  if (process.env.DATABASE_URL || process.env.STRIPE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Synthetic staging must not receive production database, Stripe or Supabase credentials');
  }
  const app = await NestFactory.create(SyntheticStagingModule);
  app.use(helmet());
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-CarMazium-Environment', 'synthetic-staging');
    next();
  });
  await app.listen(Number(process.env.PORT || 8080), '0.0.0.0');
}
void bootstrap();
