import {
  classifyHistoricalAuction, LEGACY_WON_AT_CUTOFF,
  AuctionHistoryRecord,
} from './auction-history-reconciliation';
import { AdminService } from './admin.service';

const date = '2026-06-17T12:00:00.000Z';
const sale = { buyerId: 'buyer-1', soldPrice: '5500.00' };
function row(patch: Partial<AuctionHistoryRecord> = {}): AuctionHistoryRecord {
  return {
    id: 'auction-1', listingId: 'listing-1',
    createdAt: new Date(date), status: 'ENDED',
    winnerId: 'buyer-1', wonAt: null, winningBidAmount: '5500.00',
    buyerFeePaid: false, buyerFeeTransactionId: null,
    handoverSubmittedAt: null, sellerBonusReleased: false,
    manualPayoutConfirmedAt: null, stripePayoutTransferId: null,
    listing: { title: 'Test vehicle', sale, transactions: [] },
    ...patch,
  };
}
const commission = (patch: Record<string, any> = {}) => ({
    id: 'fee-1', userId: 'buyer-1', type: 'COMMISSION',
    status: 'PENDING', amount: '125.00', stripePaymentId: 'pi_test_only',
    description: 'Historic fee', ...patch,
});

describe('Block 7 historical auction classification: financial records are read-only', () => {
  it('retains a matched pre-feature sale without inventing wonAt or activating the 72h expiry', () => {
    expect(LEGACY_WON_AT_CUTOFF.toISOString()).toBe('2026-08-06T00:00:00.000Z');
    const a = row();
    const before = JSON.stringify(a);
    const result = classifyHistoricalAuction(a);
    expect(result.legacyWinProtected).toBe(true);
    expect(result.requiresManualReview).toBe(false);
    expect(JSON.stringify(a)).toBe(before);
    expect(a.wonAt).toBeNull();
  });

  it('reviews a newer winner missing wonAt instead of backfilling with a guessed date', () => {
    const a = row({ createdAt: new Date('2026-09-20T12:00:00Z') });
    const result = classifyHistoricalAuction(a);
    expect(result.legacyWinProtected).toBe(false);
    expect(result.reviewReasons).toContain('UNSAFE_MISSING_WIN_TIMESTAMP');
    expect(a.wonAt).toBeNull();
  });

  it('does not treat a mismatched legacy sale as a safe grandfathered win', () => {
    const a = row({ listing: { title: 'Car', sale: { buyerId: 'other-buyer', soldPrice: '5500' } } });
    const result = classifyHistoricalAuction(a);
    expect(result.legacyWinNoTimestamp).toBe(true);
    expect(result.legacyWinProtected).toBe(false);
    expect(result.reviewReasons).toContain('UNSAFE_MISSING_WIN_TIMESTAMP');
  });

  it('keeps legacy timestamp protection AND reviews an approved bonus with only a pending Stripe reference', () => {
    const a = row({ handoverSubmittedAt: new Date(date), sellerBonusReleased: true,
      manualPayoutConfirmedAt: new Date(date),
      listing: { title: 'Car', sale, transactions: [commission()] } });
    const r = classifyHistoricalAuction(a);
    expect(r.legacyWinProtected).toBe(true);
    expect(r.reviewReasons).toEqual(['BUYER_FEE_NOT_VERIFIED']);
    expect(r.transactionEvidence.pendingCommission).toBe(1);
    expect(r.transactionEvidence.completedValidBuyerFee).toBe(0);
    expect(r.transactionEvidence.stripeReferencePresent).toBe(true);
  });

  it('does not reinstate failed payments or assume manual seller payout proves buyer fee', () => {
    const a = row({ sellerBonusReleased: true, manualPayoutConfirmedAt: new Date(),
      listing: { title: 'Car', sale, transactions: [
        commission({ status: 'FAILED' }), commission({ id: 'fee-2', stripePaymentId: null }),
      ] } });
    const r = classifyHistoricalAuction(a);
    expect(r.transactionEvidence.failedCommission).toBe(1);
    expect(r.reviewReasons).toContain('BUYER_FEE_NOT_VERIFIED');
  });

  it('flags cancelled handover approvals without a current winner or sale for human investigation', () => {
    const a = row({ status: 'CANCELLED', winnerId: null, winningBidAmount: null,
      sellerBonusReleased: true, handoverSubmittedAt: new Date(),
      listing: { title: 'Car', sale: null, transactions: [] } });
    const r = classifyHistoricalAuction(a);
    expect(r.reviewReasons).toContain('CANCELLED_OR_UNWON_APPROVAL');
    expect(r.transactionEvidence.completedValidBuyerFee).toBe(0);
  });

  it('separates corroborated completed £125 payments from a missing auction flag without changing either', () => {
    const a = row({ sellerBonusReleased: true,
      listing: { title: 'Car', sale,
        transactions: [commission({ status: 'COMPLETED', stripePaymentId: null })] } });
    const r = classifyHistoricalAuction(a);
    expect(r.transactionEvidence.completedValidBuyerFee).toBe(1);
    expect(r.reviewReasons).toContain('BUYER_FEE_FLAG_MISMATCH');
    expect(a.buyerFeePaid).toBe(false);
  });

  it('accepts the recognised completed £0 admin grant record as fee evidence but still requires flag review', () => {
    const a = row({ handoverSubmittedAt: new Date(),
      listing: { title: 'Car', sale,
        transactions: [commission({ status: 'COMPLETED', amount: '0',
          description: 'Admin-granted free auction purchase (approved)' })] } });
    const r = classifyHistoricalAuction(a);
    expect(r.transactionEvidence.completedValidBuyerFee).toBe(1);
    expect(r.reviewReasons).toContain('BUYER_FEE_FLAG_MISMATCH');
  });

  it('does not count another buyer or an unrelated completed commission as a paid winner fee', () => {
    const a = row({ sellerBonusReleased: true,
      listing: { title: 'Car', sale,
        transactions: [commission({ status: 'COMPLETED', userId: 'someone-else' }),
          commission({ id: 'other', status: 'COMPLETED', amount: '99.00' })] } });
    const r = classifyHistoricalAuction(a);
    expect(r.transactionEvidence.completedValidBuyerFee).toBe(0);
    expect(r.transactionEvidence.completedOtherCommission).toBe(2);
    expect(r.reviewReasons).toContain('BUYER_FEE_NOT_VERIFIED');
  });

  it('marks legitimate finished modern auction without missing fee/timestamp as not requiring review', () => {
    const a = row({ createdAt: new Date('2026-09-22T12:00:00Z'),
      wonAt: new Date('2026-09-23T12:00:00Z'),
      buyerFeePaid: true, handoverSubmittedAt: new Date(), sellerBonusReleased: true });
    expect(classifyHistoricalAuction(a).requiresManualReview).toBe(false);
  });
});

