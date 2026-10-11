import { BadRequestException } from '@nestjs/common';
import { DamageAnalysisService, computeExteriorGrade, type DamageDetection } from './damage.service';

describe('computeExteriorGrade', () => {
  const defects = (count: number) => Array.from({ length: count }, () => ({ size: 'MEDIUM' }));

  it.each([
    [0, 1],
    [1, 1],
    [2, 2],
    [3, 2],
    [4, 3],
    [5, 3],
    [6, 4],
    [7, 4],
    [8, 5],
    [12, 5],
  ])('maps %i reported defects to grade %i', (count, expected) => {
    expect(computeExteriorGrade(defects(count))).toBe(expected);
  });
});

describe('damage pin identity and coordinates — Block 5', () => {
  const previousSupabaseUrl = process.env.SUPABASE_URL;
  afterAll(() => { if (previousSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousSupabaseUrl; });
  const firstId = 'ad8203b5-4b1c-4e33-89ad-2aaf77010c41';
  const secondId = 'ad8203b5-4b1c-4e33-89ad-2aaf77010c42';
  const base: DamageDetection = {
    part: 'front-right-door',
    type: 'SCRATCH - small scrape',
    size: 'MODERATE',
    coords: { x: 15, y: 50, view: 'SIDE' },
    imageUrl: 'https://example.test/storage/v1/object/public/listings/seller-id/damage/photo-one.jpg',
  };

  const create = () => {
    process.env.SUPABASE_URL = 'https://example.test';
    const damageRecord = {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    };
    const listing = {
      findUnique: jest.fn().mockResolvedValue({
        id: 'car-one', sellerId: 'seller-id', images: [], status: 'DRAFT',
      }),
      update: jest.fn().mockResolvedValue({ id: 'car-one', exteriorGrade: 2 }),
    };
    const user = { findUnique: jest.fn().mockResolvedValue({ id: 'seller-id', role: 'SELLER', deletedAt: null }) };
    const dealerProfile = { findUnique: jest.fn().mockResolvedValue(null) };
    const dealerStaff = { findFirst: jest.fn().mockResolvedValue(null) };
    const prisma = {
      damageRecord, listing, user, dealerProfile, dealerStaff,
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback({
        damageRecord, listing, user, dealerProfile, dealerStaff,
      })),
    };
    return { service: new DamageAnalysisService(prisma as any), prisma };
  };

  it('keeps two independent IDs and world hit points for two marks on one panel', async () => {
    const { service, prisma } = create();
    const detections: DamageDetection[] = [
      { ...base, id: firstId, coords: { ...base.coords, surfacePoint: { fx: 0.8, fy: 0.42, fz: 0.61 } } },
      { ...base, id: secondId, type: 'DENT - lower edge', imageUrl: 'https://example.test/storage/v1/object/public/listings/seller-id/damage/photo-two.jpg',
        coords: { ...base.coords, surfacePoint: { fx: 0.9, fy: 0.31, fz: 0.33 } } },
    ];
    await service.saveDamageRecords('car-one', detections, 'seller-id');
    expect(prisma.damageRecord.deleteMany).toHaveBeenCalledWith({ where: { listingId: 'car-one' } });
    const saved = prisma.damageRecord.createMany.mock.calls[0][0].data;
    expect(saved).toHaveLength(2);
    expect(saved.map((r: any) => r.id)).toEqual([firstId, secondId]);
    expect(saved.map((r: any) => r.part)).toEqual(['front-right-door', 'front-right-door']);
    expect(saved[0].coords.surfacePoint).toEqual({ fx: 0.8, fy: 0.42, fz: 0.61 });
    expect(saved[1].coords.surfacePoint).toEqual({ fx: 0.9, fy: 0.31, fz: 0.33 });
    expect(saved.map((r: any) => r.imageUrl)).toEqual([
      'https://example.test/photo-one.jpg', 'https://example.test/photo-two.jpg',
    ]);
    expect(prisma.listing.update).toHaveBeenCalledWith({ where: { id: 'car-one' }, data: { exteriorGrade: 2 } });
  });

  it('preserves legacy submissions without IDs or 3D surface positions', async () => {
    const { service, prisma } = create();
    await service.saveDamageRecords('car-one', [{ ...base }], 'seller-id');
    const saved = prisma.damageRecord.createMany.mock.calls[0][0].data[0];
    expect(saved).not.toHaveProperty('id');
    expect(saved.coords).toEqual(base.coords);
  });

  it('rejects duplicate, malformed IDs and out-of-bounds markers before replacing rows', async () => {
    const bad = [
      [{ ...base, id: firstId }, { ...base, id: firstId }],
      [{ ...base, id: 'unsafe-key' }],
      [{ ...base, id: firstId, coords: { ...base.coords, surfacePoint: { fx: 2, fy: 0.5, fz: 0.5 } } }],
    ];
    for (const records of bad) {
      const { service, prisma } = create();
      await expect(service.saveDamageRecords('car-one', records, 'seller-id')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.damageRecord.deleteMany).not.toHaveBeenCalled();
    }
  });
});
