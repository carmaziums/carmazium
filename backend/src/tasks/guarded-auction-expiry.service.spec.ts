import { GuardedAuctionExpiryService } from './guarded-auction-expiry.service';

const NOW = new Date('2026-10-06T00:00:00Z');
function harness(options: { linked?: boolean; fees?: any[]; patch?: Record<string, any>;
  saleCount?: number; beforeLock?: () => void } = {}) {
  const listing = {
    id: 'listing-1', title: 'Example vehicle', sellerId: 'seller-1',
    linkedListingId: options.linked ? 'retail-1' : null,
    status: 'SOLD', deletedAt: null,
  };
  const current: any = {
    id: 'auction-1', listingId: listing.id, listing,
    startTime: new Date('2026-10-01T00:00:00Z'),
    wonAt: new Date('2026-10-01T01:00:00Z'),
    status: 'ENDED', winnerId: 'buyer-1', buyerFeePaid: false,
    buyerFeeTransactionId: null, sellerBonusReleased: false,
    sellerBonusReleasedAt: null, sellerFundsConfirmedAt: null,
    handoverSubmittedAt: null, handoverProofPath: null,
    handoverProofUrl: null, stripePayoutTransferId: null,
    manualPayoutConfirmedAt: null, buyerRefusedAt: null,
    winningBidAmount: 4200, reservePrice: 4000, startingBid: 3000,
    deletedAt: null, ...options.patch,
  };
  const tx: any = {
    $queryRaw: jest.fn().mockImplementation(async () => {
      options.beforeLock?.();
      return [{ id: current.id }];
    }),
    auction: {
      findUnique: jest.fn().mockImplementation(async () => current),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        if (current.status !== where.status ||
            current.winnerId !== where.winnerId ||
            current.buyerFeePaid !== where.buyerFeePaid ||
            current.buyerFeeTransactionId !== where.buyerFeeTransactionId ||
            current.wonAt?.getTime() !== where.wonAt?.getTime()) {
          return { count: 0 };
        }
        Object.assign(current, data);
        return { count: 1 };
      }),
    },
    // Model Prisma's createdAt >= wonAt query to keep test fixtures faithful
    // when a listing and even its winning dealer are reused in a later run.
    transaction: { findMany: jest.fn(async ({ where }: any) =>
      (options.fees || []).filter((fee: any) =>
        fee.createdAt instanceof Date &&
        fee.createdAt >= where.createdAt.gte
      )) },
    listing: { update: jest.fn().mockResolvedValue({}) },
    sale: { deleteMany: jest.fn().mockResolvedValue({ count: options.saleCount ?? 1 }) },
    sellerProfile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  // Simulates the PostgreSQL row lock by serialising transactions from
  // concurrent cron workers. Each callback re-reads current mutable state.
  let previous = Promise.resolve();
  const prisma: any = {
    auction: { findMany: jest.fn().mockResolvedValue([{ id: current.id }]) },
    analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((callback: (tx: any) => Promise<any>) => {
      const done = previous.then(() => callback(tx));
      previous = done.then(() => undefined, () => undefined);
      return done;
    }),
  };
  const notifications: any = { create: jest.fn().mockResolvedValue({}) };
  const gateway: any = { broadcastAuctionEnd: jest.fn() };
  const service = new GuardedAuctionExpiryService(prisma, notifications, gateway);
  return { service, prisma, tx, notifications, gateway, current };
}

