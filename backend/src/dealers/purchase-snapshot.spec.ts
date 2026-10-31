import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DealersService } from './dealers.service';
import { buildListingRecordData, capturePurchaseSnapshot, sweepMissingPurchaseSnapshots } from './purchase-listing-record';

const listingRow = (over: Record<string, unknown> = {}) => ({
    title: 'Volvo XC60 2017', images: ['https://example.test/1.jpg', 'https://example.test/2.jpg'],
    year: 2017, make: 'Volvo', model: 'XC60', mileage: 84000, vrm: 'EX17 ABC',
    description: 'One owner', numberOfKeys: 2, mechanicalIssues: 'Clutch judder',
    motExpiryDate: new Date('2027-01-01T00:00:00Z'),
    updatedAt: new Date('2026-10-31T09:00:00Z'), deletedAt: null,
    damageRecords: [{ id: 'd1', part: 'Front Bumper', type: 'Scratch', size: '0-5cm', coords: { x: 1 }, imageUrl: 'https://example.test/d1.jpg' }],
    ...over,
});

describe('purchase listing snapshot', () => {
    const OLD = process.env.PURCHASE_SNAPSHOTS_ENABLED;
    afterEach(() => {
        if (OLD === undefined) delete process.env.PURCHASE_SNAPSHOTS_ENABLED;
        else process.env.PURCHASE_SNAPSHOTS_ENABLED = OLD;
    });

    it('builds plain JSON listing evidence without seller contact', () => {
        const data = buildListingRecordData({ ...listingRow(), sellerEmail: 'x@y.z', sellerPhone: '0700', seller: { email: 'x@y.z' } });
        expect(data.images).toHaveLength(2);
        expect(data.motExpiryDate).toBe('2027-01-01T00:00:00.000Z');
        expect(data.sellerDeclarations.mechanicalIssues).toBe('Clutch judder');
        expect(data.damage[0]).toMatchObject({ part: 'Front Bumper', imageUrl: 'https://example.test/d1.jpg' });
        const json = JSON.stringify(data);
        for (const key of ['sellerEmail', 'sellerPhone', 'seller"', 'x@y.z']) expect(json).not.toContain(key);
    });

    it('does nothing while the flag is off, so it is safe before the migration', async () => {
        delete process.env.PURCHASE_SNAPSHOTS_ENABLED;
        const prisma: any = { sale: { findUnique: jest.fn() }, listing: { findUnique: jest.fn() }, purchaseListingSnapshot: { upsert: jest.fn() } };
        await capturePurchaseSnapshot(prisma, { listingId: 'l1', buyerId: 'b1' });
        expect(prisma.sale.findUnique).not.toHaveBeenCalled();
        expect(prisma.purchaseListingSnapshot.upsert).not.toHaveBeenCalled();
    });

    it('captures once per listing and buyer and never overwrites the first capture', async () => {
        process.env.PURCHASE_SNAPSHOTS_ENABLED = 'true';
        const prisma: any = {
            sale: { findUnique: jest.fn().mockResolvedValue({ id: 's1', buyerId: 'b1' }) },
            listing: { findUnique: jest.fn().mockResolvedValue(listingRow()) },
            purchaseListingSnapshot: { upsert: jest.fn().mockResolvedValue({}) },
        };
        await capturePurchaseSnapshot(prisma, { listingId: 'l1', buyerId: 'b1' });
        const call = prisma.purchaseListingSnapshot.upsert.mock.calls[0][0];
        // One per Sale, so a repeat purchase after a cancellation is separate.
        expect(call.where).toEqual({ saleId: 's1' });
        expect(call.update).toEqual({});
        expect(call.create).toMatchObject({ listingId: 'l1', buyerId: 'b1', saleId: 's1' });
        expect(call.create.data.description).toBe('One owner');
    });

    it('skips when no sale exists for that buyer, and never throws', async () => {
        process.env.PURCHASE_SNAPSHOTS_ENABLED = 'true';
        const prisma: any = {
            sale: { findUnique: jest.fn().mockResolvedValue({ id: 's1', buyerId: 'someone-else' }) },
            listing: { findUnique: jest.fn() },
            purchaseListingSnapshot: { upsert: jest.fn() },
        };
        await capturePurchaseSnapshot(prisma, { listingId: 'l1', buyerId: 'b1' });
        expect(prisma.purchaseListingSnapshot.upsert).not.toHaveBeenCalled();
        prisma.sale.findUnique.mockRejectedValue(new Error('relation does not exist'));
        await expect(capturePurchaseSnapshot(prisma, { listingId: 'l1', buyerId: 'b1' }, [])).resolves.toBeUndefined();
    });
});

