import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuctionsService } from '../auctions/auctions.service';
import { AuctionGateway } from '../auctions/auction.gateway';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { AUCTION_DURATION_MS } from '../auctions/auction-pricing';

@Injectable()
export class AuctionLifecycleService {
    private readonly logger = new Logger(AuctionLifecycleService.name);
    // Track which auctions have already received a 5-min warning this cycle
    private readonly warnedAuctions = new Set<string>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly auctionsService: AuctionsService,
        private readonly auctionGateway: AuctionGateway,
        private readonly notificationsGateway: NotificationsGateway,
    ) { }

    @Cron('* * * * *') // every minute
    async handleAuctionLifecycle(): Promise<void> {
        const now = new Date();

        // Repair impossible open states before activation/expiry work. This is
        // deliberately sequential: activation must never race a cancellation
        // caused by a listing being withdrawn, rejected or soft-deleted.
        await this.reconcileInvalidOpenAuctions(now);
        await this.activateScheduledAuctions(now);

        await Promise.all([
            this.sendEndingSoonWarnings(now),
            this.closeExpiredAuctions(now),
        ]);
    }

    private async reconcileInvalidOpenAuctions(now: Date): Promise<void> {
        const openAuctions = await this.prisma.auction.findMany({
            where: {
                status: { in: ['SCHEDULED', 'ACTIVE'] },
                deletedAt: null,
            },
            include: {
                listing: {
                    select: {
                        status: true,
                        deletedAt: true,
                    },
                },
            },
        });

        for (const auction of openAuctions) {
            const listingDeleted = Boolean(auction.listing.deletedAt);
            const invalidScheduledParent =
                auction.status === 'SCHEDULED'
                && !['PENDING_REVIEW', 'ACTIVE'].includes(auction.listing.status);
            const invalidActiveParent =
                auction.status === 'ACTIVE'
                && auction.listing.status !== 'ACTIVE';

            if (!listingDeleted && !invalidScheduledParent && !invalidActiveParent) {
                continue;
            }

            const archivedAt = now;
            const previousStatus = auction.status;
            const cancelled = await this.prisma.$transaction(async (tx) => {
                // Claim only the state we inspected. If another request ended or
                // cancelled the auction first, do nothing and preserve its result.
                const claim = await tx.auction.updateMany({
                    where: {
                        id: auction.id,
                        status: previousStatus,
                        deletedAt: null,
                    },
                    data: {
                        status: 'CANCELLED',
                        buyItNowPendingBuyerId: null,
                        buyItNowPendingAt: null,
                    },
                });
                if (claim.count !== 1) return false;

                // Current bids must never leak into a later re-auction of the same
                // listing after an integrity cancellation.
                await tx.bid.updateMany({
                    where: {
                        listingId: auction.listingId,
                        deletedAt: null,
                        cancelledAt: null,
                        archivedAt: null,
                    },
                    data: { archivedAt },
                });
                return true;
            });

            if (!cancelled) continue;

            if (previousStatus === 'ACTIVE') {
                this.auctionGateway.broadcastAuctionEnd(auction.id, {
                    auctionId: auction.id,
                    winnerId: null,
                    winningBidAmount: null,
                    reserveMet: false,
                });
            }

            this.logger.warn(
                `Cancelled invalid ${previousStatus} auction ${auction.id}; parent listing status=${auction.listing.status}, deleted=${listingDeleted}`,
            );
        }
    }

    private async activateScheduledAuctions(now: Date): Promise<void> {
        // Only an approved, non-deleted listing may go live.
        const toActivate = await this.prisma.auction.findMany({
            where: {
                status: 'SCHEDULED',
                startTime: { lte: now },
                deletedAt: null,
                listing: { status: 'ACTIVE', deletedAt: null },
            },
            select: {
                id: true,
                startTime: true,
                endTime: true,
            },
        });

        for (const auction of toActivate) {
            // If the backend was unavailable for an entire scheduled window,
            // do not activate an already-expired auction. Restore a full
            // 24-hour live window from the moment service resumes.
            const scheduleExpired = auction.endTime <= now;
            const claim = await this.prisma.auction.updateMany({
                where: {
                    id: auction.id,
                    status: 'SCHEDULED',
                    startTime: { lte: now },
                    deletedAt: null,
                    listing: { status: 'ACTIVE', deletedAt: null },
                },
                data: {
                    status: 'ACTIVE',
                    ...(scheduleExpired
                        ? {
                            startTime: now,
                            endTime: new Date(now.getTime() + AUCTION_DURATION_MS),
                        }
                        : {}),
                },
            });

            // updateMany is the lifecycle compare-and-set. If the listing was
            // withdrawn/deleted or the auction changed between read and write,
            // another path won the race and no start event is emitted.
            if (claim.count !== 1) continue;

            this.auctionGateway.broadcastAuctionStart(auction.id);
            this.logger.log(
                scheduleExpired
                    ? `Activated auction ${auction.id} with a restored 24-hour window`
                    : `Activated auction ${auction.id}`,
            );
        }
    }

    private async sendEndingSoonWarnings(now: Date): Promise<void> {
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        const endingSoon = await this.prisma.auction.findMany({
            where: {
                status: 'ACTIVE',
                endTime: { gt: now, lte: fiveMinutesFromNow },
                deletedAt: null,
            },
            include: {
                listing: {
                    include: {
                        bids: {
                            select: { bidderId: true },
                            distinct: ['bidderId'],
                            where: { deletedAt: null, cancelledAt: null, archivedAt: null },
                        },
                    },
                },
            },
        });

        for (const auction of endingSoon) {
            if (this.warnedAuctions.has(auction.id)) continue;

            for (const { bidderId } of auction.listing.bids) {
                this.notificationsGateway.sendNotification(bidderId, {
                    type: 'AUCTION_ENDING',
                    title: 'Auction ending soon!',
                    message: `An auction you bid on ends in under 5 minutes.`,
                    entityType: 'AUCTION',
                    entityId: auction.id,
                    link: `/auctions/live/${auction.id}`,
                });
            }

            this.warnedAuctions.add(auction.id);
            this.logger.log(`Sent ending-soon warnings for auction ${auction.id}`);
        }

        // Clean up warned set for auctions that have already ended
        for (const auctionId of this.warnedAuctions) {
            const stillActive = endingSoon.find(a => a.id === auctionId);
            if (!stillActive) this.warnedAuctions.delete(auctionId);
        }
    }

    private async closeExpiredAuctions(now: Date): Promise<void> {
        const toClose = await this.prisma.auction.findMany({
            where: {
                status: 'ACTIVE',
                endTime: { lte: now },
                deletedAt: null,
                listing: { status: 'ACTIVE', deletedAt: null },
            },
        });

        for (const auction of toClose) {
            try {
                await this.auctionsService.closeAuction(auction.id);
                this.logger.log(`Closed auction ${auction.id}`);
            } catch (err) {
                this.logger.error(`Failed to close auction ${auction.id}: ${err}`);
            }
        }
    }
}
