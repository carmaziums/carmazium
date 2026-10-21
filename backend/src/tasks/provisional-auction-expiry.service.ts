import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { PROVISIONAL_OFFER_VALIDITY_MS, provisionalOfferExpired } from '../auctions/provisional-expiry.policy';

/**
 * Expire offers every five minutes. The contractual deadline is enforced
 * independently in acceptBid and never depends on this cron's start time.
 * Both notification creation and email dispatch are resumable, bounded work.
 */
@Injectable()
export class ProvisionalAuctionExpiryService {
    private readonly logger = new Logger(ProvisionalAuctionExpiryService.name);
    private static readonly BATCH_SIZE = 100;
    private static readonly MAX_EMAIL_ATTEMPTS = 6;

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
        private readonly email: EmailService,
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
                            id: true, status: true, deletedAt: true, winnerId: true, wonAt: true,
                            provisionalOfferBidId: true, provisionalOfferedAt: true,
                            listing: { select: { sellerId: true } },
                        },
                    });
                    if (!auction || auction.deletedAt || auction.status !== 'ENDED'
                        || auction.winnerId || auction.wonAt || !auction.provisionalOfferBidId
                        || !auction.provisionalOfferedAt
                        || !provisionalOfferExpired(auction.provisionalOfferedAt, now)) return;

                    const exactDeadline = new Date(
                        auction.provisionalOfferedAt.getTime() + PROVISIONAL_OFFER_VALIDITY_MS,
                    );
                    const claimed = await tx.auction.updateMany({
                        where: {
                            id: auction.id, deletedAt: null, status: 'ENDED',
                            winnerId: null, wonAt: null,
                            provisionalOfferBidId: auction.provisionalOfferBidId,
                            provisionalOfferedAt: auction.provisionalOfferedAt,
                        },
                        data: {
                            provisionalExpiredBidId: auction.provisionalOfferBidId,
                            provisionalExpiredAt: now, // when the worker persisted the expiry
                            provisionalExpiryDeadlineAt: exactDeadline, // original contractual deadline
                            provisionalExpiryNotifiedAt: null,
                            provisionalOfferBidId: null,
                            provisionalOfferedAt: null,
                        },
                    });
                    if (claimed.count !== 1) return;
                    if (auction.listing.sellerId) {
                        await tx.notification.updateMany({
                            where: {
                                userId: auction.listing.sellerId, entityId: auction.id, isRead: false,
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

        try {
            await this.publishOutstandingExpiryNotices();
        } catch (error) {
            this.logger.error('Could not process pending expiry notifications', error);
        }
        try {
            await this.sendPendingExpiryEmails();
        } catch (error) {
            this.logger.error('Could not process pending expiry emails', error);
        }
    }

    /**
     * Read only the indexed *unfinished* expiry outbox (max 100 per run).
     * Existing seller/bidder notification records are reused after a restart.
     * Once both are present the auction is removed from this work queue.
     */
    private async publishOutstandingExpiryNotices(): Promise<void> {
        const expired = await this.prisma.auction.findMany({
            where: {
                deletedAt: null, status: 'ENDED', winnerId: null, wonAt: null,
                provisionalExpiredAt: { not: null },
                provisionalExpiredBidId: { not: null },
                provisionalExpiryNotifiedAt: null,
            },
            select: {
                id: true, listingId: true,
                provisionalExpiredAt: true, provisionalExpiryDeadlineAt: true,
                provisionalExpiredBidId: true,
                listing: { select: { title: true, sellerId: true } },
            },
            orderBy: { provisionalExpiredAt: 'asc' },
            take: ProvisionalAuctionExpiryService.BATCH_SIZE,
        });

        for (const auction of expired) {
            if (!auction.provisionalExpiredAt || !auction.provisionalExpiredBidId) continue;
            // Preserve the original notification key on historic expiries.
            const key = 'PROVISIONAL_REMINDER_EXPIRED_' + auction.provisionalExpiredAt.getTime();
            const bid = await this.prisma.bid.findUnique({
                where: { id: auction.provisionalExpiredBidId },
                select: { bidderId: true, amount: true },
            }).catch(error => {
                this.logger.error('Could not read expired bidder ' + auction.id, error);
                return null;
            });
            if (!bid) continue; // retry after transient failure, do not permanently lose notices
            const amount = Number(bid.amount).toLocaleString('en-GB');
            const title = auction.listing.title || 'your vehicle';
            const deadline = auction.provisionalExpiryDeadlineAt ?? auction.provisionalExpiredAt;
            const recipients = [
                ...(auction.listing.sellerId ? [{
                    userId: auction.listing.sellerId,
                    role: 'seller',
                    title: 'Provisional auction offer expired after 72 hours',
                    message: 'The provisional £' + amount + ' offer for ' + title +
                        ' has expired. You cannot accept it. There is no completed sale.',
                }] : []),
                ...(bid.bidderId ? [{
                    userId: bid.bidderId,
                    role: 'bidder',
                    title: 'Your provisional auction bid has expired',
                    message: 'Your provisional £' + amount + ' offer for ' + title +
                        ' expired without seller acceptance. No sale or buyer fee is due.',
                }] : []),
            ];
            let persisted = true;
            for (const recipient of recipients) {
                let notice = await this.prisma.notification.findFirst({
                    where: { userId: recipient.userId, entityId: auction.id, actionType: key },
                    select: { id: true },
                });
                if (notice) continue;
                try {
                    const row = await this.notifications.create({
                        userId: recipient.userId,
                        title: recipient.title,
                        message: recipient.message,
                        type: 'AUCTION_PROVISIONAL_EXPIRED',
                        actionType: key,
                        entityType: 'AUCTION',
                        entityId: auction.id,
                        link: '/auctions/live/' + auction.id,
                        data: {
                            auctionId: auction.id, listingId: auction.listingId,
                            recipientRole: recipient.role,
                            sellerDecisionPending: false, provisionalExpired: true,
                            expiryAt: deadline.toISOString(), emailStatus: 'pending',
                        },
                    });
                    notice = { id: row.id };
                } catch (error: any) {
                    // Another machine may have inserted the row while we sent push.
                    notice = await this.prisma.notification.findFirst({
                        where: { userId: recipient.userId, entityId: auction.id, actionType: key },
                        select: { id: true },
                    });
                    if (!notice && error?.code !== 'P2002') {
                        this.logger.error('Could not create expiry notice ' + auction.id, error);
                    }
                }
                if (!notice) persisted = false;
            }
            if (persisted) {
                await this.prisma.auction.updateMany({
                    where: {
                        id: auction.id, provisionalExpiredBidId: auction.provisionalExpiredBidId,
                        provisionalExpiryNotifiedAt: null,
                    },
                    data: { provisionalExpiryNotifiedAt: new Date() },
                });
            }
        }
    }

    /** Claim one email per recipient using a DB lease, regardless of how many Fly instances run. */
    private async sendPendingExpiryEmails(): Promise<void> {
        const pending = await this.prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "notifications"
            WHERE type='AUCTION_PROVISIONAL_EXPIRED'
              AND COALESCE(data->>'emailStatus','pending') NOT IN ('submitted','skipped','failed')
              AND COALESCE((data->>'emailAttempts')::int,0) < ${ProvisionalAuctionExpiryService.MAX_EMAIL_ATTEMPTS}
              AND (data->>'emailLeaseUntil' IS NULL
                  OR (data->>'emailLeaseUntil')::timestamptz <= NOW())
            ORDER BY "createdAt" ASC
            LIMIT ${ProvisionalAuctionExpiryService.BATCH_SIZE}
        `;
        if (!pending.length) return;
        const notifications = await this.prisma.notification.findMany({
            where: { id: { in: pending.map(row => row.id) } },
            select: {
                id: true, userId: true, entityId: true, title: true, message: true,
                user: { select: { email: true } },
            },
        });
        for (const notice of notifications) {
            const token = randomUUID();
            const claimed = await this.prisma.$queryRaw<Array<{ id: string }>>`
                UPDATE "notifications"
                SET data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
                    'emailClaimToken', ${token},
                    'emailStatus', 'sending',
                    'emailAttempts', COALESCE((data->>'emailAttempts')::int,0)+1,
                    'emailLeaseUntil', (NOW()+interval '15 minutes')::text
                )
                WHERE id=${notice.id}
                  AND COALESCE(data->>'emailStatus','pending') NOT IN ('submitted','skipped','failed')
                  AND COALESCE((data->>'emailAttempts')::int,0)<${ProvisionalAuctionExpiryService.MAX_EMAIL_ATTEMPTS}
                  AND (data->>'emailLeaseUntil' IS NULL
                       OR (data->>'emailLeaseUntil')::timestamptz <= NOW())
                RETURNING id
            `;
            if (!claimed.length) continue;
            try {
                const emailAllowed = await this.notifications.shouldSendEmail(
                    notice.userId, 'AUCTION_PROVISIONAL_EXPIRED',
                );
                if (!notice.user.email || !emailAllowed || !notice.entityId) {
                    await this.completeEmailAttempt(notice.id, token, 'skipped',
                        !notice.user.email ? 'Recipient has no email' : 'Email disabled or auction missing');
                    continue;
                }
                const result = await this.email.sendAuctionProvisionalExpiredEmail({
                    toEmail: notice.user.email,
                    subject: notice.title,
                    message: notice.message,
                    auctionId: notice.entityId,
                });
                await this.completeEmailAttempt(notice.id, token,
                    result?.id ? 'submitted' : 'retryable',
                    result?.id ? '' : 'Email provider did not acknowledge the message',
                    result?.id ?? null);
            } catch (error: any) {
                this.logger.error('Expired auction email submission failed for ' + notice.id, error);
                try {
                    await this.completeEmailAttempt(notice.id, token, 'retryable',
                        String(error?.message || error).slice(0,300));
                } catch (statusError) {
                    this.logger.error('Could not record expiry email failure', statusError);
                }
            }
        }
    }

    private async completeEmailAttempt(
        id: string, token: string, status: 'submitted' | 'retryable' | 'skipped',
        reason: string, providerId: string | null = null,
    ): Promise<void> {
        // "submitted" deliberately does not claim inbox delivery or an open.
        await this.prisma.$queryRaw`
            UPDATE "notifications"
            SET data = COALESCE(data,'{}'::jsonb) || jsonb_build_object(
                'emailStatus', CASE WHEN ${status}='retryable'
                    AND COALESCE((data->>'emailAttempts')::int,0)>=${ProvisionalAuctionExpiryService.MAX_EMAIL_ATTEMPTS}
                    THEN 'failed' ELSE ${status} END,
                'emailLastError', ${reason},
                'emailProviderMessageId', ${providerId},
                'emailSubmittedAt', CASE WHEN ${status}='submitted' THEN NOW()::text ELSE NULL END,
                'emailLeaseUntil', CASE WHEN ${status}='retryable'
                    THEN (NOW()+interval '1 hour')::text ELSE NULL END,
                'emailClaimToken', NULL
            )
            WHERE id=${id} AND data->>'emailClaimToken'=${token}
            RETURNING id
        `;
    }
}
