import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DamageAnalysisService, type DamageDetection } from './damage.service';

describe('Damage issue #521 — transactional owner/staff authorization', () => {
  const oldUrl = process.env.SUPABASE_URL;
  beforeAll(() => { process.env.SUPABASE_URL = 'https://project.supabase.co'; });
  afterAll(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
  });

  const owner = 'aafb30db-88b8-4db1-9078-b18e041def12';
  const outsider = 'f034cfa1-35df-4be6-a010-864979a89326';
  const proof = 'https://project.supabase.co/storage/v1/object/public/listings/' + owner + '/damage/proof.jpg';
  const defect: DamageDetection = {
    id: 'cf818a81-8dc1-413b-9dd9-b7ebdb182248',
    part: 'front-right-door',
    type: 'DENT - right door',
    size: 'MODERATE',
    coords: { x: 20, y: 50, view: 'SIDE', surfacePoint: { fx: 0.8, fy: 0.5, fz: 0.2 } },
    imageUrl: proof,
  };

  const harness = (options: {
    caller?: string; role?: string; sellerId?: string | null; deleted?: boolean;
    membershipRole?: string; membershipActive?: boolean; dealerId?: string; staffDealerId?: string;
    status?: string; existing?: { id: string; imageUrl: string | null }[];
    images?: string[];
  } = {}) => {
    const caller = options.caller ?? owner;
    const sellerId = options.sellerId === undefined ? owner : options.sellerId;
    const listing = {
      findUnique: jest.fn().mockResolvedValue({
        id: 'listing-one', sellerId, status: options.status ?? 'DRAFT', images: options.images ?? [],
      }),
      update: jest.fn().mockResolvedValue({ id: 'listing-one', exteriorGrade: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const user = {
      findUnique: jest.fn().mockResolvedValue({
        id: caller, role: options.role ?? 'SELLER', deletedAt: options.deleted ? new Date() : null,
      }),
    };
    const dealerProfile = {
      findUnique: jest.fn().mockResolvedValue(options.dealerId ? { id: options.dealerId } : null),
    };
    const dealerStaff = {
      // Simulate Prisma's actual where filtering: unrelated dealership,
      // inactive status and unpermitted roles MUST return no matching row.
      findFirst: jest.fn().mockImplementation(async (args: {
        where: { userId: string; dealerProfileId: string; isActive: boolean; role: { in: string[] } };
      }) => options.membershipRole
          && options.membershipActive
          && args.where.userId === caller
          && args.where.dealerProfileId === (options.staffDealerId ?? options.dealerId)
          && args.where.isActive === true
          && args.where.role.in.includes(options.membershipRole)
        ? { id: 'staff-member', role: options.membershipRole }
        : null),
    };
    const damageRecord = {
      findMany: jest.fn().mockResolvedValue(options.existing ?? []),
      findFirst: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const tx = { listing, user, dealerProfile, dealerStaff, damageRecord };
    const prisma = {
      ...tx,
      $transaction: jest.fn(async (action: (client: any) => Promise<unknown>) => action(tx)),
    };
    return { service: new DamageAnalysisService(prisma as any), prisma, tx, caller };
  };

  const assertUnchanged = (h: ReturnType<typeof harness>) => {
    expect(h.tx.damageRecord.deleteMany).not.toHaveBeenCalled();
    expect(h.tx.damageRecord.createMany).not.toHaveBeenCalled();
    expect(h.tx.listing.update).not.toHaveBeenCalled();
  };

  it('requires authenticated principal even when the route guard is bypassed in a unit test', async () => {
    const h = harness();
    await expect(h.service.saveDamageRecords('listing-one', [defect], '')).rejects.toBeInstanceOf(UnauthorizedException);
    assertUnchanged(h);
  });

  it('accepts the exact listing owner and stores the same defect UUID/photo in one transaction', async () => {
    const h = harness();
    await h.service.saveDamageRecords('listing-one', [defect], owner);
    expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(h.tx.damageRecord.deleteMany).toHaveBeenCalledWith({ where: { listingId: 'listing-one' } });
    const row = h.tx.damageRecord.createMany.mock.calls[0][0].data[0];
    expect(row.id).toBe(defect.id);
    expect(row.imageUrl).toBe(proof);
    expect(row.coords.surfacePoint).toEqual(defect.coords.surfacePoint);
    expect(h.tx.listing.update).toHaveBeenCalledWith({
      where: { id: 'listing-one', sellerId: owner }, data: { exteriorGrade: 1 },
    });
  });

  it('copies the real 3D evidence to a reciprocal retail/auction sibling using new record IDs', async () => {
    const h = harness();
    h.tx.listing.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === 'listing-two'
        ? {
            id: 'listing-two', sellerId: owner, vrm: 'AB12CDE',
            type: 'CLASSIFIED', linkedListingId: 'listing-one',
            status: 'ACTIVE', deletedAt: null,
          }
        : {
            id: 'listing-one', sellerId: owner, vrm: 'AB12CDE',
            type: 'AUCTION', linkedListingId: 'listing-two',
            status: 'ACTIVE', images: [],
          },
    );
    await h.service.saveDamageRecords('listing-one', [defect], owner);
    expect(h.tx.damageRecord.deleteMany).toHaveBeenCalledWith({ where: { listingId: 'listing-two' } });
    expect(h.tx.damageRecord.createMany).toHaveBeenCalledTimes(2);
    const copied = h.tx.damageRecord.createMany.mock.calls[1][0].data[0];
    expect(copied).toMatchObject({
      listingId: 'listing-two', part: defect.part, type: defect.type,
      size: defect.size, imageUrl: proof, coords: defect.coords,
    });
    expect(copied).not.toHaveProperty('id');
    expect(h.tx.listing.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'listing-two', linkedListingId: 'listing-one' }),
      data: { exteriorGrade: 1 },
    }));
  });

  it('does not copy damage records across unrelated or non-reciprocal listings', async () => {
    const h = harness();
    h.tx.listing.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === 'listing-two'
        ? {
            id: 'listing-two', sellerId: outsider, vrm: 'AB12CDE',
            type: 'CLASSIFIED', linkedListingId: 'listing-one',
            status: 'ACTIVE', deletedAt: null,
          }
        : {
            id: 'listing-one', sellerId: owner, vrm: 'AB12CDE',
            type: 'AUCTION', linkedListingId: 'listing-two',
            status: 'ACTIVE', images: [],
          },
    );
    await h.service.saveDamageRecords('listing-one', [defect], owner);
    expect(h.tx.damageRecord.createMany).toHaveBeenCalledTimes(1);
    expect(h.tx.listing.updateMany).not.toHaveBeenCalled();
  });

  it('blocks a different seller or retail buyer before reading or replacing any damage', async () => {
    for (const role of ['SELLER', 'BUYER', 'DEALER']) {
      const h = harness({ caller: outsider, role });
      await expect(h.service.saveDamageRecords('listing-one', [defect], outsider))
        .rejects.toBeInstanceOf(ForbiddenException);
      assertUnchanged(h);
    }
  });

  it('grants a verified active dealership membership only for the correct dealership and inventory-capable roles', async () => {
    for (const role of ['ADMIN', 'SALES_AGENT']) {
      const h = harness({ caller: outsider, role: 'DEALER', dealerId: 'owner-dealer',
        membershipRole: role, membershipActive: true });
      await h.service.saveDamageRecords('listing-one', [defect], outsider);
      expect(h.tx.dealerStaff.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ userId: outsider, dealerProfileId: 'owner-dealer', isActive: true }),
      }));
      expect(h.tx.damageRecord.createMany).toHaveBeenCalledTimes(1);
    }
    for (const opts of [
      { membershipRole: 'SALES_AGENT', membershipActive: false },
      { membershipRole: 'FINANCE_MANAGER', membershipActive: true },
      { membershipRole: undefined, membershipActive: true },
      { membershipRole: 'ADMIN', membershipActive: true, staffDealerId: 'other-dealership' },
    ]) {
      const h = harness({ caller: outsider, dealerId: 'owner-dealer', ...opts });
      await expect(h.service.saveDamageRecords('listing-one', [defect], outsider)).rejects.toBeInstanceOf(ForbiddenException);
      assertUnchanged(h);
    }
  });

  it('permits a current database administrator but not a soft-deleted account', async () => {
    const admin = harness({ caller: outsider, role: 'ADMIN' });
    await admin.service.saveDamageRecords('listing-one', [defect], outsider);
    expect(admin.tx.damageRecord.createMany).toHaveBeenCalledTimes(1);
    const deleted = harness({ caller: owner, role: 'ADMIN', deleted: true });
    await expect(deleted.service.saveDamageRecords('listing-one', [defect], owner)).rejects.toBeInstanceOf(UnauthorizedException);
    assertUnchanged(deleted);
  });

  it('denies unknown or ownerless listing IDs, including missing listing read', async () => {
    const h = harness();
    h.tx.listing.findUnique.mockResolvedValueOnce(null);
    await expect(h.service.saveDamageRecords('missing', [defect], owner)).rejects.toBeInstanceOf(NotFoundException);
    assertUnchanged(h);
    const ownerless = harness({ sellerId: null });
    await expect(ownerless.service.saveDamageRecords('listing-one', [defect], owner)).rejects.toBeInstanceOf(ForbiddenException);
    assertUnchanged(ownerless);
  });

  it('rejects foreign URLs, local URIs, reused foreign-record IDs and malformed coordinates before mutation', async () => {
    const cases: DamageDetection[] = [
      { ...defect, imageUrl: 'https://evil.example/picture.jpg' },
      { ...defect, imageUrl: 'file:///private/tmp/photo.jpg' },
      { ...defect, imageUrl: 'https://project.supabase.co/storage/v1/object/public/listings/' + outsider + '/damage/foreign.jpg' },
      { ...defect, coords: { ...defect.coords, x: Number.NaN } },
      { ...defect, coords: { ...defect.coords, surfacePoint: { fx: -1, fy: 0.5, fz: 0.5 } } },
    ];
    for (const candidate of cases) {
      const h = harness();
      await expect(h.service.saveDamageRecords('listing-one', [candidate], owner))
        .rejects.toBeInstanceOf(BadRequestException);
      assertUnchanged(h);
    }
    const h = harness();
    h.tx.damageRecord.findFirst.mockResolvedValueOnce({ id: defect.id });
    await expect(h.service.saveDamageRecords('listing-one', [defect], owner))
      .rejects.toBeInstanceOf(BadRequestException);
    assertUnchanged(h);
  });

  it('allows exact legacy existing listing photo URLs and empty damage sets', async () => {
    const oldPhoto = 'https://legacy-cdn.example/seller-pic.jpg';
    const h = harness({ existing: [{ id: defect.id!, imageUrl: oldPhoto }] });
    await h.service.saveDamageRecords('listing-one', [{ ...defect, imageUrl: oldPhoto }], owner);
    expect(h.tx.damageRecord.createMany).toHaveBeenCalledTimes(1);
    const cleared = harness();
    await cleared.service.saveDamageRecords('listing-one', [], owner);
    expect(cleared.tx.damageRecord.deleteMany).toHaveBeenCalledTimes(1);
    expect(cleared.tx.damageRecord.createMany).not.toHaveBeenCalled();
  });

  it('keeps unpublished listing records private but allows public ACTIVE records', async () => {
    const privateListing = harness({ status: 'DRAFT' });
    await expect(privateListing.service.getDamageRecords('listing-one')).rejects.toBeInstanceOf(NotFoundException);
    await expect(privateListing.service.getDamageRecords('listing-one', outsider)).rejects.toBeInstanceOf(NotFoundException);
    await privateListing.service.getDamageRecords('listing-one', owner);
    expect(privateListing.tx.damageRecord.findMany).toHaveBeenCalledWith({ where: { listingId: 'listing-one' } });
    const visible = harness({ status: 'ACTIVE' });
    await visible.service.getDamageRecords('listing-one');
    expect(visible.tx.damageRecord.findMany).toHaveBeenCalledWith({ where: { listingId: 'listing-one' } });
  });
});
