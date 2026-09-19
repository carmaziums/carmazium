import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CapabilityStatus, ServiceJobStatus, ServicePaymentStatus, ServiceQuoteStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';
import { ServiceLeadsService } from './service-leads.service';

/**
 * How long a customer may leave an accepted quote unpaid before the job is
 * safely returned to the marketplace. The Stripe session is expired first;
 * if Stripe cannot confirm that it is safe to expire, the job stays locked.
 */
export const ACCEPTED_PAYMENT_TIMEOUT_MINUTES = 60;
const REOPEN_MINIMUM_HOURS = 24;

@Injectable()
export class ServicesLifecycleService {
    private readonly logger = new Logger(ServicesLifecycleService.name);

    constructor(
        private readonly services: ServicesService,
        private readonly prisma: PrismaService,
        private readonly payments: PaymentsService,
        private readonly notifications: NotificationsService,
        @Optional() private readonly leads?: ServiceLeadsService,
    ) { }

    @Cron('7 * * * *')
    async tick(): Promise<void> {
        try {
            const reopened = await this.expireUnpaidAcceptedJobs();
            const expired = await this.services.expireOpenJobs();
            const expiredLeads = await this.leads?.expireOldLeads() ?? 0;
            const released = await this.services.autoConfirmCompleted();
            const verification = await this.maintainCapabilityVerification();
            if (reopened || expired || expiredLeads || released || verification.expired || verification.reminded) {
                this.logger.log(
                    `Service jobs: reopened unpaid ${reopened}, expired ${expired}, expired enquiries ${expiredLeads}, auto-confirmed ${released}; provider verification: expired ${verification.expired}, reminders ${verification.reminded}`,
                );
            }
        } catch (e: any) {
            this.logger.error(`Lifecycle tick failed: ${e?.message}`);
        }
    }

    async maintainCapabilityVerification(): Promise<{ expired: number; reminded: number }> {
        const now = new Date();
        const sevenDays = new Date(now.getTime() + 7 * 86_400_000);
        const thirtyDays = new Date(now.getTime() + 30 * 86_400_000);

        const capabilities = await this.prisma.contractorCapability.findMany({
            where: {
                status: CapabilityStatus.APPROVED,
                verificationStatus: 'VERIFIED',
                verificationExpiresAt: { not: null, lte: thirtyDays },
            },
            include: {
                contractor: {
                    select: {
                        user: { select: { id: true } },
                    },
                },
            },
        });

        let expired = 0;
        let reminded = 0;

        for (const capability of capabilities) {
            const expiresAt = capability.verificationExpiresAt;
            if (!expiresAt) continue;

            if (expiresAt <= now) {
                const result = await this.prisma.contractorCapability.updateMany({
                    where: {
                        id: capability.id,
                        status: CapabilityStatus.APPROVED,
                        verificationStatus: 'VERIFIED',
                        verificationExpiresAt: { lte: now },
                    },
                    data: {
                        status: CapabilityStatus.PENDING,
                        appliedAt: now,
                        verificationStatus: 'REVERIFICATION_REQUIRED',
                        verificationCompletedAt: null,
                        verificationReminder30SentAt: null,
                        verificationReminder7SentAt: null,
                        reviewNote: 'Provider verification expired. Upload current evidence for re-verification.',
                    },
                });
                if (result.count === 1) {
                    expired++;
                    await this.notifications.create({
                        userId: capability.contractor.user.id,
                        type: 'SERVICE_CAPABILITY_REVERIFICATION_REQUIRED',
                        title: 'Provider re-verification required',
                        message: 'Your CarMazium service-provider verification has expired. Upload current evidence before taking new TradeXchange work.',
                        link: `/dashboard/service/capabilities/${capability.id}/verification`,
                        entityType: 'ContractorCapability',
                        entityId: capability.id,
                        actionType: 'REVERIFICATION_REQUIRED',
                    }).catch(() => null);
                }
                continue;
            }

            if (expiresAt <= sevenDays && !capability.verificationReminder7SentAt) {
                const result = await this.prisma.contractorCapability.updateMany({
                    where: {
                        id: capability.id,
                        status: CapabilityStatus.APPROVED,
                        verificationStatus: 'VERIFIED',
                        verificationReminder7SentAt: null,
                    },
                    data: {
                        verificationReminder7SentAt: now,
                        verificationReminder30SentAt: capability.verificationReminder30SentAt ?? now,
                    },
                });
                if (result.count === 1) {
                    reminded++;
                    await this.notifications.create({
                        userId: capability.contractor.user.id,
                        type: 'SERVICE_CAPABILITY_VERIFICATION_EXPIRING',
                        title: 'Provider verification expires in 7 days',
                        message: 'Upload renewed verification evidence now to avoid losing access to new TradeXchange work.',
                        link: `/dashboard/service/capabilities/${capability.id}/verification`,
                        entityType: 'ContractorCapability',
                        entityId: capability.id,
                        actionType: 'VERIFICATION_EXPIRING_7_DAYS',
                    }).catch(() => null);
                }
                continue;
            }

            if (expiresAt <= thirtyDays && !capability.verificationReminder30SentAt) {
                const result = await this.prisma.contractorCapability.updateMany({
                    where: {
                        id: capability.id,
                        status: CapabilityStatus.APPROVED,
                        verificationStatus: 'VERIFIED',
                        verificationReminder30SentAt: null,
                    },
                    data: { verificationReminder30SentAt: now },
                });
                if (result.count === 1) {
                    reminded++;
                    await this.notifications.create({
                        userId: capability.contractor.user.id,
                        type: 'SERVICE_CAPABILITY_VERIFICATION_EXPIRING',
                        title: 'Provider verification expires in 30 days',
                        message: 'Review your verification evidence and upload any renewed documents before expiry.',
                        link: `/dashboard/service/capabilities/${capability.id}/verification`,
                        entityType: 'ContractorCapability',
                        entityId: capability.id,
                        actionType: 'VERIFICATION_EXPIRING_30_DAYS',
                    }).catch(() => null);
                }
            }
        }

        return { expired, reminded };
    }

