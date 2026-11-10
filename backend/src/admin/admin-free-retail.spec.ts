import { AdminService } from './admin.service';
const completeDraft = {
    id: 'listing-1',
    sellerId: 'seller-1',
    seller: { id: 'seller-1', deletedAt: null },
    type: 'CLASSIFIED',
    status: 'DRAFT',
    deletedAt: null,
    linkedListingId: null,
    title: '2019 Renault Kadjar',
    vrm: 'AB12 CDE',
    price: 6100,
    images: Array.from({ length: 10 }, (_, i) => 'image-' + i),
    make: 'Renault',
    model: 'Kadjar',
    year: 2019,
    mileage: 30000,
    fuelType: 'PETROL',
    transmission: 'MANUAL',
    bodyType: 'SUV',
    location: 'Birmingham',
    owners: '1',
    numberOfKeys: 2,
    serviceHistory: 'Partial',
    mechanicalIssues: 'No known faults',
    electricalIssues: 'No known faults',
    description: 'Complete vehicle description',
    condition: 'GOOD',
    stolenRecovered: false,
    hasOutstandingFinance: false,
    isLegalRegisteredKeeper: true,
    auction: null,
};

function buildSubject(overrides: Record<string, any> = {}) {
    const listing = { ...completeDraft, ...overrides };
    const prisma: any = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        $transaction: jest.fn(async (fn: any) => fn(prisma)),
        listing: {
            findUnique: jest.fn().mockResolvedValue(listing),
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ id: 'listing-1' }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        auction: {
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({ id: 'auction-new' }),
            update: jest.fn().mockResolvedValue({ id: 'auction-previous' }),
        },
        sale: { findFirst: jest.fn().mockResolvedValue(null) },
        offer: { findFirst: jest.fn().mockResolvedValue(null) },
        bid: {
            count: jest.fn().mockResolvedValue(0),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        transaction: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'fee-1' }) },
        analyticsEvent: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'event-1' }),
        },
    };
    const notifications = {
        create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    };
    const gateway = { sendNotification: jest.fn() };
    const service = new AdminService(
        prisma,
        {} as any,
        {} as any,
        gateway as any,
        notifications as any,
        {} as any,
        {} as any,
        {} as any,
    );
    return { service, prisma, notifications, gateway };
}


