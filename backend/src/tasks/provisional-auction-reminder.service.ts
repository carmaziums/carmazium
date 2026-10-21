import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

/**
 * Sends one 24-hour and one 72-hour reminder per provisional auction RUN.
 * The partial unique index in the companion migration makes claims atomic
 * across Fly machines. Never changes the seller's decision or any bid.
 */
@Injectable()
export class ProvisionalAuctionReminderService {
    private readonly logger = new Logger(ProvisionalAuctionReminderService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
        private readonly email: EmailService,
    ) {}

    @Cron('45 * * * *')
    async remindSellers(now = new Date()): Promise<void> {
        const day = 24 * 60 * 60 * 1000;
        const nowMs = now.getTime();
        if (!Number.isFinite(nowMs)) return;
        const auctions = await this.prisma.auction.findMany({
            where: {
                status: 'ENDED', deletedAt: null, winnerId: null, wonAt: null,
                provisionalOfferBidId: { not: null },
                provisionalOfferedAt: { not: null, lte: new Date(nowMs - day) },
                listing: {
                    deletedAt: null, sellerId: { not: null },
                    OR: [{ status: 'DRAFT' }, { status: 'ACTIVE', type: 'CLASSIFIED' }],
                },
            },
            include: { listing: { select: { title: true, sellerId: true, status: true,
                type: true, linkedListingId: true } } },
            orderBy: { provisionalOfferedAt: 'asc' },
            take: 200,
        });

        for (const auction of auctions) {
            if (!auction.provisionalOfferedAt || !auction.provisionalOfferBidId ||
                !auction.listing?.sellerId) continue;
            const elapsed = nowMs - auction.provisionalOfferedAt.getTime();
            const stage = elapsed >= 3 * day ? 72 : elapsed >= day ? 24 : null;
            if (!stage) continue;
            // Include the run timestamp: after re-auctioning, the same auction
            // ID may have a new bidder and must receive a fresh reminder.
            const actionType = 'PROVISIONAL_REMINDER_' + stage + 'H_' +
                auction.provisionalOfferedAt.getTime();
            try {
                // A second server hitting the unique index never sends duplicate
                // push or email. Only the successful insertion sends either.
                await this.notifications.create({
                    userId: auction.listing.sellerId,
                    type: 'AUCTION_PROVISIONAL_REMINDER',
                    actionType,
                    title: stage === 24 ? 'Reminder: decide on your auction offer'
                        : 'Final reminder: your provisional offer is still awaiting a decision',
                    message: 'Your auction for ' + auction.listing.title +
                        ' has an outstanding below-reserve offer. Review it, accept or decline it explicitly. No sale occurs without your consent.',
                    entityType: 'AUCTION', entityId: auction.id,
                    link: '/auctions/live/' + auction.id,
                    data: { auctionId: auction.id, listingId: auction.listingId,
                        sellerDecisionPending: true, hoursStage: stage },
                });
            } catch (error: any) {
                if (error?.code === 'P2002') continue;
                this.logger.error('Could not create provisional reminder for ' + auction.id, error);
                continue;
            }
            try {
                if (await this.notifications.shouldSendEmail(auction.listing.sellerId, 'AUCTION_PROVISIONAL_REMINDER')) {
                    const seller = await this.prisma.user.findUnique({
                        where: { id: auction.listing.sellerId },
                        select: { email: true, firstName: true },
                    });
                    const bid = await this.prisma.bid.findUnique({
                        where: { id: auction.provisionalOfferBidId },
                        select: { amount: true },
                    });
                    if (seller?.email && bid) await this.email.sendAuctionProvisionalOfferEmail({
                        toEmail: seller.email, sellerName: seller.firstName || 'there',
                        vehicleTitle: auction.listing.title, amount: Number(bid.amount),
                        reservePrice: Number(auction.reservePrice),
                        auctionId: auction.id, listingId: auction.listingId,
                        ended: true,
                        retailAlreadyLive: auction.listing.type === 'CLASSIFIED'
                            && auction.listing.status === 'ACTIVE'
                            || Boolean(auction.listing.linkedListingId),
                    });
                }
            } catch (error: any) {
                this.logger.error('Provisional reminder email failed for ' + auction.id, error);
            }
        }
    }
}
