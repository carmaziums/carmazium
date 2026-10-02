import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SimpleDmsService } from './simpledms.service';

const PUBLIC_IMAGE = 'https://assets.carmazium.com/auctions/vehicle-1.jpg';
const SUPABASE_LISTING_IMAGE = 'https://bwtnzmevjlowwronylxm.supabase.co/storage/v1/object/public/listings/owner/exterior/photo.jpg';
const SAMPLE: any = {
  id: 'auction-1',
  listingId: 'listing-1',
  startTime: new Date('2026-10-01T10:00:00.000Z'),
  endTime: new Date('2026-10-02T10:00:00.000Z'),
  updatedAt: new Date('2026-10-01T11:00:00.000Z'),
  startingBid: '5000.00',
  reservePrice: '12000.00', // Poison-pill values must never appear.
  winnerId: 'secret-winner',
  handoverProofPath: 'secret-private-document',
  listing: {
    title: '2020 Test Motors Example',
    make: 'Test Motors',
    model: 'Example',
    year: 2020,
    mileage: 45000,
    variant: 'Sport',
    vehicleType: 'CAR',
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'HATCHBACK',
    color: 'Blue',
    engineSize: 2000,
    images: [
      PUBLIC_IMAGE,
      PUBLIC_IMAGE + '#cm-photo=exterior',
      SUPABASE_LISTING_IMAGE + '#cm-photo=eyJjYXRlZ29yeSI6IkVYVEVSSU9SIn0',
      'https://storage.example.supabase.co/storage/v1/object/public/kyc/private.jpg',
      'https://assets.carmazium.com/private/handover/secret.jpg',
      'https://assets.carmazium.com/auctions/signed.jpg?token=secret',
      'http://assets.carmazium.com/insecure.jpg',
      'https://unapproved.example.com/vehicle.jpg',
    ],
    vrm: 'PRIVATE_REG',
    location: '19 Example Road, PRIVATE_ADDRESS',
    description: 'Seller private phone number 07111111111',
    sellerId: 'PRIVATE_SELLER',
    seller: { email: 'seller@private.invalid', phone: '07111111111' },
    updatedAt: new Date('2026-10-01T12:00:00.000Z'),
  },
};

function harness(env: Record<string, string> = {}) {
  const prisma: any = {
    auction: {
      findMany: jest.fn().mockResolvedValue([SAMPLE]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(SAMPLE),
    },
    bid: { findFirst: jest.fn().mockResolvedValue({ amount: '5200.00' }) },
  };
  const config: any = { get: (key: string) => env[key] };
  return { prisma, service: new SimpleDmsService(prisma, config) };
}

describe('SimpleDmsService partner data boundary', () => {
  it('exports only approved live-auction fields and excludes private data', async () => {
    const { service, prisma } = harness();
    const result = await service.list(1, 25);
    expect(result.pagination).toEqual({ page: 1, limit: 25, total: 1, hasMore: false });
    expect(result.auctions[0].url).toBe('https://carmazium.com/auctions/live/auction-1?utm_source=simpledms&utm_medium=partner_api');
    expect(result.auctions[0].images).toEqual([]);
    expect(result.auctions[0].vehicle).not.toHaveProperty('registration');
    expect(result.auctions[0].auction).not.toHaveProperty('currentBidGbp');
    const raw = JSON.stringify(result);
    for (const secret of ['12000', 'PRIVATE_REG', 'PRIVATE_SELLER', '07111111111',
      'secret-private-document', 'secret-winner', 'PRIVATE_ADDRESS']) {
      expect(raw).not.toContain(secret);
    }
    const where = prisma.auction.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('ACTIVE');
    expect(where.deletedAt).toBeNull();
    expect(where.startTime.lte).toBeInstanceOf(Date);
    expect(where.endTime.gt).toBeInstanceOf(Date);
    expect(where.listing.is).toEqual({ type: 'AUCTION', status: 'ACTIVE', deletedAt: null });
  });

  it('only includes opted-in registration and genuinely public approved-host images', async () => {
    const { service } = harness({
      PARTNER_API_SIMPLEDMS_SHARE_REGISTRATION: 'true',
      PARTNER_API_SIMPLEDMS_SHARE_IMAGES: 'true',
      PARTNER_API_PUBLIC_IMAGE_HOSTS: 'assets.carmazium.com,bwtnzmevjlowwronylxm.supabase.co',
    });
    const result = await service.detail('auction-1');
    expect(result.auction.vehicle).toHaveProperty('registration', 'PRIVATE_REG');
    expect(result.auction.images).toEqual([PUBLIC_IMAGE, PUBLIC_IMAGE, SUPABASE_LISTING_IMAGE]);
    expect(JSON.stringify(result)).not.toContain('seller@private.invalid');
  });

  it('only discloses an explicitly allowlisted town, never arbitrary seller locations', async () => {
    const approved = harness({PARTNER_API_SIMPLEDMS_SHARE_REGION: 'true', PARTNER_API_SIMPLEDMS_ALLOWED_REGIONS: 'Birmingham,Leeds'});
    const unknown = await approved.service.detail('auction-1');
    expect(unknown.auction.region).toBeNull();
    approved.prisma.auction.findFirst.mockResolvedValue({...SAMPLE, listing: {...SAMPLE.listing, location: 'Birmingham'}});
    const known = await approved.service.detail('auction-1');
    expect(known.auction.region).toBe('Birmingham');
  });

  it('exposes current bid only when opted in and queries current-run non-cancelled bids', async () => {
    const { service, prisma } = harness({ PARTNER_API_SIMPLEDMS_SHARE_CURRENT_BID: 'true' });
    const result = await service.detail('auction-1');
    expect(result.auction.auction).toHaveProperty('currentBidGbp', 5200);
    const query = prisma.bid.findFirst.mock.calls[0][0];
    expect(query.select).toEqual({ amount: true });
    expect(query.where.createdAt.gte).toEqual(SAMPLE.startTime);
    expect(query.where).toMatchObject({ cancelledAt: null, archivedAt: null, deletedAt: null });
  });

  it('enforces strict bounded pagination', async () => {
    const { service } = harness();
    for (const [page, limit] of [[0, 25], [1, 0], [1, 51], [1001, 25], [1.5, 25]]) {
      await expect(service.list(page, limit)).rejects.toThrow(BadRequestException);
    }
  });

  it('never returns a non-live or unapproved record in detail', async () => {
    const { service, prisma } = harness();
    prisma.auction.findFirst.mockResolvedValue(null);
    await expect(service.detail('auction-1')).rejects.toThrow(NotFoundException);
    expect(prisma.auction.findFirst.mock.calls[0][0].where.listing.is.status).toBe('ACTIVE');
  });
});
