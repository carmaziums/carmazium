import { PaymentsService } from './payments.service';

// Deterministic transaction runner: model the PostgreSQL auction-row lock by
// serialising transactions, and re-read mutable auction/fee state after lock.
function makeHarness() {
    const auction: any = {
        id: 'auction-1', listingId: 'listing-1',
        winnerId: 'dealer-1', status: 'ENDED', deletedAt: null,
        buyerFeePaid: false, buyerFeeTransactionId: null,
        wonAt: new Date(Date.now() - 30 * 60 * 1000),
    };
    const fees: any[] = [];
    const stripe = {
        checkout: { sessions: { create: jest.fn().mockResolvedValue({
            id: 'cs-1', url: 'https://checkout.stripe.test/fee',
        }) } },
        ephemeralKeys: { create: jest.fn().mockResolvedValue({ secret: 'ek-1' }) },
        paymentIntents: { create: jest.fn().mockResolvedValue({
            id: 'pi-1', client_secret: 'pi-secret',
        }) },
    };
    const tx: any = {
        $queryRaw: jest.fn(async () => [{ id: auction.id }]),
        auction: { findUnique: jest.fn(async () => ({ ...auction })) },
        transaction: {
            findFirst: jest.fn(async ({ where }: any) =>
                fees.find(row =>
                    row.listingId === where.listingId &&
                    row.userId === where.userId &&
                    row.type === where.type &&
                    row.deletedAt === null &&
                    where.status.in.includes(row.status) &&
                    (!where.createdAt || row.createdAt >= where.createdAt.gte)
                ) ?? null),
            create: jest.fn(async ({ data }: any) => {
                const row = {
                    id: 'fee-' + (fees.length + 1),
                    createdAt: new Date(), deletedAt: null, ...data,
                };
                fees.push(row);
                return row;
            }),
        },
    };
    let previous = Promise.resolve();
    const prisma: any = {
        listing: { findUnique: jest.fn().mockResolvedValue({
            id: 'listing-1', title: 'Example auction vehicle',
            deletedAt: null, images: [],
        }) },
        user: { findUnique: jest.fn().mockResolvedValue({
            id: 'dealer-1', email: 'dealer@example.test',
            stripeCustomerId: 'cus-1',
        }) },
        transaction: { update: jest.fn().mockResolvedValue({}) },
        $transaction: jest.fn((callback: (transaction: any) => Promise<any>) => {
            const work = previous.then(() => callback(tx));
            previous = work.then(() => undefined, () => undefined);
            return work;
        }),
    };
    const service: any = Object.create(PaymentsService.prototype);
    service.prisma = prisma;
    service.config = {
        get: jest.fn((key: string) =>
            key === 'STRIPE_PUBLISHABLE_KEY' ? 'pk_test_mock' : 'https://carmazium.com'),
    };
    service.AUCTION_BUYER_FEE = 125;
    service.AUCTION_SELLER_BONUS = 100;
    service.AUCTION_PLATFORM_FEE = 25;
    service.getStripe = jest.fn().mockResolvedValue(stripe);
    // Simulate the already-authorised actor pre-check returning its earlier
    // snapshot; the reservation must independently verify the current row.
    service.getPayableAuctionForWinner = jest.fn().mockImplementation(async () => ({
        auction: { id: 'auction-1' }, buyerId: 'dealer-1',
    }));
    return { auction, fees, tx, prisma, service, stripe };
}