describe('purchase detail with snapshot, and inspection notes', () => {
    const OLD = process.env.PURCHASE_SNAPSHOTS_ENABLED;
    let prisma: any;
    let service: DealersService;

    beforeEach(() => {
        process.env.PURCHASE_SNAPSHOTS_ENABLED = 'true';
        prisma = {
            dealerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'dealer-1', userId: 'owner-1', isVerified: true }) },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            sale: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'sale-1', listingId: 'listing-1', soldPrice: 7500,
                    createdAt: new Date('2026-10-30T16:46:00Z'), purchaseStatus: 'AWAITING_CONFIRMATION',
                    listing: {
                        id: 'listing-1', slug: 's', type: 'CLASSIFIED', status: 'SOLD', location: 'Leeds',
                        ...listingRow({ description: 'Edited after sale', deletedAt: new Date('2026-11-01T00:00:00Z') }),
                        auction: null,
                    },
                }),
            },
            serviceJob: { findFirst: jest.fn().mockResolvedValue(null) },
            purchaseListingSnapshot: {
                findUnique: jest.fn().mockResolvedValue({
                    capturedAt: new Date('2026-10-30T16:46:01Z'),
                    data: buildListingRecordData(listingRow()),
                }),
            },
            purchaseInspectionNote: {
                findMany: jest.fn().mockResolvedValue([]),
                create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'n1', ...data, createdAt: new Date('2026-11-02T10:00:00Z') })),
            },
        };
        service = new DealersService(prisma, {} as any, {} as any, {} as any);
    });
    afterEach(() => {
        if (OLD === undefined) delete process.env.PURCHASE_SNAPSHOTS_ENABLED;
        else process.env.PURCHASE_SNAPSHOTS_ENABLED = OLD;
    });

    it('serves the purchase-time snapshot, not the later edit, and flags removal', async () => {
        const result: any = await service.getDealerPurchaseDetail('owner-1', 'sale-1');
        expect(result.listingRecord.source).toBe('PURCHASE_SNAPSHOT');
        expect(result.listingRecord.description).toBe('One owner');
        expect(result.listingRecord.capturedAt).toBe('2026-10-30T16:46:01.000Z');
        expect(result.listingRecord.removedFromSaleAt).toBe('2026-11-01T00:00:00.000Z');
        expect(prisma.purchaseListingSnapshot.findUnique).toHaveBeenCalledWith(expect.objectContaining({
            where: { saleId: 'sale-1' },
        }));
    });

    it('falls back to the labelled current listing for older purchases', async () => {
        prisma.purchaseListingSnapshot.findUnique.mockResolvedValue(null);
        const result: any = await service.getDealerPurchaseDetail('owner-1', 'sale-1');
        expect(result.listingRecord.source).toBe('CURRENT_LISTING');
        expect(result.listingRecord.capturedAt).toBeNull();
        expect(result.listingRecord.description).toBe('Edited after sale');
    });

    it('adds an append-only note without touching the sale', async () => {
        const note: any = await service.addPurchaseInspectionNote('owner-1', 'sale-1', {
            kind: 'NEW_DAMAGE', part: ' Rear bumper ', description: '  Dent not shown in advert  ',
        });
        expect(prisma.purchaseInspectionNote.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ listingId: 'listing-1', buyerId: 'owner-1', saleId: 'sale-1', authorId: 'owner-1', part: 'Rear bumper', description: 'Dent not shown in advert' }),
        }));
        expect(note.byYou).toBe(true);
        expect(prisma.sale.update).toBeUndefined();
    });

    it('scopes notes to the purchasing dealership and refuses when switched off', async () => {
        prisma.sale.findFirst.mockResolvedValueOnce(null);
        await expect(service.getPurchaseInspectionNotes('owner-1', 'foreign')).rejects.toBeInstanceOf(NotFoundException);
        process.env.PURCHASE_SNAPSHOTS_ENABLED = 'false';
        await expect(service.getPurchaseInspectionNotes('owner-1', 'sale-1')).resolves.toEqual({ enabled: false, canAdd: false, notes: [] });
        await expect(service.addPurchaseInspectionNote('owner-1', 'sale-1', { kind: 'GENERAL', description: 'abc' }))
            .rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(prisma.purchaseInspectionNote.create).not.toHaveBeenCalled();
    });

    it('notes are read by Sale id and need MANAGE_INVENTORY to add (finance staff can only read)', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'FINANCE_MANAGER', dealerProfile: { id: 'dealer-1', userId: 'owner-1', isVerified: true },
        });
        const read: any = await service.getPurchaseInspectionNotes('finance-1', 'sale-1');
        expect(read.canAdd).toBe(false);
        expect(prisma.purchaseInspectionNote.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { saleId: 'sale-1', buyerId: 'owner-1' },
        }));
        await expect(service.addPurchaseInspectionNote('finance-1', 'sale-1', { kind: 'GENERAL', description: 'abc' }))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.purchaseInspectionNote.create).not.toHaveBeenCalled();
    });

    it('labels a snapshot saved later by the sweep', async () => {
        prisma.purchaseListingSnapshot.findUnique.mockResolvedValue({
            capturedAt: new Date('2026-10-30T18:00:00Z'), data: buildListingRecordData(listingRow()),
        });
        const result: any = await service.getDealerPurchaseDetail('owner-1', 'sale-1');
        expect(result.listingRecord.capturedAfterSale).toBe(true);
    });
});

