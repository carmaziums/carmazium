import { PaymentsService } from './payments.service';

const WON_AT = new Date('2026-10-01T12:00:00Z');
const FEE_AT = new Date('2026-10-01T13:00:00Z');
const currentWin = {
  id: 'auction-1', status: 'ENDED', winnerId: 'winner-1',
  wonAt: WON_AT, buyerFeePaid: false, buyerFeeTransactionId: null,
};
function harness(patch: Record<string, any> = {}) {
  const fee = {
    id: 'fee-1', listingId: 'listing-1', userId: 'winner-1',
    type: 'COMMISSION', status: 'COMPLETED', amount: 125,
    createdAt: FEE_AT, deletedAt: null, ...patch,
  };
  const prisma: any = {
    transaction: { findUnique: jest.fn().mockResolvedValue(fee) },
    auction: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({ ...currentWin }),
    },
  };
  const svc: any = Object.create(PaymentsService.prototype);
  svc.prisma = prisma;
  svc.AUCTION_BUYER_FEE = 125;
  svc.logger = { warn: jest.fn(), error: jest.fn() };
  return { svc, prisma };
}

describe('Buyer-fee callbacks versus expiry and reauction races', () => {
  it('claims only the matching current win and its recorded start timestamp', async () => {
    const h = harness();
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(true);
    expect(h.prisma.auction.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'auction-1', listingId: 'listing-1', deletedAt: null,
        status: 'ENDED', winnerId: 'winner-1', wonAt: WON_AT,
        buyerFeePaid: false, buyerFeeTransactionId: null,
      },
      data: { buyerFeePaid: true, buyerFeeTransactionId: 'fee-1' },
    });
  });

  it.each([
    { status: 'PENDING' }, { status: 'FAILED' },
    { type: 'LISTING_FEE' }, { amount: 100 }, { amount: 0 },
    { userId: 'other-winner' }, { listingId: 'other-listing' },
    { deletedAt: new Date() },
  ])('rejects incorrect payment evidence before modifying auction (%j)', async patch => {
    const h = harness(patch);
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(false);
    expect(h.prisma.auction.updateMany).not.toHaveBeenCalled();
  });

  it('does not apply a captured fee once expiry cancelled the auction', async () => {
    const h = harness();
    h.prisma.auction.findFirst.mockResolvedValue({
      ...currentWin, status: 'CANCELLED', winnerId: null,
    });
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(false);
    expect(h.prisma.auction.updateMany).not.toHaveBeenCalled();
    expect(h.svc.logger.error).toHaveBeenCalledWith(expect.stringMatching(/finance review/i));
  });

  it('does not pay a reassigned winner after the original winner paid', async () => {
    const h = harness();
    h.prisma.auction.findFirst.mockResolvedValue({
      ...currentWin, winnerId: 'different-dealer',
    });
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(false);
    expect(h.prisma.auction.updateMany).not.toHaveBeenCalled();
  });

  it('never treats an old checkout as payment for a later reauction won by the same person', async () => {
    const h = harness();
    h.prisma.auction.findFirst.mockResolvedValue({
      ...currentWin, wonAt: new Date('2026-10-03T12:00:00Z'),
    });
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(false);
    expect(h.prisma.auction.updateMany).not.toHaveBeenCalled();
  });

  it('does not apply after losing a race between observation and guarded update', async () => {
    const h = harness();
    h.prisma.auction.updateMany.mockResolvedValue({ count: 0 });
    h.prisma.auction.findFirst
      .mockResolvedValueOnce({ ...currentWin })
      .mockResolvedValueOnce({ ...currentWin, status: 'CANCELLED', winnerId: null });
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(false);
    expect(h.svc.logger.error).toHaveBeenCalledWith(expect.stringMatching(/Finance review/));
  });

  it('accepts an exact duplicate webhook on the same completed fee', async () => {
    const h = harness();
    h.prisma.auction.findFirst.mockResolvedValue({
      ...currentWin, buyerFeePaid: true, buyerFeeTransactionId: 'fee-1',
    });
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(true);
    expect(h.prisma.auction.updateMany).not.toHaveBeenCalled();
  });

  it('never overwrites another completed fee record or admin waiver', async () => {
    const h = harness();
    h.prisma.auction.findFirst.mockResolvedValue({
      ...currentWin, buyerFeePaid: true, buyerFeeTransactionId: 'grant-1',
    });
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(false);
    expect(h.prisma.auction.updateMany).not.toHaveBeenCalled();
  });

  it('rejects missing transaction records', async () => {
    const h = harness();
    h.prisma.transaction.findUnique.mockResolvedValue(null);
    expect(await h.svc.markAuctionBuyerFeePaid('fee-1', 'listing-1', 'winner-1')).toBe(false);
    expect(h.prisma.auction.updateMany).not.toHaveBeenCalled();
  });
});
