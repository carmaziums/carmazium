import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Sends a one-shot "your watchlist auction ends in 24h" reminder to every user
 * who has watched an active auction that ends between now and now+24h AND
 * hasn't already received the reminder for that item.
 *
 * Idempotency: the `reminded24hAt` column on WatchlistItem is set the moment
 * we successfully create the notification, so re-runs of the same cron never
 * double-send. A cancelled/removed watchlist entry is deleted, which resets
 * eligibility on re-add.
 */
@Injectable()
export class WatchlistReminderService {
    private readonly logger = new Logger(WatchlistReminderService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) { }

    @Cron('*/15 * * * *') // every 15 minutes
    async send24hReminders(): Promise<void> {
        const now = new Date();
        // Window: auctions ending between now and now+24h.
        // Cron cadence (15 min) means a user gets their reminder within 15 min
        // of the 24h mark, never earlier than that.
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const items = await this.prisma.watchlistItem.findMany({
            where: {
                reminded24hAt: null,
                listing: {
                    auction: {
                        status: 'ACTIVE',
                        endTime: { gt: now, lte: in24h },
                        deletedAt: null,
                    },
                },
            },
            include: {
                listing: { include: { auction: true } },
            },
            take: 500,
        });

        if (items.length === 0) return;

        for (const item of items) {
            const auction = item.listing.auction;
            if (!auction) continue;
            try {
                await this.notifications.create({
                    userId: item.userId,
                    type: 'WATCHLIST_ENDING_24H',
                    title: 'A vehicle you saved ends in 24 hours',
                    message: `${item.listing.title} — closes ${new Date(auction.endTime).toLocaleString('en-GB')}`,
                    entityType: 'auction',
                    entityId: auction.id,
                    link: `/auctions/live/${auction.id}`,
                });
                await this.prisma.watchlistItem.update({
                    where: { id: item.id },
                    data: { reminded24hAt: new Date() },
                });
            } catch (err) {
                this.logger.error(
                    `Failed to send watchlist 24h reminder for item ${item.id}: ${(err as Error).message}`,
                );
            }
        }

        this.logger.log(`Sent ${items.length} watchlist 24h reminders`);
    }
}