describe('admin read-only historical reconciliation inventory', () => {
  it('returns overlapping historic wins and payment anomalies exactly once per auction without any writes', async () => {
    const legacy = row();
    const flagged = row({
      id: 'auction-2', sellerBonusReleased: true,
      handoverSubmittedAt: new Date(),
      listing: { title: 'Flagged car', sale, transactions: [commission()] },
    });
    const cancelled = row({
      id: 'auction-3', status: 'CANCELLED', winnerId: null,
      winningBidAmount: null, sellerBonusReleased: true, handoverSubmittedAt: new Date(),
      listing: { title: 'Cancelled car', sale: null, transactions: [] },
    });
    const prisma: any = {
      auction: {
        findMany: jest.fn().mockResolvedValue([legacy, flagged, cancelled]),
        update: jest.fn(), updateMany: jest.fn(), delete: jest.fn(),
      },
      transaction: { update: jest.fn(), create: jest.fn() },
      sale: { create: jest.fn(), delete: jest.fn() },
    };
    const admin: any = Object.create(AdminService.prototype);
    admin.prisma = prisma;
    const result = await admin.getHistoricalAuctionReconciliation();
    expect(result.readOnly).toBe(true);
    expect(result.protectedLegacyWinCount).toBe(2);
    expect(result.manualReviewCount).toBe(2);
    expect(result.cases).toHaveLength(2);
    expect(result.cases[0].legacyWinProtected).toBe(true);
    expect(result.cases[0].transactions.pendingCommission).toBe(1);
    expect(result.cases[1].reasons).toContain('CANCELLED_OR_UNWON_APPROVAL');
    expect(prisma.auction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deletedAt: null }),
      select: expect.objectContaining({ listing: expect.any(Object) }),
    }));
    expect(prisma.auction.update).not.toHaveBeenCalled();
    expect(prisma.auction.updateMany).not.toHaveBeenCalled();
    expect(prisma.transaction.update).not.toHaveBeenCalled();
    expect(prisma.sale.create).not.toHaveBeenCalled();
  });
});