describe('admin one-time free retail publication', () => {
    it('publishes BASIC without charging, preserves price, records the actor and waiver', async () => {
        const { service, prisma } = buildSubject({ type: 'AUCTION', price: 9500, slug: 'test-car' });
        prisma.auction.findMany.mockResolvedValue([{ id: 'auction-1', status: 'ENDED' }]);
        await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).resolves.toMatchObject({ status: 'ACTIVE', type: 'CLASSIFIED', price: 9500, feeCharged: 0 });
        expect(prisma.transaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'seller-1', listingId: 'listing-1', amount: 0, status: 'COMPLETED', type: 'LISTING_FEE' }), select: { id: true } });
        const update = prisma.listing.updateMany.mock.calls[0][0].data;
        expect(update).toMatchObject({ type: 'CLASSIFIED', status: 'ACTIVE', badgeTier: 'BASIC', isFeatured: false, linkedListingId: null });
        expect(update).not.toHaveProperty('price');
        expect(update).not.toHaveProperty('mechanicalIssues');
        expect(prisma.auction.update).not.toHaveBeenCalled();
        expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'admin-1', type: 'admin_draft_free_retail', payload: expect.objectContaining({ vrm: 'AB12CDE', sellerId: 'seller-1', price: 9500, feeCharged: 0, feeWaived: true }) }) });
        expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
    });
    it('reuses an existing completed fee rather than inventing another payment', async () => {
        const { service, prisma } = buildSubject({ badgeTier: 'PREMIUM' });
        prisma.transaction.findFirst.mockImplementation(async (args: any) => args.where.status === 'COMPLETED' ? { id: 'paid-fee' } : null);
        await service.publishDraftRetailFree('listing-1', 'admin-1');
        expect(prisma.transaction.create).not.toHaveBeenCalled();
        expect(prisma.listing.updateMany.mock.calls[0][0].data).toMatchObject({ badgeTier: 'PREMIUM', isFeatured: true });
        expect(prisma.analyticsEvent.create.mock.calls[0][0].data.payload).toMatchObject({ feeTransactionId: 'paid-fee', feeWaived: false });
    });
    it.each(['ACTIVE', 'SOLD', 'OFFER_ACCEPTED', 'PENDING_REVIEW', 'WITHDRAWN'])('rejects %s without any writes', async status => {
        const { service, prisma } = buildSubject({ status });
        await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).rejects.toThrow(/only a draft/i);
        expect(prisma.transaction.create).not.toHaveBeenCalled();
        expect(prisma.listing.updateMany).not.toHaveBeenCalled();
    });
    it.each([{ images: [] }, { numberOfKeys: null }, { serviceHistory: null }, { mechanicalIssues: null }, { electricalIssues: null }])('requires genuine seller declarations and photos (%j)', async missing => {
        const { service, prisma } = buildSubject(missing);
        await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).rejects.toThrow(/missing/i);
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
    it.each([0, -1, NaN])('requires a valid existing asking price (%s)', async price => {
        const { service } = buildSubject({ price });
        await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).rejects.toThrow(/price/i);
    });
    it.each([{ status: 'ACTIVE' }, { status: 'SCHEDULED' }, { status: 'ENDED', winnerId: 'buyer' }, { status: 'ENDED', provisionalOfferBidId: 'bid' }, { status: 'ENDED', buyerFeePaid: true }, { status: 'ENDED', handoverProofPath: 'proof' }])('does not overwrite auction commitments (%j)', async auction => {
        const { service, prisma } = buildSubject();
        prisma.auction.findMany.mockResolvedValue([auction]);
        await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).rejects.toThrow(/resolve/i);
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
    it.each(['sale', 'offer'])('blocks %s commitments', async entity => {
        const { service, prisma } = buildSubject();
        prisma[entity].findFirst.mockResolvedValue({ id: 'existing' });
        await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).rejects.toThrow(/resolve/i);
    });
    it('blocks unfinished checkouts to prevent a later charge after the waiver', async () => {
        const { service, prisma } = buildSubject();
        prisma.transaction.findFirst.mockResolvedValue({ id: 'checkout-1' });
        await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).rejects.toThrow(/unfinished retail checkout/i);
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
    it('enforces one use across this listing or another draft for the same seller and plate', async () => {
        const { service, prisma } = buildSubject();
        prisma.analyticsEvent.findFirst.mockResolvedValue({ id: 'grant-used' });
        await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).rejects.toThrow(/already been used/i);
        expect(prisma.analyticsEvent.findFirst.mock.calls[0][0].where.OR).toEqual(expect.arrayContaining([{ payload: { path: ['listingId'], equals: 'listing-1' } }, { AND: [{ payload: { path: ['sellerId'], equals: 'seller-1' } }, { payload: { path: ['vrm'], equals: 'AB12CDE' } }] }]));
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
    it('blocks another live retail registration even under a different seller', async () => {
        const { service, prisma } = buildSubject();
        prisma.$queryRaw.mockResolvedValue([{ id: 'other-retail' }]);
        await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).rejects.toThrow(/another live retail advert/i);
    });
    it('blocks conflicting live/pending/sold siblings with normalized registration', async () => {
        for (const status of ['ACTIVE', 'PENDING_REVIEW', 'SOLD', 'OFFER_ACCEPTED']) {
            const { service, prisma } = buildSubject();
            prisma.listing.findMany.mockResolvedValue([{ id: 'other', vrm: 'ab12-cde', status }]);
            await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).rejects.toThrow(/another live, pending or sold/i);
        }
    });
    it('detaches a reciprocal inactive sibling but preserves ended auction history', async () => {
        const { service, prisma } = buildSubject({ linkedListingId: 'old-auction' });
        prisma.listing.findMany.mockResolvedValue([{ id: 'old-auction', vrm: 'AB12CDE', status: 'DRAFT', type: 'AUCTION', linkedListingId: 'listing-1' }]);
        prisma.auction.findMany.mockResolvedValue([{ id: 'ended-auction', status: 'ENDED' }]);
        await service.publishDraftRetailFree('listing-1', 'admin-1');
        expect(prisma.listing.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'old-auction', sellerId: 'seller-1', linkedListingId: 'listing-1' }, data: { linkedListingId: null } });
        expect(prisma.auction.update).not.toHaveBeenCalled();
    });
    it('rejects a corrupt cross-channel link before creating any waiver', async () => {
        const { service, prisma } = buildSubject({ linkedListingId: 'wrong' });
        await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).rejects.toThrow(/linked advert needs review/i);
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
    it('rolls back if a competing writer changes the draft', async () => {
        const { service, prisma } = buildSubject();
        prisma.listing.updateMany.mockResolvedValue({ count: 0 });
        await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).rejects.toThrow(/draft changed/i);
        expect(prisma.analyticsEvent.create).not.toHaveBeenCalled();
    });
    it('blocks deleted sellers and listings', async () => {
        for (const data of [{ seller: { id: 'seller-1', deletedAt: new Date() } }, { deletedAt: new Date() }]) {
            const { service, prisma } = buildSubject(data);
            await expect(service.publishDraftRetailFree('listing-1', 'admin-1')).rejects.toThrow();
            expect(prisma.transaction.create).not.toHaveBeenCalled();
        }
    });
});
