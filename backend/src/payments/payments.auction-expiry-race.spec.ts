import { PaymentsService } from './payments.service';

function harness(patch: Record<string, any> = {}) {
  const fee = {
    id: 'fee-1', listingId: 'listing-1', userId: 'winner-1',
    type: 'COMMISSION', status: 'COMPLETED', amount: 125, deletedAt: null,
    ...patch,
  };
  const prisma: any = {
    transaction: { findUnique: jest.fn().mockResolvedValue(fee) },
    auction: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  const svc: any = Object.create(PaymentsService.prototype);
  svc.prisma = prisma;
  svc.AUCTION_BUYER_FEE = 125;
  svc.logger = { warn: jest.fn(), error: jest.fn() };
  return { svc, prisma, fee };
}

describe('Auction buyer-fee reconciliation versus expiry races', () => {
  it('claims the current winning auction atomically with the exact completed £125 fee', async () => {
    const h = harness();
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(true);
    expect(h.prisma.auction.updateMany).toHaveBeenCalledWith({
      where: {
        listingId: 'listing-1', deletedAt: null, status: 'ENDED',
        winnerId: 'winner-1', buyerFeePaid: false, buyerFeeTransactionId: null,
      },
      data: { buyerFeePaid: true, buyerFeeTransactionId: 'fee-1' },
    });
  });

  it.each([
    { status: 'PENDING' },
    { status: 'FAILED' },
    { type: 'LISTING_FEE' },
    { amount: 100 },
    { amount: 0 },
    { userId: 'other-winner' },
    { listingId: 'other-listing' },
    { deletedAt: new Date() },
  ])('rejects an incorrect fee record before modifying auction (%j)', async patch => {
    const h = harness(patch);
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(false);
    expect(h.prisma.auction.updateMany).not.toHaveBeenCalled();
  });

  it('never applies a captured fee to an auction already cancelled by expiry', async () => {
    const h = harness();
    h.prisma.auction.updateMany.mockResolvedValue({ count: 0 });
    h.prisma.auction.findFirst.mockResolvedValue({
      status: 'CANCELLED', winnerId: null, buyerFeePaid: false,
      buyerFeeTransactionId: null,
    });
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(false);
    expect(h.svc.logger.error).toHaveBeenCalledWith(expect.stringMatching(/Finance review/));
  });

  it('does not move payment across a reassigned winning dealership', async () => {
    const h = harness();
    h.prisma.auction.updateMany.mockResolvedValue({ count: 0 });
    h.prisma.auction.findFirst.mockResolvedValue({
      status: 'ENDED', winnerId: 'another-winner',
      buyerFeePaid: false, buyerFeeTransactionId: null,
    });
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(false);
  });

  it('accepts a duplicate webhook only for the exact fee already recorded on the same active win', async () => {
    const h = harness();
    h.prisma.auction.updateMany.mockResolvedValue({ count: 0 });
    h.prisma.auction.findFirst.mockResolvedValue({
      status: 'ENDED', winnerId: 'winner-1',
      buyerFeePaid: true, buyerFeeTransactionId: 'fee-1',
    });
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(true);
  });

  it('never overwrites another fee transaction on an already-paid auction', async () => {
    const h = harness();
    h.prisma.auction.updateMany.mockResolvedValue({ count: 0 });
    h.prisma.auction.findFirst.mockResolvedValue({
      status: 'ENDED', winnerId: 'winner-1',
      buyerFeePaid: true, buyerFeeTransactionId: 'different-fee',
    });
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(false);
  });

  it('handles an absent historical fee without changing any auction state', async () => {
    const h = harness();
    h.prisma.transaction.findUnique.mockResolvedValue(null);
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(false);
    expect(h.prisma.auction.updateMany).not.toHaveBeenCalled();
  });
});
