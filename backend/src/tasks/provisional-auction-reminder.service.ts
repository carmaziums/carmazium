import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { PROVISIONAL_OFFER_VALIDITY_MS } from '../auctions/provisional-expiry.policy';

/**
 * One persisted in-app notice per auction/run/stage, with separately tracked
 * email delivery. A unique partial notification index prevents duplicate
 * notices; a short database lease prevents concurrent email sends on Fly.
 * Provider failures are retried, never reported as successfully delivered.
 */
@Injectable()
export class ProvisionalAuctionReminderService {
    private readonly logger = new Logger(ProvisionalAuctionReminderService.name);
    private static readonly MAX_EMAIL_ATTEMPTS = 6;

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
        private readonly email: EmailService,
    ) {}

    private async finishEmailAttempt(notificationId: string, token: string, status: 'sent' | 'retryable' | 'skipped', reason: string): Promise<void> {
        await this.prisma.$queryRaw`
            UPDATE "notifications"
            SET data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
                'emailStatus', ${status},
                'emailLastError', ${reason},
                'emailLeaseUntil', CASE WHEN ${status} = 'retryable'
                    THEN (NOW() + interval '1 hour')::text ELSE NULL END,
                'emailClaimToken', NULL,
                'emailSentAt', CASE WHEN ${status} = 'sent' THEN NOW()::text ELSE NULL END
            )
            WHERE id = ${notificationId} AND data->>'emailClaimToken' = ${token}
            RETURNING id
        `;
    }

    /** Surface exhausted email retries to administrators without leaking seller
     * details publicly. The existing partial unique index on
     * PROVISIONAL_REMINDER_% guarantees one alert per admin/auction/run/stage,
     * even when several Fly instances execute the same cron. */
    private async alertAdminsIfExhausted(
        auction: { id: string; listingId: string; provisionalOfferBidId: string | null;
            provisionalOfferedAt: Date | null; listing: { title: string; sellerId: string | null } },
        notificationId: string,
        stage: number,
    ): Promise<void> {
        const row = await this.prisma.notification.findUnique({
            where: { id: notificationId }, select: { data: true },
        });
        const data = (row?.data && typeof row.data === 'object' && !Array.isArray(row.data))
            ? row.data as Record<string, any> : {};
        const attempts = Number(data.emailAttempts ?? 0);
        const state = String(data.emailStatus || '');
        const leaseUntil = Date.parse(String(data.emailLeaseUntil || ''));
        const exhausted = attempts >= ProvisionalAuctionReminderService.MAX_EMAIL_ATTEMPTS
            && state !== 'sent' && state !== 'skipped'
            && (state === 'retryable'
                || (state === 'sending' && Number.isFinite(leaseUntil) && leaseUntil < Date.now()));
        if (!exhausted) return;

        // Do not alert an admin about an offer the seller has already resolved.
        const pending = await this.prisma.auction.findFirst({
            where: { id: auction.id, status: 'ENDED', deletedAt: null, winnerId: null, wonAt: null,
                provisionalOfferBidId: auction.provisionalOfferBidId,
                provisionalOfferedAt: auction.provisionalOfferedAt },
            select: { id: true },
        });
        if (!pending) return;

        const admins = await this.prisma.user.findMany({
            where: { role: 'ADMIN' }, select: { id: true },
        });
        const actionType = 'PROVISIONAL_REMINDER_EMAIL_FAILED_' + stage + 'H_'
            + auction.provisionalOfferedAt!.getTime();
        for (const admin of admins) {
            try {
                await this.notifications.create({
                    userId: admin.id,
                    type: 'AUCTION_PROVISIONAL_EMAIL_FAILURE',
                    actionType,
                    title: 'Auction reminder email needs attention',
                    message: 'The seller reminder email for ' + auction.listing.title
                        + ' was not confirmed by the email provider after '
                        + attempts + ' attempts. Check email delivery and the outstanding seller decision.',
                    entityType: 'AUCTION', entityId: auction.id,
                    link: '/auctions/live/' + auction.id,
                    data: { auctionId: auction.id, listingId: auction.listingId,
                        sellerDecisionPending: true, emailAttempts: attempts,
                        emailReminderFailed: true, hoursStage: stage },
                });
            } catch (error: any) {
                // P2002 means another Fly worker already delivered the alert.
                if (error?.code !== 'P2002') {
                    this.logger.error('Could not alert admin of exhausted auction email retries', error);
                }
            }
        }
    }

    @Cron('45 * * * *')
    async remindSellers(now = new Date()): Promise<void> {
        const day = 24 * 60 * 60 * 1000;
        const nowMs = now.getTime();
        if (!Number.isFinite(nowMs)) return;

        const auctions = await this.prisma.auction.findMany({
            where: {
                status: 'ENDED', deletedAt: null, winnerId: null, wonAt: null,
                provisionalOfferBidId: { not: null },
                provisionalOfferedAt: { not: null, lte: new Date(nowMs - day), gt: new Date(nowMs - PROVISIONAL_OFFER_VALIDITY_MS) },
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
            // At exactly 72h this is expired, not a seller-decision reminder.
            // The independent acceptance guard refuses an overdue offer even
            // before the expiry worker persists the outcome.
            const stage = elapsed >= day && elapsed < PROVISIONAL_OFFER_VALIDITY_MS ? 24 : null;
            if (!stage) continue;
            const actionType = 'PROVISIONAL_REMINDER_' + stage + 'H_' +
                auction.provisionalOfferedAt.getTime();

            // The auction can be resolved between the hourly candidate query
            // and this loop. Never create a fresh action-needed notification
            // for an offer that is already accepted, declined or withdrawn.
            const stillPending = await this.prisma.auction.findFirst({
                where: { id: auction.id, status: 'ENDED', deletedAt: null,
                    winnerId: null, wonAt: null,
                    provisionalOfferBidId: auction.provisionalOfferBidId,
                    provisionalOfferedAt: { equals: auction.provisionalOfferedAt,
                        gt: new Date(Date.now() - PROVISIONAL_OFFER_VALIDITY_MS) },
                    listing: { deletedAt: null, sellerId: auction.listing.sellerId,
                        OR: [{ status: 'DRAFT' }, { status: 'ACTIVE', type: 'CLASSIFIED' }] },
                },
                select: { id: true },
            });
            if (!stillPending) continue;

            // It is possible for the notification row to be persisted and the
            // push service to fail. Look it up again rather than losing email
            // retries just because the push notification could not be sent.
            let notice = await this.prisma.notification.findFirst({
                where: { userId: auction.listing.sellerId, entityId: auction.id, actionType },
                select: { id: true },
            });
            if (!notice) {
                try {
                    const created = await this.notifications.create({
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
                    notice = { id: created.id };
                } catch (error: any) {
                    // A unique-constraint race or downstream push failure may
                    // happen *after* the notice was saved.
                    notice = await this.prisma.notification.findFirst({
                        where: { userId: auction.listing.sellerId, entityId: auction.id, actionType },
                        select: { id: true },
                    });
                    if (!notice) {
                        this.logger.error('Could not persist seller reminder for ' + auction.id, error);
                        continue;
                    }
                }
            }
            if (!notice) continue;

            // Single-writer, bounded retry claim; if a process dies, its lease
            // expires. An email is complete only if dispatch returned an ID.
            const token = randomUUID();
            let claim: Array<{ id: string }>;
            try {
                claim = await this.prisma.$queryRaw<Array<{ id: string }>>`
                    UPDATE "notifications"
                    SET data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
                        'emailClaimToken', ${token},
                        'emailStatus', 'sending',
                        'emailAttempts', COALESCE((data->>'emailAttempts')::int, 0) + 1,
                        'emailLeaseUntil', (NOW() + interval '15 minutes')::text
                    )
                    WHERE id = ${notice.id}
                      AND COALESCE(data->>'emailStatus', 'pending') NOT IN ('sent', 'skipped')
                      AND COALESCE((data->>'emailAttempts')::int, 0) < ${ProvisionalAuctionReminderService.MAX_EMAIL_ATTEMPTS}
                      AND (data->>'emailLeaseUntil' IS NULL
                        OR (data->>'emailLeaseUntil')::timestamptz <= NOW())
                    RETURNING id
                `;
            } catch (error) {
                this.logger.error('Could not claim seller reminder email for ' + auction.id, error);
                continue;
            }
            if (!claim.length) {
                try {
                    await this.alertAdminsIfExhausted(auction, notice.id, stage);
                } catch (error) {
                    this.logger.error('Could not check exhausted email reminder attempts', error);
                }
                continue;
            }

            try {
                // Do not send a stale prompt if another worker accepted or
                // declined the offer while the candidate list was loading.
                const current = await this.prisma.auction.findFirst({
                    where: { id: auction.id, status: 'ENDED', deletedAt: null,
                        winnerId: null, wonAt: null,
                        provisionalOfferBidId: auction.provisionalOfferBidId,
                        provisionalOfferedAt: { equals: auction.provisionalOfferedAt,
                            gt: new Date(Date.now() - PROVISIONAL_OFFER_VALIDITY_MS) },
                        listing: { deletedAt: null, sellerId: auction.listing.sellerId,
                            OR: [{ status: 'DRAFT' }, { status: 'ACTIVE', type: 'CLASSIFIED' }] },
                    },
                    select: { id: true },
                });
                if (!current || !await this.notifications.shouldSendEmail(auction.listing.sellerId, 'AUCTION_PROVISIONAL_REMINDER')) {
                    await this.finishEmailAttempt(notice.id, token, 'skipped', 'No longer pending or recipient opted out');
                    continue;
                }
                const [seller, bid] = await Promise.all([
                    this.prisma.user.findUnique({
                        where: { id: auction.listing.sellerId }, select: { email: true, firstName: true },
                    }),
                    this.prisma.bid.findUnique({
                        where: { id: auction.provisionalOfferBidId },
                        select: { amount: true, deletedAt: true, cancelledAt: true, archivedAt: true },
                    }),
                ]);
                if (!seller?.email || !bid || bid.deletedAt || bid.cancelledAt || bid.archivedAt) {
                    await this.finishEmailAttempt(notice.id, token, 'skipped', 'Recipient or valid provisional bid unavailable');
                    continue;
                }
                const result = await this.email.sendAuctionProvisionalOfferEmail({
                    toEmail: seller.email, sellerName: seller.firstName || 'there',
                    vehicleTitle: auction.listing.title, amount: Number(bid.amount),
                    reservePrice: Number(auction.reservePrice),
                    auctionId: auction.id, listingId: auction.listingId,
                    ended: true,
                    retailAlreadyLive: (auction.listing.type === 'CLASSIFIED'
                        && auction.listing.status === 'ACTIVE')
                        || Boolean(auction.listing.linkedListingId),
                });
                await this.finishEmailAttempt(notice.id, token, result?.id ? 'sent' : 'retryable',
                    result?.id ? '' : 'Email provider did not confirm submission');
                if (!result?.id) await this.alertAdminsIfExhausted(auction, notice.id, stage);
            } catch (error: any) {
                this.logger.error('Seller reminder email error for ' + auction.id, error);
                try {
                    await this.finishEmailAttempt(notice.id, token, 'retryable',
                        String(error?.message || error).slice(0, 300));
                    await this.alertAdminsIfExhausted(auction, notice.id, stage);
                } catch (statusError) {
                    this.logger.error('Could not save seller reminder email failure', statusError);
                }
            }
        }
    }
}
