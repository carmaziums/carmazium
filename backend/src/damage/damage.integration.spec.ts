import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DamageAnalysisService, type DamageDetection } from './damage.service';

/**
 * Runs only with DAMAGE_POSTGRES_TEST=1 against disposable PostgreSQL.
 * The CI job creates a brand-new Postgres service; never point this test at
 * production, shared Supabase, or customer records.
 */
const integration = process.env.DAMAGE_POSTGRES_TEST === '1' ? describe : describe.skip;

integration('Real-PostgreSQL damage ownership isolation (disposable CI only)', () => {
  let prisma: PrismaService;
  let service: DamageAnalysisService;
  let ownerId: string;
  let outsiderId: string;
  let dealerId: string;
  let staffId: string;
  let listingId: string;
  const originalUrl = process.env.SUPABASE_URL;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('@127.0.0.1:5432/carmazium_damage_qa')) {
      throw new Error('This test requires the exact disposable CI Postgres host/database.');
    }
    process.env.SUPABASE_URL = 'https://synthetic-damage-qa.supabase.co';
    prisma = new PrismaService();
    service = new DamageAnalysisService(prisma);
    const unique = randomUUID();
    const owner = await prisma.user.create({
      data: { email: 'seller-' + unique + '@invalid.example', passwordHash: 'synthetic', role: 'SELLER' },
    });
    const outsider = await prisma.user.create({
      data: { email: 'other-' + unique + '@invalid.example', passwordHash: 'synthetic', role: 'BUYER' },
    });
    const dealer = await prisma.user.create({
      data: { email: 'dealer-' + unique + '@invalid.example', passwordHash: 'synthetic', role: 'DEALER' },
    });
    const staff = await prisma.user.create({
      data: { email: 'staff-' + unique + '@invalid.example', passwordHash: 'synthetic', role: 'DEALER' },
    });
    ownerId = owner.id;
    outsiderId = outsider.id;
    dealerId = dealer.id;
    staffId = staff.id;
    const listing = await prisma.listing.create({
      data: {
        title: 'Synthetic damage permission test',
        price: 1000, slug: 'damage-integration-' + unique,
        sellerId: ownerId,
        status: 'DRAFT', images: [], videoUrls: [],
      },
    });
    listingId = listing.id;
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      if (listingId) await prisma.listing.deleteMany({ where: { id: listingId } });
      if (ownerId) await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId, dealerId, staffId].filter(Boolean) } } });
      await prisma.$disconnect();
    }
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
  }, 30000);

  it('writes owner damage and preserves it across outsider and forged-photo attempts', async () => {
    const defect: DamageDetection = {
      id: randomUUID(),
      part: 'front-bumper',
      type: 'DENT - synthetic evidence',
      size: 'MEDIUM',
      coords: { x: 40, y: 20, view: 'FRONT', surfacePoint: { fx: 0.2, fy: 0.5, fz: 0.7 } },
      imageUrl: 'https://synthetic-damage-qa.supabase.co/storage/v1/object/public/listings/' + ownerId + '/damage/synthetic.jpg',
    };
    await service.saveDamageRecords(listingId, [defect], ownerId);
    const original = await prisma.damageRecord.findMany({ where: { listingId } });
    expect(original).toHaveLength(1);
    expect(original[0].id).toBe(defect.id);
    expect(original[0].coords).toEqual(defect.coords);
    expect(original[0].imageUrl).toBe(defect.imageUrl);
    await expect(service.saveDamageRecords(listingId, [], outsiderId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.saveDamageRecords(listingId, [{
      ...defect,
      imageUrl: 'https://synthetic-damage-qa.supabase.co/storage/v1/object/public/listings/' + outsiderId + '/damage/foreign.jpg',
    }], ownerId)).rejects.toBeInstanceOf(BadRequestException);
    const after = await prisma.damageRecord.findMany({ where: { listingId } });
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(original[0].id);
    expect(after[0].imageUrl).toBe(original[0].imageUrl);
    await expect(service.getDamageRecords(listingId, outsiderId)).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.getDamageRecords(listingId, ownerId)).toHaveLength(1);
  });

  it('permits only active dealer staff of the owning dealership', async () => {
    const dealer = await prisma.dealerProfile.create({
      data: { userId: ownerId, companyName: 'Synthetic Motors', vatNumber: randomUUID(), isVerified: true },
    });
    await prisma.dealerStaff.create({
      data: { userId: staffId, dealerProfileId: dealer.id, role: 'SALES_AGENT', isActive: true },
    });
    const saved = await prisma.damageRecord.findMany({ where: { listingId } });
    await service.saveDamageRecords(listingId, [{
      id: saved[0].id, part: saved[0].part, type: saved[0].type,
      size: saved[0].size, coords: saved[0].coords as DamageDetection['coords'],
      imageUrl: saved[0].imageUrl || '',
    }], staffId);
    expect(await prisma.damageRecord.count({ where: { listingId } })).toBe(1);
    await prisma.dealerStaff.updateMany({
      where: { userId: staffId, dealerProfileId: dealer.id }, data: { isActive: false },
    });
    await expect(service.saveDamageRecords(listingId, [], staffId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await prisma.damageRecord.count({ where: { listingId } })).toBe(1);
    await prisma.dealerStaff.deleteMany({ where: { dealerProfileId: dealer.id } });
    await prisma.dealerProfile.delete({ where: { id: dealer.id } });
  });
});
