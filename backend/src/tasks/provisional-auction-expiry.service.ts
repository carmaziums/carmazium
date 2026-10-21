import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PROVISIONAL_OFFER_VALIDITY_MS, provisionalOfferExpired } from '../auctions/provisional-expiry.policy';

/** Expires unsold below-reserve offers after exactly 72 hours.
 *
 * The acceptBid endpoint independently checks the same deadline under the
 * auction listing's advisory lock. Here we persist the expiry, unblock Retail
 * activity, retire old seller prompts and notify both parties. Each Fly worker
 * uses the same DB lock; notifications are uniquely keyed per run and user.
 */
@Injectable()
export class ProvisionalAuctionExpiryService {
    private readonly logger = new Logger(ProvisionalAuctionExpiryService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) {}

    @Cron('*/5 * * * *')
    async expireOffers(now: Date = new Date()): Promise<void> {
        if (!Number.isFinite(now.getTime())) return;
        const due = await this.prisma.auction.findMany({
            where: {
                deletedAt: null, status: 'ENDED', winnerId: null, wonAt: null,
                provisionalOfferBidId: { not: null },
                provisionalOfferedAt: { lte: new Date(now.getTime() - PROVISIONAL_OFFER_VALIDITY_MS) },
            },
            orderBy: { provisionalOfferedAt: 'asc' },
            select: { id: true, listingId: true },
            take: 300,
        });

        for (const candidate of due) {
            try {
                await this.prisma.$transaction(async tx => {
                    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${candidate.listingId}, 0))::text`;
                    const auction = await tx.auction.findUnique({
                        where: { id: candidate.id },
                        select: {
                            id: true, listingId: true, status: true, deletedAt: true,
                            winnerId: true, wonAt: true,
                            provisionalOfferBidId: true, provisionalOfferedAt: true,
                            listing: { select: { sellerId: true } },
                        },
                    });
                    if (!auction || auction.deletedAt || auction.status !== 'ENDED'
                        || auction.winnerId || auction.wonAt || !auction.provisionalOfferBidId
                        || !provisionalOfferExpired(auction.provisionalOfferedAt, now)) return;
                    const claimed = await tx.auction.updateMany({
                        where: {
                            id: auction.id, deletedAt: null, status: 'ENDED',
                            winnerId: null, wonAt: null,
                            provisionalOfferBidId: auction.provisionalOfferBidId,
                            provisionalOfferedAt: auction.provisionalOfferedAt,
                        },
                        data: {
                            provisionalExpiredBidId: auction.provisionalOfferBidId,
                            provisionalExpiredAt: now,
                            provisionalOfferBidId: null,
                            provisionalOfferedAt: null,
                        },
                    });
                    if (claimed.count !== 1) return;
                    if (auction.listing.sellerId) {
                        await tx.notification.updateMany({
                            where: {
                                userId: auction.listing.sellerId,
                                entityId: auction.id, isRead: false,
                                OR: [
                                    { actionType: 'ACCEPT_OR_RELIST' },
                                    { type: 'AUCTION_PROVISIONAL_REMINDER' },
                                ],
                            },
                            data: { isRead: true },
                        });
                    }
                });
            } catch (error) {
                this.logger.error('Could not expire provisional auction ' + candidate.id, error);
            }
        }
        // Recover notification delivery after an interrupted worker or a
        // deployment restart. Unique index prevents duplicate notices.
        await this.publishOutstandingExpiryNotices();
    }

    private async publishOutstandingExpiryNotices(): Promise<void> {
        const expired = await this.prisma.auction.findMany({
            where: {
                deletedAt: null, status: 'ENDED', winnerId: null, wonAt: null,
                provisionalExpiredAt: { not: null },
                provisionalExpiredBidId: { not: null },
            },
            select: {
                id: true, listingId: true, provisionalExpiredAt: true,
                provisionalExpiredBidId: true,
                listing: { select: { title: true, sellerId: true } },
            },
            orderBy: { provisionalExpiredAt: 'desc' },
            take: 500,
        });

        for (const auction of expired) {
            if (!auction.provisionalExpiredAt || !auction.provisionalExpiredBidId) continue;
            const key = 'PROVISIONAL_REMINDER_EXPIRED_' + auction.provisionalExpiredAt.getTime();
            const bid = await this.prisma.bid.findUnique({
                where: { id: auction.provisionalExpiredBidId },
                select: { bidderId: true, amount: true },
            }).catch(error => {
                this.logger.error('Could not read expired bidder ' + auction.id, error);
                return null;
            });
            const amount = bid ? Number(bid.amount).toLocaleString('en-GB') : null;
            const title = auction.listing.title || 'your vehicle';

            const recipients = [
                ...(auction.listing.sellerId ? [{
                    userId: auction.listing.sellerId,
                    title: 'Provisional auction offer expired after 72 hours',
                    message: 'The provisional' + (amount ? ' £' + amount : '')
                        + ' offer for ' + title
                        + ' has expired. You cannot accept that offer now. There is no completed sale. You can manage Retail or re-list in auction.',
                }] : []),
                ...(bid?.bidderId ? [{
                    userId: bid.bidderId,
                    title: 'Your provisional auction bid has expired',
                    message: 'Your provisional' + (amount ? ' £' + amount : '')
                        + ' offer for ' + title
                        + ' expired after 72 hours without seller acceptance. You have not won, and no buyer fee is due.',
                }] : []),
            ];
            for (const recipient of recipients) {
                // Both in-app and push. No email needs to be dispatched twice
                // by multiple machines: the existing partial unique index
                // restricts actionType PROVISIONAL_REMINDER_% per user/auction.
                const alreadySent = await this.prisma.notification.findFirst({
                    where: { userId: recipient.userId, entityId: auction.id, actionType: key },
                    select: { id: true },
                });
                if (alreadySent) continue;
                try {
                    await this.notifications.create({
                        ...recipient,
                        type: 'AUCTION_PROVISIONAL_EXPIRED',
                        actionType: key,
                        entityType: 'AUCTION',
                        entityId: auction.id,
                        link: '/auctions/live/' + auction.id,
                        data: {
                            auctionId: auction.id, listingId: auction.listingId,
                            provisionalExpired: true, sellerDecisionPending: false,
                            expiryAt: auction.provisionalExpiredAt.toISOString(),
                        },
                    });
                } catch (error: any) {
                    if (error?.code !== 'P2002') {
                        this.logger.error('Could not send provisional expiry notice for ' + auction.id, error);
                    }
                }
            }
        }
    }
}