describe('Block 10: fee reservation versus admin grant and expiry', () => {
    it('allows only one of two concurrent web checkout attempts', async () => {
        const h = makeHarness();
        const results = await Promise.allSettled([
            h.service.createCheckoutSession('listing-1', 'dealer-1', 125, 'COMMISSION'),
            h.service.createCheckoutSession('listing-1', 'dealer-1', 125, 'COMMISSION'),
        ]);
        expect(results.map(x => x.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect(h.tx.$queryRaw).toHaveBeenCalledTimes(2);
        expect(h.tx.transaction.create).toHaveBeenCalledTimes(1);
        expect(h.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
        expect(h.fees).toHaveLength(1);
    });

    it('shares one reservation across competing hosted and mobile payment attempts', async () => {
        const h = makeHarness();
        const results = await Promise.allSettled([
            h.service.createCheckoutSession('listing-1', 'dealer-1', 125, 'COMMISSION'),
            h.service.createPaymentSheet('listing-1', 'dealer-1', 125, 'COMMISSION'),
        ]);
        expect(results.map(x => x.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect(h.tx.transaction.create).toHaveBeenCalledTimes(1);
        expect(
            h.stripe.checkout.sessions.create.mock.calls.length +
            h.stripe.paymentIntents.create.mock.calls.length,
        ).toBe(1);
    });

    it('refuses a new hosted checkout if a grant wins after the initial eligibility read', async () => {
        const h = makeHarness();
        h.auction.buyerFeePaid = true;
        h.auction.buyerFeeTransactionId = 'grant-current';
        await expect(
            h.service.createCheckoutSession('listing-1', 'dealer-1', 125, 'COMMISSION'),
        ).rejects.toThrow(/already been paid or waived/i);
        expect(h.tx.transaction.create).not.toHaveBeenCalled();
        expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('refuses a new mobile PaymentIntent if the grant wins the same race', async () => {
        const h = makeHarness();
        h.auction.buyerFeePaid = true;
        h.auction.buyerFeeTransactionId = 'grant-current';
        await expect(
            h.service.createPaymentSheet('listing-1', 'dealer-1', 125, 'COMMISSION'),
        ).rejects.toThrow(/already been paid or waived/i);
        expect(h.tx.transaction.create).not.toHaveBeenCalled();
        expect(h.stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('rejects a reassigned winner or cancelled auction without creating a fee', async () => {
        const h = makeHarness();
        h.auction.winnerId = 'another-dealer';
        await expect(
            h.service.createCheckoutSession('listing-1', 'dealer-1', 125, 'COMMISSION'),
        ).rejects.toThrow(/winner changed/i);
        h.auction.winnerId = 'dealer-1';
        h.auction.status = 'CANCELLED';
        await expect(
            h.service.createPaymentSheet('listing-1', 'dealer-1', 125, 'COMMISSION'),
        ).rejects.toThrow(/no longer payable/i);
        expect(h.tx.transaction.create).not.toHaveBeenCalled();
    });

    it('enforces the 72-hour deadline again under the lock', async () => {
        const h = makeHarness();
        h.auction.wonAt = new Date(Date.now() - 74 * 60 * 60 * 1000);
        await expect(
            h.service.createCheckoutSession('listing-1', 'dealer-1', 125, 'COMMISSION'),
        ).rejects.toThrow(/72-hour buyer fee deadline/i);
        expect(h.tx.transaction.create).not.toHaveBeenCalled();
        expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('does not let an earlier auction run block the current winner checkout', async () => {
        const h = makeHarness();
        h.fees.push({
            id: 'old-fee', listingId: 'listing-1', userId: 'dealer-1',
            type: 'COMMISSION', deletedAt: null,
            status: 'COMPLETED', amount: 125,
            createdAt: new Date(h.auction.wonAt.getTime() - 86400000),
        });
        await expect(
            h.service.createCheckoutSession('listing-1', 'dealer-1', 125, 'COMMISSION'),
        ).resolves.toEqual(expect.objectContaining({ transactionId: 'fee-2' }));
        expect(h.tx.transaction.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                createdAt: { gte: h.auction.wonAt },
                status: { in: ['PENDING', 'COMPLETED'] },
            }),
        }));
    });

    it('keeps legacy wins with no wonAt payable but prevents a duplicate fee', async () => {
        const h = makeHarness();
        h.auction.wonAt = null;
        h.fees.push({
            id: 'legacy-fee', listingId: 'listing-1', userId: 'dealer-1',
            type: 'COMMISSION', deletedAt: null,
            status: 'PENDING', amount: 125, createdAt: new Date(),
        });
        await expect(
            h.service.createCheckoutSession('listing-1', 'dealer-1', 125, 'COMMISSION'),
        ).rejects.toThrow(/already started or completed/i);
        expect(h.tx.transaction.create).not.toHaveBeenCalled();
    });
});
