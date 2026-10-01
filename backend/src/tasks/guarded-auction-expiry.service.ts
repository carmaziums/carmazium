import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuctionGateway } from '../auctions/auction.gateway';
import { BUYER_FEE_GRACE_MS } from '../auctions/buyer-fee-deadline';
import {
  hasCompletedBuyerFee, hasUnresolvedCheckout, isUnpaidExpiryEligible,
} from '../auctions/unpaid-expiry-guards';

/**
 * Safe replacement for the historical unconditional unpaid-win unwind.
 * Both the hourly job and any parallel worker must lock, re-read and claim
 * each auction within one transaction before altering any associated Sale.
 */
@Injectable()
export class GuardedAuctionExpiryService {
  private readonly logger = new Logger(GuardedAuctionExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gateway: AuctionGateway,
  ) {}

  async revertUnpaidWins(now = new Date()): Promise<{ reverted: number }> {
    const cutoff = new Date(now.getTime() - BUYER_FEE_GRACE_MS);
    if (!Number.isFinite(cutoff.getTime())) return { reverted: 0 };

    const candidates = await this.prisma.auction.findMany({
      where: {
        status: 'ENDED', deletedAt: null, buyerFeePaid: false,
        buyerFeeTransactionId: null, winnerId: { not: null },
        wonAt: { not: null, lt: cutoff },
      },
      // Scan IDs only, without a fixed oldest-N cap: a long-standing
      // unresolved PENDING checkout must not starve newer eligible wins.
      select: { id: true },
      orderBy: { wonAt: 'asc' },
    });

    let reverted = 0;
    for (const { id } of candidates) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          // Force every expiry worker to serialize on the *same auction row*.
          // A competing payment CAS update also needs this row lock.
          await tx.$queryRaw`SELECT id FROM public.auctions WHERE id = ${id} FOR UPDATE`;
          const current = await tx.auction.findUnique({
            where: { id },
            include: {
              listing: {
                select: {
                  id: true, title: true, status: true, deletedAt: true,
                  sellerId: true, linkedListingId: true,
                },
              },
            },
          });
          if (!current || !isUnpaidExpiryEligible(current, cutoff) ||
              !current.listing || current.listing.deletedAt ||
              current.listing.status !== 'SOLD') return null;

          // Never infer non-payment from the auction flag alone. A completed
          // charge may have been recorded just before its webhook applies
          // buyerFeePaid, and an unresolved checkout may still capture.
          const fees = await tx.transaction.findMany({
            where: {
              listingId: current.listingId,
              userId: current.winnerId!,
              type: 'COMMISSION', deletedAt: null,
              // Prior wins can share both this listing ID and winner ID.
              // An old payment or abandoned Checkout cannot hold a new win.
              createdAt: { gte: current.wonAt! },
            },
            select: {
              id: true, status: true, amount: true, description: true,
              createdAt: true,
            },
          });
          if (hasCompletedBuyerFee(fees, current.wonAt!) ||
              hasUnresolvedCheckout(fees, current.wonAt!)) {
            this.logger.warn(
              'Deferred expiry for auction ' + id +
              ': a completed fee/grant or unresolved checkout needs reconciliation.',
            );
            return null;
          }

          // This conditional claim covers changes from other request paths,
          // in addition to the pessimistic lock preventing duplicate workers.
          const winnerId = current.winnerId!;
          const claimed = await tx.auction.updateMany({
            where: {
              id, status: 'ENDED', deletedAt: null,
              winnerId: current.winnerId, wonAt: current.wonAt,
              buyerFeePaid: false, buyerFeeTransactionId: null,
              sellerFundsConfirmedAt: null, handoverSubmittedAt: null,
              handoverProofPath: null, handoverProofUrl: null,
              sellerBonusReleased: false, sellerBonusReleasedAt: null,
              stripePayoutTransferId: null, manualPayoutConfirmedAt: null,
              buyerRefusedAt: null,
            },
            data: {
              status: 'CANCELLED', winnerId: null,
              winningBidAmount: null, wonAt: null,
              buyItNowPendingBuyerId: null, buyItNowPendingAt: null,
            },
          });
          if (claimed.count !== 1) return null;

          const listing = current.listing;
          const linkedRetailId = listing.linkedListingId;
          await tx.listing.update({
            where: { id: listing.id },
            data: linkedRetailId
              ? { status: 'DRAFT', linkedListingId: null, deletedAt: new Date() }
              : { status: 'DRAFT', type: 'CLASSIFIED', linkedListingId: null },
          });
          if (linkedRetailId) {
            await tx.listing.update({
              where: { id: linkedRetailId },
              data: { status: 'ACTIVE', linkedListingId: null },
            });
          }
          const removed = await tx.sale.deleteMany({
            where: { listingId: listing.id, buyerId: winnerId },
          });
          // Never decrement twice or make the counter negative if the Sale
          // was already absent and another worker won the race.
          if (removed.count > 0 && listing.sellerId) {
            await tx.sellerProfile.updateMany({
              where: { userId: listing.sellerId, totalSales: { gt: 0 } },
              data: { totalSales: { decrement: 1 } },
            });
          }
          return { auction: current, listing, linkedRetailId,
            winnerId };
        }, { maxWait: 5000, timeout: 10000 });

        if (!result) continue;
        reverted++;
        const { auction, listing, linkedRetailId, winnerId } = result;
        // Side effects occur only for the transaction's winning worker,
        // after the full state transition committed.
        await this.prisma.analyticsEvent.create({
          data: {
            type: 'auction_outcome',
            payload: {
              auction_id: auction.id,
              auction_run_key: auction.id + ':' + auction.startTime.toISOString(),
              listing_id: listing.id, outcome: 'WIN_REVERTED_UNPAID',
              former_winner_id: winnerId,
              reserve_price: Number(auction.reservePrice),
              starting_bid: Number(auction.startingBid),
              linked_retail_restored: Boolean(linkedRetailId),
            },
          },
        }).catch(() => {});
        await this.notifications.create({
          userId: winnerId, type: 'AUCTION_WIN_EXPIRED',
          title: 'Your auction win was cancelled',
          message: 'You did not pay the £125 buyer fee for "' + listing.title +
            '" in time, so the win was cancelled.',
          entityType: 'AUCTION', entityId: auction.id,
          link: '/dashboard/dealer/auctions/won',
        }).catch(() => {});
        if (listing.sellerId) {
          await this.notifications.create({
            userId: listing.sellerId, type: 'AUCTION_WIN_EXPIRED',
            title: 'Auction sale fell through',
            message: linkedRetailId
              ? 'The winning buyer for "' + listing.title +
                '" did not pay the buyer fee. Your retail listing has been restored.'
              : 'The winning buyer for "' + listing.title +
                '" did not pay the buyer fee. The vehicle is back in your inventory.',
            entityType: 'AUCTION', entityId: auction.id,
            link: '/dashboard/seller/auctions',
          }).catch(() => {});
        }
        this.gateway.broadcastAuctionEnd(auction.id, {
          auctionId: auction.id, winnerId: null,
          winningBidAmount: null, reserveMet: false,
        });
      } catch (error: any) {
        // Transaction rollback protects the Sale and seller counter.
        // A later hourly run can retry this candidate independently.
        this.logger.error('Safe expiry failed for ' + id + ': ' +
          (error?.message ?? String(error)));
      }
    }
    return { reverted };
  }
}
