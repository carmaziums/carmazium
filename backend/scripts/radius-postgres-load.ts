/**
 * Isolated PostgreSQL radius-search acceptance.
 *
 * Run ONLY against an ephemeral, loopback-only PostgreSQL container provisioned
 * by .github/workflows/radius-postgres-ci.yml. Never pass production or
 * development Supabase URLs. The guard rejects any other host/database.
 *
 * Writes synthetic vehicles into the disposable test database; nothing here
 * touches an existing project, private user or seller identity.
 */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { ListingsService } from '../src/listings/listings.service';
import { distanceMiles, radiusBoundingBox } from '../src/listings/listing-radius-search';

type SeedRow = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  status: 'ACTIVE' | 'SOLD' | 'DRAFT' | 'OFFER_ACCEPTED';
  type: 'CLASSIFIED' | 'AUCTION';
  deletedAt: Date | null;
  make: string;
  price: number;
  isFeatured: boolean;
  createdAt: Date;
};

const url = new URL(process.env.DATABASE_URL || 'postgresql://missing/missing');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/carmazium_radius_ci' ||
    process.env.RADIUS_LOAD_TEST !== 'ephemeral-postgres-only') {
  throw new Error('REFUSED: radius load test requires its disposable loopback-only carmazium_radius_ci database');
}

const prisma = new PrismaClient();
const sample: SeedRow[] = [];
const city = [
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Birmingham', lat: 52.4862, lng: -1.8904 },
  { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
  { name: 'Bristol', lat: 51.4545, lng: -2.5879 },
  { name: 'Cardiff', lat: 51.4816, lng: -3.1791 },
  { name: 'Edinburgh', lat: 55.9533, lng: -3.1883 },
] as const;
const batchSize = 400;
const radiusSet = [10, 25, 50, 100, 200];
const audit: Array<Record<string, unknown>> = [];
const MAX_ACCEPTANCE_MS = 15000; // CI-only generous wall-clock guard; not production SLO.

/** Independent distance oracle: spherical law of cosines, not backend haversine. */
function independentMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = Math.PI / 180;
  const cosine = Math.sin(aLat * rad) * Math.sin(bLat * rad) +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.cos((aLng - bLng) * rad);
  return 3958.7613 * Math.acos(Math.max(-1, Math.min(1, cosine)));
}

function expectedMatches(lat: number, lng: number, maxDistanceMi: number,
    extra: { make?: string; maxPrice?: number; sellerType?: string } = {}) {
  // No seller accounts are seeded. PRIVATE is the only permitted seller type
  // to match our synthetic no-seller records if a seller row exists; don't
  // claim an RLS/seller-role test without seeded seller identities.
  return sample.filter(row =>
    row.type === 'CLASSIFIED' && row.deletedAt === null &&
    ['ACTIVE', 'SOLD', 'OFFER_ACCEPTED'].includes(row.status) &&
    row.latitude != null && row.longitude != null &&
    (!extra.make || row.make.toLowerCase().includes(extra.make.toLowerCase())) &&
    (extra.maxPrice == null || row.price <= extra.maxPrice) &&
    independentMiles(lat, lng, row.latitude, row.longitude) <= maxDistanceMi - 1e-6
  );
}

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error('RADIUS ACCEPTANCE FAILURE: ' + label);
}

async function seed() {
  // This guard also protects against accidentally reusing someone else's
  // local test database. CI always starts from an empty postgres service.
  const existing = await prisma.listing.count();
  assert(existing === 0, 'refusing to seed nonempty database');
  for (let i = 0; i < 8400; i++) {
    const centre = city[i % city.length];
    const lat = centre.lat + (((i * 13) % 71) - 35) * .006;
    const lng = centre.lng + (((i * 19) % 73) - 36) * .007;
    const row: SeedRow = {
      id: randomUUID(),
      latitude: i % 23 === 0 ? null : lat,
      longitude: i % 23 === 0 ? null : lng,
      status: i % 19 === 0 ? 'DRAFT' : i % 11 === 0 ? 'SOLD' : 'ACTIVE',
      type: i % 17 === 0 ? 'AUCTION' : 'CLASSIFIED',
      deletedAt: i % 97 === 0 ? new Date('2026-01-01T00:00:00.000Z') : null,
      make: i % 3 === 0 ? 'Honda' : 'Toyota',
      price: 4000 + (i % 151) * 110,
      isFeatured: i % 31 === 0,
      createdAt: new Date(Date.UTC(2025, 0, 1) + i * 1000),
    };
    sample.push(row);
    if (sample.length % batchSize === 0) {
      const rows = sample.slice(-batchSize);
      await prisma.listing.createMany({
        data: rows.map(r => ({
          id: r.id, title: 'Synthetic geography load test', slug: 'synthetic-radius-' + r.id,
          price: r.price, make: r.make, model: 'Synthetic',
          type: r.type, status: r.status, isFeatured: r.isFeatured,
          images: [], videoUrls: [], latitude: r.latitude,
          longitude: r.longitude, deletedAt: r.deletedAt,
          createdAt: r.createdAt, location: centreName(r.latitude, r.longitude),
        })),
      });
    }
  }
  assert(await prisma.listing.count() === sample.length, 'seed count mismatch');
  console.log('Synthetic, privacy-safe rows seeded:', sample.length);
}
function centreName(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return null;
  return city.reduce((best, x) =>
    (Math.abs(x.lat - lat) + Math.abs(x.lng - lng)) <
    (Math.abs(best.lat - lat) + Math.abs(best.lng - lng)) ? x : best
  ).name;
}

