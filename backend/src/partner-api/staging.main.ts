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

type SyntheticScenario = 'single' | 'pagination' | 'withdrawn' | 'ended';

function scenario(): SyntheticScenario {
  const raw = (process.env.STAGING_SYNTHETIC_SCENARIO || 'single').toLowerCase();
  if (raw === 'pagination' || raw === 'withdrawn' || raw === 'ended') return raw;
  return 'single';
}

function syntheticUuid(prefix: '1' | '2', index: number): string {
  if (index === 1) return prefix === '1' ? STAGING_AUCTION_ID : STAGING_LISTING_ID;
  return prefix.repeat(8) + '-' + prefix.repeat(4) + '-4' + prefix.repeat(3) +
    '-8' + prefix.repeat(3) + '-' + String(index).padStart(12, prefix);
}

function fixtures() {
  const mode = scenario();

  // v1 is a live-only full snapshot. Withdrawn and ended auctions are not
  // tombstones/status rows: they are absent from the next complete feed.
  if (mode === 'withdrawn' || mode === 'ended') return [];

  const now = new Date();
  const publicHost = (process.env.STAGING_PUBLIC_HOST || '').toLowerCase();
  const image = /^[a-z0-9.-]+\.up\.railway\.app$/.test(publicHost)
    ? ['https://' + publicHost + '/staging-assets/demo-vehicle.svg']
    : [];
  const count = mode === 'pagination' ? 51 : 1;

  return Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    return {
      id: syntheticUuid('1', index),
      listingId: syntheticUuid('2', index),
      startTime: new Date(now.getTime() - 3600_000),
      endTime: new Date(now.getTime() + (3600_000 + index * 1_000)),
      updatedAt: now,
      startingBid: (5000 + index - 1).toFixed(2),
      listing: {
        title: 'SYNTHETIC TEST: Example 2020 Vehicle #' + index,
        make: 'Example', model: 'Test Vehicle', variant: 'Demonstration',
        year: 2020, mileage: 40000 + index - 1, vehicleType: 'CAR', fuelType: 'PETROL',
        transmission: 'AUTOMATIC', bodyType: 'HATCHBACK', color: 'Blue',
        engineSize: 1500, images: image,
        vrm: index === 1 ? 'STAGING-NOT-A-REAL-VRM' : 'STAGING-FAKE-' + String(index).padStart(3, '0'),
        location: 'Birmingham', updatedAt: now,
      },
    };
  });
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
  bid: { findFirst: async () => ({ amount: '5200.00' }) },
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