describe('purchase snapshot retries and sweep', () => {
    const OLD = process.env.PURCHASE_SNAPSHOTS_ENABLED;
    beforeEach(() => { process.env.PURCHASE_SNAPSHOTS_ENABLED = 'true'; });
    afterEach(() => {
        if (OLD === undefined) delete process.env.PURCHASE_SNAPSHOTS_ENABLED;
        else process.env.PURCHASE_SNAPSHOTS_ENABLED = OLD;
    });

    it('retries a failed capture before giving up', async () => {
        const prisma: any = {
            sale: { findUnique: jest.fn()
                .mockRejectedValueOnce(new Error('connection reset'))
                .mockResolvedValue({ id: 's1', buyerId: 'b1' }) },
            listing: { findUnique: jest.fn().mockResolvedValue(listingRow()) },
            purchaseListingSnapshot: { upsert: jest.fn().mockResolvedValue({}) },
        };
        await capturePurchaseSnapshot(prisma, { listingId: 'l1', buyerId: 'b1' }, [0, 0]);
        expect(prisma.sale.findUnique).toHaveBeenCalledTimes(2);
        expect(prisma.purchaseListingSnapshot.upsert).toHaveBeenCalledTimes(1);
    });

    it('sweep captures recent sales that have no snapshot, and is off with the flag', async () => {
        const prisma: any = {
            $queryRaw: jest.fn().mockResolvedValue([{ listingId: 'l1', buyerId: 'b1' }]),
            sale: { findUnique: jest.fn().mockResolvedValue({ id: 's1', buyerId: 'b1' }) },
            listing: { findUnique: jest.fn().mockResolvedValue(listingRow()) },
            purchaseListingSnapshot: { upsert: jest.fn().mockResolvedValue({}) },
        };
        await expect(sweepMissingPurchaseSnapshots(prisma)).resolves.toBe(1);
        expect(prisma.purchaseListingSnapshot.upsert.mock.calls[0][0].update).toEqual({});
        process.env.PURCHASE_SNAPSHOTS_ENABLED = 'false';
        prisma.$queryRaw.mockClear();
        await expect(sweepMissingPurchaseSnapshots(prisma)).resolves.toBe(0);
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
});