describe('Guarded 72-hour auction expiry integration', () => {
  it('cancels a genuinely unpaid expired win, removes exactly its Sale and notifies once', async () => {
    const h = harness();
    expect(await h.service.revertUnpaidWins(NOW)).toEqual({ reverted: 1 });
    expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(h.tx.auction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'auction-1', status: 'ENDED', winnerId: 'buyer-1',
        buyerFeePaid: false, buyerFeeTransactionId: null,
      }),
    }));
    expect(h.current.status).toBe('CANCELLED');
    expect(h.tx.sale.deleteMany).toHaveBeenCalledWith({
      where: { listingId: 'listing-1', buyerId: 'buyer-1' },
    });
    expect(h.tx.sellerProfile.updateMany).toHaveBeenCalledTimes(1);
    expect(h.notifications.create).toHaveBeenCalledTimes(2);
    expect(h.gateway.broadcastAuctionEnd).toHaveBeenCalledTimes(1);
  });

  it('restores linked retail rather than leaving it sold when an unpaid auction expires', async () => {
    const h = harness({ linked: true });
    expect(await h.service.revertUnpaidWins(NOW)).toEqual({ reverted: 1 });
    expect(h.tx.listing.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'retail-1' },
      data: { status: 'ACTIVE', linkedListingId: null },
    }));
    expect(h.tx.listing.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'listing-1' },
      data: expect.objectContaining({ status: 'DRAFT', linkedListingId: null }),
    }));
  });

  it('allows only one expiry worker to claim, delete the Sale and notify', async () => {
    const h = harness();
    const [first, second] = await Promise.all([
      h.service.revertUnpaidWins(NOW), h.service.revertUnpaidWins(NOW),
    ]);
    expect(first.reverted + second.reverted).toBe(1);
    expect(h.tx.sale.deleteMany).toHaveBeenCalledTimes(1);
    expect(h.tx.sellerProfile.updateMany).toHaveBeenCalledTimes(1);
    expect(h.notifications.create).toHaveBeenCalledTimes(2);
  });

  it('preserves a fee paid between candidate scan and the locked re-read', async () => {
    let h: ReturnType<typeof harness>;
    h = harness({ beforeLock: () => { h.current.buyerFeePaid = true; } });
    expect(await h.service.revertUnpaidWins(NOW)).toEqual({ reverted: 0 });
    expect(h.tx.auction.updateMany).not.toHaveBeenCalled();
    expect(h.tx.sale.deleteMany).not.toHaveBeenCalled();
    expect(h.notifications.create).not.toHaveBeenCalled();
  });

  it('defers expiration while an eligible completed £125 fee is waiting for webhook reconciliation', async () => {
    const h = harness({ fees: [{ id:'txn-1', status:'COMPLETED', amount:125, createdAt:new Date('2026-10-01T02:00:00Z') }] });
    expect(await h.service.revertUnpaidWins(NOW)).toEqual({ reverted: 0 });
    expect(h.tx.auction.updateMany).not.toHaveBeenCalled();
    expect(h.tx.sale.deleteMany).not.toHaveBeenCalled();
  });

  it('defers an unresolved pending checkout instead of risking cancellation during capture', async () => {
    const h = harness({ fees: [{ id:'txn-1', status:'PENDING', amount:125, createdAt:new Date('2026-10-01T02:00:00Z') }] });
    expect(await h.service.revertUnpaidWins(NOW)).toEqual({ reverted: 0 });
    expect(h.tx.sale.deleteMany).not.toHaveBeenCalled();
  });

  it('expires a later win despite an older £125 fee or abandoned pending checkout for the same dealer', async () => {
    const h = harness({ fees: [
      { id:'prior-paid', status:'COMPLETED', amount:125, createdAt:new Date('2026-09-30T05:00:00Z') },
      { id:'prior-checkout', status:'PENDING', amount:125, createdAt:new Date('2026-09-30T06:00:00Z') },
    ] });
    expect(await h.service.revertUnpaidWins(NOW)).toEqual({ reverted: 1 });
    expect(h.tx.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        listingId:'listing-1', userId:'buyer-1', type:'COMMISSION',
        deletedAt:null, createdAt:{ gte:new Date('2026-10-01T01:00:00Z') },
      }),
    }));
    expect(h.tx.sale.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('holds a new win when its own pending checkout exists even alongside an old checkout', async () => {
    const h = harness({ fees: [
      { id:'prior-checkout', status:'PENDING', amount:125, createdAt:new Date('2026-09-30T06:00:00Z') },
      { id:'current-checkout', status:'PENDING', amount:125, createdAt:new Date('2026-10-01T03:00:00Z') },
    ] });
    expect(await h.service.revertUnpaidWins(NOW)).toEqual({ reverted: 0 });
    expect(h.tx.sale.deleteMany).not.toHaveBeenCalled();
  });

  it('does not cancel another assigned winner after a stale candidate read', async () => {
    let h: ReturnType<typeof harness>;
    h = harness({ beforeLock: () => { h.current.status = 'ACTIVE'; } });
    expect(await h.service.revertUnpaidWins(NOW)).toEqual({ reverted: 0 });
    expect(h.tx.sale.deleteMany).not.toHaveBeenCalled();
  });

  it('preserves every legitimate legacy winner with null wonAt', async () => {
    const h = harness({ patch: { wonAt: null } });
    expect(await h.service.revertUnpaidWins(NOW)).toEqual({ reverted: 0 });
    expect(h.tx.sale.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    { sellerFundsConfirmedAt: new Date() },
    { handoverSubmittedAt: new Date() },
    { sellerBonusReleased: true },
    { buyerRefusedAt: new Date() },
  ])('never unwinds an auction with seller or inspection progress (%j)', async patch => {
    const h = harness({ patch });
    expect(await h.service.revertUnpaidWins(NOW)).toEqual({ reverted: 0 });
    expect(h.tx.sale.deleteMany).not.toHaveBeenCalled();
  });

  it('never decrements a seller counter when no matching Sale is actually removed', async () => {
    const h = harness({ saleCount: 0 });
    expect(await h.service.revertUnpaidWins(NOW)).toEqual({ reverted: 1 });
    expect(h.tx.sellerProfile.updateMany).not.toHaveBeenCalled();
  });
});
