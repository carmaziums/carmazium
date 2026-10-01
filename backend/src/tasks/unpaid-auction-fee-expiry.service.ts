import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuctionsService } from '../auctions/auctions.service';
import { BUYER_FEE_GRACE_MS } from '../auctions/buyer-fee-deadline';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class UnpaidAuctionFeeExpiryService {
    private readonly logger = new Logger(UnpaidAuctionFeeExpiryService.name);
    constructor(
        private readonly auctionsService: AuctionsService,
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
        private readonly email: EmailService,
    ) {}

    /** Hourly, offset from the expiry job. A conditional database claim prevents
     * duplicate 24h/6h reminders, even when multiple Fly machines run cron.
     * No reminder is sent for a paid/granted, reassigned or expired win.
     */
    @Cron('30 * * * *')
    async remindUnpaidWinners(now = new Date()): Promise<void> {
        const clock = now.getTime();
        if (!Number.isFinite(clock)) return;
        const hour = 60 * 60 * 1000;
        const auctions = await this.prisma.auction.findMany({
            where: {
                deletedAt: null, status: 'ENDED', buyerFeePaid: false,
                winnerId: { not: null },
                wonAt: { gte: new Date(clock - BUYER_FEE_GRACE_MS), lte: new Date(clock - 48 * hour) },
                OR: [{ buyerFeeReminder24SentAt: null }, { buyerFeeReminder6SentAt: null }],
            },
            include: { listing: { select: { title: true } } },
            take: 200,
            orderBy: { wonAt: 'asc' },
        });
        for (const auction of auctions) {
            try {
                if (!auction.wonAt || !auction.winnerId) continue;
                const deadline = new Date(auction.wonAt.getTime() + BUYER_FEE_GRACE_MS);
                const hoursRemaining = (deadline.getTime() - clock) / hour;
                const stage: 24 | 6 | null = hoursRemaining > 6 && hoursRemaining <= 24
                    ? 24 : hoursRemaining > 0 && hoursRemaining <= 6 ? 6 : null;
                if (stage === null) continue;
                const field = stage === 24 ? 'buyerFeeReminder24SentAt' : 'buyerFeeReminder6SentAt';
                if (auction[field]) continue;
                const claimed = await this.prisma.auction.updateMany({
                    where: {
                        id: auction.id, winnerId: auction.winnerId, wonAt: auction.wonAt,
                        status: 'ENDED', deletedAt: null, buyerFeePaid: false, [field]: null,
                    },
                    data: { [field]: new Date(clock) },
                });
                if (claimed.count !== 1) continue;
                // Re-check the winner and payment before external notifications.
                const latest = await this.prisma.auction.findUnique({
                    where: { id: auction.id },
                    select: { status: true, winnerId: true, wonAt: true, buyerFeePaid: true, deletedAt: true },
                });
                if (!latest || latest.deletedAt || latest.status !== 'ENDED' ||
                    latest.winnerId !== auction.winnerId || latest.buyerFeePaid ||
                    latest.wonAt?.getTime() !== auction.wonAt.getTime() || deadline.getTime() <= clock) continue;
                await this.notifications.create({
                    userId: auction.winnerId,
                    type: 'AUCTION_FEE_REMINDER',
                    title: stage === 24 ? '24 hours left to pay your buyer fee' : '6 hours left to pay your buyer fee',
                    message: 'Your £125 buyer fee for "' + auction.listing.title + '" is due by ' +
                        new Intl.DateTimeFormat('en-GB', {
                            timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short',
                        }).format(deadline) + ' UK time. Log in to complete payment.',
                    entityType: 'AUCTION', entityId: auction.id,
                    link: '/dashboard/dealer/auctions/won',
                    data: { buyerFeeDeadlineAt: deadline.toISOString(), hoursStage: stage },
                });
                if (await this.notifications.shouldSendEmail(auction.winnerId, 'AUCTION_FEE_REMINDER')) {
                    const buyer = await this.prisma.user.findUnique({
                        where: { id: auction.winnerId }, select: { email: true },
                    });
                    if (buyer?.email) await this.email.sendAuctionBuyerFeeReminderEmail({
                        toEmail: buyer.email, vehicleTitle: auction.listing.title, deadline, hoursStage: stage,
                    });
                }
            } catch (error: any) {
                this.logger.error('Buyer fee reminder failed for ' + auction.id + ': ' + (error?.message || error));
            }
        }
    }

    // Keep the original 72-hour expiry and cancellation logic unchanged.
    @Cron('0 * * * *')
    async handleUnpaidAuctionFeeExpiry(): Promise<void> {
        try {
            const result = await this.auctionsService.revertUnpaidWins();
            if (result.reverted > 0) {
                this.logger.log('Reverted ' + result.reverted + ' unpaid auction win(s).');
            }
        } catch (err) {
            this.logger.error('Error during unpaid auction fee expiry check:', err);
        }
    }
}