// The exact production ListingsService and Prisma models, not a reimplemented
// SQL approximation or a mocked repository, execute every test query.
const service = new ListingsService(
  prisma as any, {} as any, { get: () => undefined } as any,
  {} as any, {} as any, {} as any,
);

async function exercise(label: string, coordinates: { lat: number; lng: number },
    radius: number, extras: { make?: string; maxPrice?: number } = {}) {
  const expected = expectedMatches(coordinates.lat, coordinates.lng, radius, extras);
  const opts = {
    latitude: coordinates.lat, longitude: coordinates.lng,
    maxDistanceMi: radius, page: 1, limit: 20, ...extras,
  };
  const start = performance.now();
  const first = await service.findAll(opts);
  const firstMs = Math.round(performance.now() - start);
  assert(first.total === expected.length,
    label + ' exact eligible count expected ' + expected.length + ' got ' + first.total);
  assert(first.data.length === Math.min(20, expected.length), label + ' first-page size');
  const eligible = new Set(expected.map(x => x.id));
  assert(first.data.every(x => eligible.has(x.id)), label + ' ineligible listing in page 1');
  assert(firstMs < MAX_ACCEPTANCE_MS,
    label + ' slow test query >15s, inspect EXPLAIN; measured ' + firstMs + 'ms');

  const seen = new Set(first.data.map(x => x.id));
  if (expected.length > 20) {
    const page2 = await service.findAll({ ...opts, page: 2 });
    assert(page2.total === first.total, label + ' page2 count inconsistent');
    assert(page2.data.every(x => eligible.has(x.id)), label + ' ineligible page2 listing');
    assert(page2.data.every(x => !seen.has(x.id)), label + ' duplicate across pages');
    page2.data.forEach(x => seen.add(x.id));
  }

  const distanceStart = performance.now();
  const closest = await service.findAll({ ...opts, sortBy: 'distance_asc' });
  const nearestMs = Math.round(performance.now() - distanceStart);
  assert(closest.total === expected.length, label + ' closest-first total mismatch');
  const orderedExpected = [...expected].sort((a, b) => {
    const dA = independentMiles(coordinates.lat, coordinates.lng, a.latitude!, a.longitude!);
    const dB = independentMiles(coordinates.lat, coordinates.lng, b.latitude!, b.longitude!);
    return dA - dB || a.id.localeCompare(b.id);
  });
  assert(closest.data.map(x => x.id).join(',') ===
    orderedExpected.slice(0, 20).map(x => x.id).join(','),
    label + ' global closest-first order does not match independent oracle');
  assert(nearestMs < MAX_ACCEPTANCE_MS,
    label + ' slow closest-first query >15s, inspect EXPLAIN; ' + nearestMs + 'ms');
  audit.push({ label, radius, expected: expected.length, firstMs, nearestMs });
}

async function explainSql() {
  const centre = city[0], bbox = radiusBoundingBox({
    latitude: centre.lat, longitude: centre.lng, maxDistanceMi: 100,
  });
  const west = bbox.lonRanges[0];
  // EXPLAIN only SELECTs the disposable synthetic dataset.
  const plans = await prisma.$queryRaw<Array<{ 'QUERY PLAN': any }>>(
    Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id, latitude, longitude FROM public.listings
      WHERE "deletedAt" IS NULL AND "type" = 'CLASSIFIED'::listing_type
        AND status IN ('ACTIVE'::listing_status, 'SOLD'::listing_status, 'OFFER_ACCEPTED'::listing_status)
        AND latitude BETWEEN ${bbox.minLat} AND ${bbox.maxLat}
        AND longitude BETWEEN ${west.min} AND ${west.max}
      ORDER BY id ASC LIMIT 400`
  );
  const top = plans[0]?.['QUERY PLAN']?.[0];
  assert(!!top?.Plan, 'EXPLAIN JSON query-plan unavailable');
  console.log('POSTGRES_QUERY_PLAN', JSON.stringify({
    executionMs: top['Execution Time'],
    planningMs: top['Planning Time'],
    node: top.Plan['Node Type'],
    rows: top.Plan['Actual Rows'],
    sharedHit: top.Plan['Shared Hit Blocks'],
    sharedRead: top.Plan['Shared Read Blocks'],
  }));
}

async function main() {
  try {
    await seed();
    for (const centre of [city[0], city[1], city[2]]) {
      for (const radius of radiusSet) {
        await exercise(centre.name, centre, radius);
      }
    }
    await exercise('London Honda under £10k', city[0], 100, { make: 'Honda', maxPrice: 10000 });
    await explainSql();
    const sorted = [...audit].sort((a, b) =>
      Number(b.nearestMs) - Number(a.nearestMs));
    console.log('RADIUS_POSTGRES_ACCEPTANCE', JSON.stringify({
      cases: audit.length,
      rows: sample.length,
      slowest: sorted.slice(0, 6),
      maxAllowedMs: MAX_ACCEPTANCE_MS,
      independentReference: 'spherical-law-of-cosines',
      target: 'ephemeral-postgres-only',
    }));
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch(error => {
  console.error('RADIUS_POSTGRES_ACCEPTANCE_FAILED', error);
  process.exitCode = 1;
});
