import { ApprovedAuctionConversionsService, queueApprovedAuctionConversion } from './approved-auction-conversions';
import { ApprovedAuctionConversionsController } from './approved-auction-conversions.controller';

describe('Admin-approved auction measurement', () => {
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;
    beforeEach(() => {
        process.env.GA4_APPROVED_AUCTIONS_ENABLED = 'true';
        process.env.GA4_MEASUREMENT_ID = 'G-TEST123';
        process.env.GA4_MEASUREMENT_PROTOCOL_API_SECRET = 'test-secret';
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    });
    afterEach(() => { process.env = { ...originalEnv }; global.fetch = originalFetch; });

    function setup(over: Record<string, any> = {}) {
        let row: any = { listingId: 'listing-1', userId: 'seller-1', clientId: '123.456', sessionId: String(Math.floor(Date.now() / 1000) - 60),
            capturedAt: new Date(Date.now() - 60_000), approvedAt: new Date(), state: 'PENDING',
            user: { role: 'SELLER', deletedAt: null }, listing: { sellerId: 'seller-1', deletedAt: null }, ...over };
        let consent: any = { userId: 'seller-1', allowed: true, decidedAt: new Date(Date.now() - 120_000) };
        const matches = (where: any) => row && (!where.state || (typeof where.state === 'string'
            ? row.state === where.state : where.state.in.includes(row.state)))
            && (where.approvedAt !== null || row.approvedAt === null);
        const db: any = {
            $executeRaw: jest.fn().mockResolvedValue(1),
            user: { findUnique: jest.fn().mockResolvedValue({ role: 'SELLER', deletedAt: null }) },
            listing: { findFirst: jest.fn().mockResolvedValue({ id: 'listing-1' }) },
            sellerConversionConsent: {
                findUnique: jest.fn(async () => consent),
                upsert: jest.fn(async ({ create, update }) => { consent = consent ? { ...consent, ...update } : create; return consent; }),
            },
            approvedAuctionConversion: {
                findMany: jest.fn(async () => row?.state === 'PENDING' ? [{ ...row }] : []),
                findUnique: jest.fn(async () => row ? { ...row } : null),
                create: jest.fn(async ({ data }) => { row = data; return row; }),
                updateMany: jest.fn(async ({ where, data }) => { if (!matches(where)) return { count: 0 }; row = { ...row, ...data }; return { count: 1 }; }),
                update: jest.fn(async ({ data }) => { row = { ...row, ...data }; return row; }),
            },
        };
        db.$transaction = jest.fn(async callback => callback(db));
        return { db, service: new ApprovedAuctionConversionsService(db), row: () => row,
            revoke: () => { consent.allowed = false; }, setConsent: (value: any) => { consent = value; } };
    }

    it('does not send anything while the feature is disabled or secret is missing', async () => {
        const { service, db } = setup();
        delete process.env.GA4_APPROVED_AUCTIONS_ENABLED;
        await service.dispatchPending();
        process.env.GA4_APPROVED_AUCTIONS_ENABLED = 'true';
        delete process.env.GA4_MEASUREMENT_PROTOCOL_API_SECRET;
        await service.dispatchPending();
        expect(db.approvedAuctionConversion.findMany).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });
    it.each(['CLASSIFIED', 'ADMIN'])('does not queue %s as a seller auction', async type => {
        const { db } = setup();
        if (type === 'ADMIN') db.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
        await queueApprovedAuctionConversion(db, { id: 'listing-1', sellerId: 'seller-1', type: type === 'ADMIN' ? 'AUCTION' : type });
        expect(db.approvedAuctionConversion.updateMany).not.toHaveBeenCalled();
    });
    it('queues a captured auction exactly once using the approval transaction', async () => {
        const { db, row } = setup({ state: 'CAPTURED', approvedAt: null });
        await queueApprovedAuctionConversion(db, { id: 'listing-1', sellerId: 'seller-1', type: 'AUCTION' });
        const approval = row().approvedAt;
        await queueApprovedAuctionConversion(db, { id: 'listing-1', sellerId: 'seller-1', type: 'AUCTION' });
        expect(row().state).toBe('PENDING');
        expect(row().approvedAt).toBe(approval);
        expect(global.fetch).not.toHaveBeenCalled();
    });
    it('sends the seller client ID and actual approval time once; no customer or vehicle PII', async () => {
        const { service, row } = setup();
        const approvedAt = row().approvedAt;
        const sessionId = row().sessionId;
        await service.dispatchPending();
        await service.dispatchPending();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, request] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url.hostname).toBe('region1.google-analytics.com');
        const body = JSON.parse(request.body);
        expect(body).toEqual({ client_id: '123.456', timestamp_micros: approvedAt.getTime() * 1000,
            consent: { ad_user_data: 'GRANTED', ad_personalization: 'GRANTED' },
            events: [{ name: 'auction_listing_approved', params: { listing_id: 'listing-1', listing_type: 'auction',
                qualification: 'admin_approved', event_id: 'approved_auction:listing-1', session_id: sessionId } }] });
        expect(row()).toMatchObject({ state: 'ACKNOWLEDGED', clientId: null, sessionId: null });
    });
    it('only one worker wins a concurrent claim', async () => {
        const { service, db } = setup();
        await Promise.all([service.dispatchPending(), new ApprovedAuctionConversionsService(db).dispatchPending()]);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    it.each([
        { clientId: null }, { approvedAt: null }, { user: { role: 'ADMIN' } },
        { user: { role: 'SELLER', deletedAt: new Date() } },
        { listing: { sellerId: 'different-owner' } }, { listing: { sellerId: 'seller-1', deletedAt: new Date() } },
        { capturedAt: new Date(Date.now() - 49 * 3_600_000) },
    ])('does not send ineligible rows: %j', async over => {
        const { service } = setup(over);
        await service.dispatchPending();
        expect(global.fetch).not.toHaveBeenCalled();
    });
    it('rechecks consent immediately before dispatch', async () => {
        const { service, revoke, row } = setup();
        revoke();
        await service.dispatchPending();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(row()).toMatchObject({ state: 'REVOKED', clientId: null });
    });
    it.each([false, true])('does not replay an ambiguous or rejected request (timeout=%s)', async timeout => {
        const { service, row } = setup();
        if (timeout) (global.fetch as jest.Mock).mockRejectedValue(new Error('private request URL'));
        else (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 400 });
        await service.dispatchPending();
        await service.dispatchPending();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(row().state).toBe(timeout ? 'UNCERTAIN' : 'FAILED');
        expect(row().clientId).toBeNull();
        expect(row().failureCode).not.toContain('private');
    });
    it('does not attach an old session ID to a later approval', async () => {
        const { service } = setup({ sessionId: String(Math.floor(Date.now() / 1000) - 25 * 3600) });
        await service.dispatchPending();
        const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.events[0].params.session_id).toBeUndefined();
    });
    it('cannot capture another seller, an admin listing, or an already live listing', async () => {
        const { service, db } = setup();
        db.listing.findFirst.mockResolvedValue(null);
        expect(await service.capture('seller-1', { listingId: 'listing-1', clientId: '123.456', consentAt: new Date().toISOString() })).toEqual({ captured: false });
        expect(db.listing.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
            sellerId: 'seller-1', type: 'AUCTION', status: { in: ['DRAFT', 'PENDING_REVIEW', 'REJECTED'] },
            seller: { role: { not: 'ADMIN' }, deletedAt: null },
        }) }));
        expect(db.approvedAuctionConversion.create).not.toHaveBeenCalled();
    });
    it('does not resurrect revoked consent from a delayed old browser request', async () => {
        const { service, setConsent, db } = setup({ approvedAt: null, state: 'REVOKED' });
        setConsent({ allowed: false, decidedAt: new Date() });
        expect(await service.capture('seller-1', { listingId: 'listing-1', clientId: '123.456',
            consentAt: new Date(Date.now() - 60_000).toISOString() })).toEqual({ captured: false });
        expect(db.approvedAuctionConversion.updateMany).not.toHaveBeenCalled();
    });
    it('does not reset a previously dispatched approval on resubmission', async () => {
        const { service, db } = setup({ state: 'ACKNOWLEDGED' });
        expect(await service.capture('seller-1', { listingId: 'listing-1', clientId: '123.456', consentAt: new Date().toISOString() })).toEqual({ captured: false });
        expect(db.approvedAuctionConversion.updateMany).not.toHaveBeenCalled();
    });
    it('revoke removes queued identifiers', async () => {
        const { service, row } = setup();
        await service.revoke('seller-1');
        expect(row()).toMatchObject({ state: 'REVOKED', clientId: null, sessionId: null });
    });
    it('requires a verified bearer identity and ignores cookie/body identities', async () => {
        const auth = { verifySupabaseToken: jest.fn().mockResolvedValue({ id: 'verified' }) };
        const service = { capture: jest.fn(), revoke: jest.fn() };
        const controller = new ApprovedAuctionConversionsController(service as any, auth as any);
        await expect(controller.capture({} as any, { headers: {}, user: { id: 'cookie-user' } } as any)).rejects.toThrow();
        const body = { userId: 'forged', listingId: 'one' };
        await controller.capture(body as any, { headers: { authorization: 'Bearer test' } } as any);
        expect(service.capture).toHaveBeenCalledWith('verified', body);
        auth.verifySupabaseToken.mockRejectedValue(new Error('bad token'));
        await expect(controller.revoke({ headers: { authorization: 'Bearer bad' } } as any)).rejects.toThrow();
    });
});