    /**
     * Reopen ACCEPTED jobs whose customer abandoned Checkout.
     *
     * Safety rules:
     * - if Stripe says the session was paid, finish the normal paid transition;
     * - if the session is still open, expire it before touching the database;
     * - if Stripe cannot be reached or the session cannot be safely resolved,
     *   leave the job untouched for the next lifecycle tick;
     * - once safe, delete the unused pending payment row so a later quote can
     *   create a fresh payment without violating the one-payment-per-job key.
     */
    async expireUnpaidAcceptedJobs(): Promise<number> {
        const cutoff = new Date(Date.now() - ACCEPTED_PAYMENT_TIMEOUT_MINUTES * 60_000);
        const candidates = await this.prisma.servicePayment.findMany({
            where: {
                status: ServicePaymentStatus.PENDING,
                job: {
                    status: ServiceJobStatus.ACCEPTED,
                    acceptedAt: { lt: cutoff },
                },
            },
            include: { job: true },
        });

        if (candidates.length === 0) return 0;

        const stripe = await this.payments.getStripeClient();
        let reopened = 0;

        for (const payment of candidates) {
            const sessionId = payment.stripeCheckoutSessionId;

            if (sessionId) {
                try {
                    const session = await stripe.checkout.sessions.retrieve(sessionId);
                    if (session.status === 'complete' && session.payment_status === 'paid') {
                        await this.services.markPaid(
                            payment.jobId,
                            payment.id,
                            typeof session.payment_intent === 'string' ? session.payment_intent : null,
                        );
                        continue;
                    }
                    if (session.status === 'open') {
                        await stripe.checkout.sessions.expire(sessionId);
                    }
                } catch (e: any) {
                    // Never reopen when Stripe state is uncertain: that could let
                    // a second provider be selected while the first Checkout pays.
                    this.logger.warn(
                        `Could not safely expire unpaid Checkout ${sessionId} for service job ${payment.jobId}: ${e?.message}`,
                    );
                    continue;
                }
            }

            const now = new Date();
            const minimumExpiry = new Date(now.getTime() + REOPEN_MINIMUM_HOURS * 3_600_000);
            const reopenedExpiry = payment.job.expiresAt > minimumExpiry ? payment.job.expiresAt : minimumExpiry;

            await this.prisma.$transaction([
                this.prisma.serviceJob.update({
                    where: { id: payment.jobId },
                    data: {
                        status: ServiceJobStatus.OPEN,
                        acceptedQuoteId: null,
                        contractorId: null,
                        agreedAmountPence: null,
                        platformFeeRate: null,
                        platformFeePence: null,
                        contractorAmountPence: null,
                        acceptedAt: null,
                        expiresAt: reopenedExpiry,
                    },
                }),
                this.prisma.serviceQuote.updateMany({
                    where: {
                        jobId: payment.jobId,
                        status: { in: [ServiceQuoteStatus.ACCEPTED, ServiceQuoteStatus.DECLINED] },
                        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
                    },
                    data: { status: ServiceQuoteStatus.ACTIVE },
                }),
                this.prisma.serviceQuote.updateMany({
                    where: {
                        jobId: payment.jobId,
                        status: { in: [ServiceQuoteStatus.ACCEPTED, ServiceQuoteStatus.DECLINED] },
                        validUntil: { lte: now },
                    },
                    data: { status: ServiceQuoteStatus.EXPIRED },
                }),
                this.prisma.servicePayment.delete({ where: { id: payment.id } }),
            ]);

            reopened += 1;
            await this.notifications.create({
                userId: payment.customerId,
                type: 'SERVICE_PAYMENT_EXPIRED',
                title: 'Job reopened',
                message: `Payment was not completed for "${payment.job.title}" within ${ACCEPTED_PAYMENT_TIMEOUT_MINUTES} minutes, so the job is open to quotes again.`,
                link: `/services/jobs/${payment.jobId}`,
                entityType: 'SERVICE_JOB',
                entityId: payment.jobId,
            } as any).catch((e: any) => this.logger.warn(`Reopen notification failed for ${payment.jobId}: ${e?.message}`));

            if (payment.contractorId) {
                const provider = await this.prisma.contractorProfile.findUnique({
                    where: { id: payment.contractorId },
                    select: { userId: true },
                });
                if (provider) {
                    await this.notifications.create({
                        userId: provider.userId,
                        type: 'SERVICE_PAYMENT_EXPIRED',
                        title: 'Accepted quote returned to market',
                        message: `The customer did not complete payment for "${payment.job.title}" within ${ACCEPTED_PAYMENT_TIMEOUT_MINUTES} minutes. Your quote is active again if it is still valid.`,
                        link: `/dashboard/service/jobs/${payment.jobId}`,
                        entityType: 'SERVICE_JOB',
                        entityId: payment.jobId,
                    } as any).catch((e: any) => this.logger.warn(`Provider reopen notification failed for ${payment.jobId}: ${e?.message}`));
                }
            }
        }

        return reopened;
    }
}
