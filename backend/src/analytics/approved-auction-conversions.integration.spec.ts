import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovedAuctionConversionsService, queueApprovedAuctionConversion } from './approved-auction-conversions';

const integration = process.env.APPROVAL_POSTGRES_TEST === '1' ? describe : describe.skip;
integration('Approved auction delivery on disposable PostgreSQL', () => {
    let db: PrismaService;
    let service: ApprovedAuctionConversionsService;
    let sellerId: string;
    let listingId: string;
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;
    beforeAll(() => {
        const url = new URL(process.env.DATABASE_URL || 'https://invalid');
        if (url.hostname !== '127.0.0.1' || url.port !== '5432' || url.pathname !== '/carmazium_approval_qa') {
            throw Error('Disposable approval QA database only');
        }
        db = new PrismaService();
        service = new ApprovedAuctionConversionsService(db);
        process.env.GA4_APPROVED_AUCTIONS_ENABLED = 'true';
        process.env.GA4_MEASUREMENT_ID = 'G-TEST';
        process.env.GA4_MEASUREMENT_PROTOCOL_API_SECRET = 'synthetic-never-send';
    });
    beforeEach(async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });
        const user = await db.user.create({ data: { email: `${randomUUID()}@invalid.example`, role: 'SELLER', passwordHash: 'synthetic' } });
        sellerId = user.id;
        const listing = await db.listing.create({ data: {
            sellerId, type: 'AUCTION', status: 'PENDING_REVIEW', title: 'Isolated approval QA',
            slug: randomUUID(), price: 1, images: [], videoUrls: [],
        } });
        listingId = listing.id;
    });
    afterEach(async () => {
        await db.listing.deleteMany({ where: { id: listingId } });
        await db.user.deleteMany({ where: { id: sellerId } });
    });
    afterAll(async () => {
        global.fetch = originalFetch;
        process.env = { ...originalEnv };
        await db?.$disconnect();
    });
    const capture = () => service.capture(sellerId, {
        listingId, clientId: '123.456', consentAt: new Date().toISOString(),
    });
    const approve = () => db.$transaction(async tx => {
        await tx.listing.update({ where: { id: listingId }, data: { status: 'ACTIVE' } });
        await queueApprovedAuctionConversion(tx, { id: listingId, sellerId, type: 'AUCTION' });
    });

    it('keeps both internal tracking tables behind row-level security', async () => {
        const tables = await db.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`
            SELECT relname, relrowsecurity FROM pg_class
            WHERE oid IN ('public.seller_conversion_consents'::regclass, 'public.approved_auction_conversions'::regclass)`;
        expect(tables).toHaveLength(2);
        expect(tables.every(table => table.relrowsecurity)).toBe(true);
    });

    it('serializes competing captures and workers into one record and one send attempt', async () => {
        await Promise.all([capture(), capture()]);
        expect(await db.approvedAuctionConversion.count({ where: { listingId } })).toBe(1);
        await approve();
        await Promise.all([service.dispatchPending(), new ApprovedAuctionConversionsService(db).dispatchPending()]);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(await db.approvedAuctionConversion.findUnique({ where: { listingId } })).toMatchObject({
            state: 'ACKNOWLEDGED', clientId: null, sessionId: null,
        });
        await approve();
        await service.dispatchPending();
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    it('rolls back the queued conversion with a failed approval transaction', async () => {
        await capture();
        await expect(db.$transaction(async tx => {
            await tx.listing.update({ where: { id: listingId }, data: { status: 'ACTIVE' } });
            await queueApprovedAuctionConversion(tx, { id: listingId, sellerId, type: 'AUCTION' });
            throw Error('synthetic rollback');
        })).rejects.toThrow('synthetic rollback');
        expect(await db.listing.findUnique({ where: { id: listingId } })).toMatchObject({ status: 'PENDING_REVIEW' });
        expect(await db.approvedAuctionConversion.findUnique({ where: { listingId } })).toMatchObject({ state: 'CAPTURED', approvedAt: null });
        await service.dispatchPending();
        expect(global.fetch).not.toHaveBeenCalled();
    });
    it('withdrawal wins over a delayed request with an older consent decision', async () => {
        const oldConsent = new Date(Date.now() - 60_000).toISOString();
        await capture();
        await approve();
        await service.revoke(sellerId);
        await service.capture(sellerId, { listingId, clientId: '789.012', consentAt: oldConsent });
        await service.dispatchPending();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(await db.approvedAuctionConversion.findUnique({ where: { listingId } })).toMatchObject({ state: 'REVOKED', clientId: null });
    });
});
