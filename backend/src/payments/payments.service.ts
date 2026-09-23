import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { HpiService } from '../hpi/hpi.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { EmailService } from '../email/email.service';
import { resolveFrontendUrl } from '../core/frontend-url';
import { getListingSubmissionReadiness } from '../listings/listing-readiness';
import {
    assertDealerPermission,
    DealerPermission,
    resolveDealerActor,
} from '../dealers/dealer-access';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly hpiService: HpiService,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
        private readonly emailService: EmailService,
        private readonly moduleRef: ModuleRef,
    ) {}

    private async getListingFeeReadiness(listingId: string) {
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
            include: {
                hpiReport: { select: { id: true } },
            },
        });

        if (!listing || listing.deletedAt) {
            throw new NotFoundException('Listing not found');
        }

        const readiness = getListingSubmissionReadiness(listing, {
            hasRequiredHpi: Boolean(listing.hpiReport),
        });

        return { listing, ...readiness };
    }

    private assertListingFeeReady(
        readiness: { missingFields: string[] },
    ): void {
        if (readiness.missingFields.length > 0) {
            throw new BadRequestException(
                `Listing is not ready for payment. Missing: ${readiness.missingFields.join(', ')}.`,
            );
        }
    }

    /**
     * Standard includes the HPI report. Premium includes Standard benefits, so
     * it includes HPI as well. The HPI row is idempotent and only registers the
     * report request; an admin can prepare/attach it afterwards.
     */
    private async ensureIncludedHpiForTier(
        listingId: string,
        badgeTier: string | undefined,
        transactionId?: string,
    ): Promise<void> {
        if (badgeTier !== 'STANDARD' && badgeTier !== 'PREMIUM') return;

        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
            select: { vrm: true },
        });
        if (!listing) return;

        await this.hpiService.createPendingReport(
            listingId,
            listing.vrm || '',
            transactionId,
        );
    }

    /**
     * A Stripe success proves money was paid, not that the listing is currently
     * fit for review. Old/in-flight sessions are therefore revalidated here.
     * Payment remains COMPLETED either way; an incomplete listing stays editable
     * and publishListing() can reuse the completed fee after the seller fixes it.
     */
    private async submitPaidListingIfReady(
        listingId: string,
        badgeTier?: string,
    ): Promise<boolean> {
        const readiness = await this.getListingFeeReadiness(listingId);

        if (!readiness.ready) {
            if (badgeTier && ['BASIC', 'STANDARD', 'PREMIUM'].includes(badgeTier)) {
                await this.prisma.listing.update({
                    where: { id: listingId },
                    data: { badgeTier: badgeTier as any },
                });
            }

            this.logger.warn(
                `Paid listing ${listingId} remains out of review because submission requirements are incomplete: ${readiness.missingFields.join(', ')}`,
            );
            return false;
        }

        // Never use a delayed/stale payment event to demote or resurrect a
        // listing that has already moved beyond the editable/review lifecycle.
        if (!['DRAFT', 'REJECTED', 'PENDING_REVIEW'].includes(readiness.listing.status)) {
            this.logger.warn(
                `Ignoring listing-fee submission transition for ${listingId} because current status is ${readiness.listing.status}`,
            );
            return false;
        }

        const updateData: Record<string, unknown> = {
            status: 'PENDING_REVIEW',
            rejectionReason: null,
        };
        if (badgeTier && ['BASIC', 'STANDARD', 'PREMIUM'].includes(badgeTier)) {
            updateData.badgeTier = badgeTier;
        }

        await this.prisma.listing.update({
            where: { id: listingId },
            data: updateData as any,
        });

        if (readiness.listing.status !== 'PENDING_REVIEW') {
            this.notifyListingSubmittedForReview(listingId).catch(() => { });
        }

        return true;
    }

    /**
     * Notify a seller in-app that their listing fee payment went through and the
     * listing is now awaiting admin review. Best-effort — must never block the
     * webhook handler that triggered it.
     */
    private async notifyListingSubmittedForReview(listingId: string) {
        try {
            const listing = await this.prisma.listing.findUnique({
                where: { id: listingId },
                select: { id: true, title: true, sellerId: true },
            });
            if (!listing?.sellerId) return;
            const notification = await this.notificationsService.create({
                userId: listing.sellerId,
                type: 'LISTING_SUBMITTED',
                title: 'Listing Submitted for Review',
                message: `"${listing.title}" has been submitted and is awaiting admin review before it goes live.`,
                link: '/dashboard/seller/listings',
                entityType: 'Listing',
                entityId: listing.id,
                actionType: 'SUBMITTED',
            }).catch(() => null);
            if (notification) {
                this.notificationsGateway.sendNotification(listing.sellerId, notification);
            }
        } catch {
            // best-effort only
        }
    }

    /**
     * Notify a seller that a buyer has paid the £500 refundable deposit on
     * their listing. This used to be entirely missing — a completed DEPOSIT
     * payment only updated the Transaction row, with no reaction anywhere
     * else, so the seller had no way of knowing anyone had paid a deposit.
     */
    private async notifyDepositPaid(listingId: string, buyerId?: string) {
        try {
            const listing = await this.prisma.listing.findUnique({
                where: { id: listingId },
                select: { id: true, title: true, sellerId: true },
            });
            if (!listing?.sellerId) return;

            const buyer = buyerId
                ? await this.prisma.user.findUnique({ where: { id: buyerId }, select: { firstName: true, lastName: true } })
                : null;
            const buyerName = buyer ? `${buyer.firstName ?? ''} ${buyer.lastName ?? ''}`.trim() || 'A buyer' : 'A buyer';

            const notification = await this.notificationsService.create({
                userId: listing.sellerId,
                type: 'SYSTEM',
                title: 'Refundable deposit received',
                message: `${buyerName} has paid a £500 refundable deposit to secure "${listing.title}". Get in touch with them to arrange next steps.`,
                link: '/dashboard/seller/listings',
                entityType: 'Listing',
                entityId: listing.id,
            }).catch(() => null);
            if (notification) {
                this.notificationsGateway.sendNotification(listing.sellerId, notification);
            }
        } catch {
            // best-effort only
        }
    }

    // Prices in GBP
    private readonly HPI_REPORT_PRICE = 9.99;
    private readonly LISTING_FEES = {
        BASIC: 1.00,  // £1 one-off
        STANDARD: 10.00,
        PREMIUM: 25.00,
    };
    private readonly BOOST_PRICE = 25.00;
    // £500 refundable deposit — matches the web checkout page's DEPOSIT_AMOUNT
    // constant (src/app/checkout/page.tsx). Not listing-dependent.
    private readonly DEPOSIT_AMOUNT = 500;

    /**
     * Lazily create a Stripe SDK instance.
     */
    /**
     * Records a paid Trade Exchange service job. Lives here rather than in
     * ServicesService because ServicesModule imports PaymentsModule for the
     * Stripe client and the transfer helper; importing back the other way
     * would be a cycle. The notifications for this event are sent by
     * ServicesService.markPaid, which this delegates to via a late-bound
     * lookup so the dependency stays one-directional.
     */
    private async markServiceJobPaid(jobId: string, paymentId: string, paymentIntentId: string | null) {
        try {
            const { ServicesService } = await import('../services/services.service');
            const services = this.moduleRef.get(ServicesService, { strict: false });
            await services.markPaid(jobId, paymentId, paymentIntentId);
        } catch (e: any) {
            this.logger.error(`SERVICE_JOB webhook for job ${jobId} failed: ${e?.message}`);
            throw e; // let Stripe retry
        }
    }

    /**
     * The Stripe client, for modules that create their own Checkout sessions
     * or refunds (ServicesModule) but must not duplicate the SDK setup. The
     * webhook handling stays here; only the client is shared.
     */
    async getStripeClient() {
        return this.getStripe();
    }

    /**
     * Whether a connected account can receive CarMazium's provider transfer.
     *
     * TradeXchange uses separate charges and transfers: the customer charge is
     * created on CarMazium's platform account, so provider-side
     * `charges_enabled` is not a prerequisite. We require a submitted account,
     * payouts enabled, no currently-due verification blockers, and an active
     * transfers capability when Stripe exposes that capability on the v1
     * Account object.
     */
    private connectTransferReady(account: any): boolean {
        if (!account || account.deleted || !account.details_submitted || !account.payouts_enabled) {
            return false;
        }
        if (account.requirements?.currently_due?.length) return false;
        const transfers = account.capabilities?.transfers;
        return transfers === undefined || transfers === 'active';
    }

    /**
     * Refresh Stripe Connect payout readiness from Stripe itself.
     *
     * The database flag is only a cache: Stripe can add requirements or disable
     * payouts after onboarding. TradeXchange calls this before a provider takes
     * new paid work so a stale webhook/cache cannot create an unpayable job.
     */
    async refreshConnectAccountReadiness(accountId: string): Promise<{ ready: boolean; accountId: string }> {
        const stripe = await this.getStripe();
        const account: any = await stripe.accounts.retrieve(accountId);
        const ready = this.connectTransferReady(account);

        await this.prisma.user.updateMany({
            where: { stripeConnectAccountId: accountId },
            data: { stripeConnectOnboardingComplete: ready },
        });

        return { ready, accountId };
    }

    private async getStripe() {
        const Stripe = (await import('stripe')).default;
        return new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
            apiVersion: '2026-02-25.clover',
        });
    }

    /**
     * True when the configured secret key is a test-mode key.
     * Used to skip actions that can't work in sandbox (e.g. transfers to live-mode
     * Connect accounts) without needing a separate feature flag — automatically
     * flips back off when the live key is restored.
     */
    isStripeInTestMode(): boolean {
        const key = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
        return key.startsWith('sk_test_');
    }

    /**
     * Create a Stripe Checkout Session for a vehicle purchase or deposit.
     */
    private readonly AUCTION_BUYER_FEE = 125;
    private readonly AUCTION_SELLER_BONUS = 100;
    private readonly AUCTION_PLATFORM_FEE = 25;

    /**
     * Apply a confirmed auction buyer-fee transaction to the ended auction.
     * Idempotent so webhook delivery and explicit client reconciliation can race
     * safely without double-applying anything.
     */
    private async getPayableAuctionForWinner(listingId: string, userId: string) {
        const actor = await resolveDealerActor(this.prisma, userId);
        let buyerId = userId;

        if (actor) {
            if (!actor.isVerified) {
                throw new ForbiddenException(
                    'Your dealer account is awaiting verification. Complete KYC before paying an auction buyer fee.',
                );
            }
            assertDealerPermission(
                actor,
                'PAY_AUCTION_FEE',
                'Your dealership role does not allow auction fee payments.',
            );
            buyerId = actor.ownerUserId;
        }

        const auction = await this.prisma.auction.findFirst({
            where: { listingId, status: 'ENDED', deletedAt: null },
        });
        if (!auction?.winnerId) {
            throw new BadRequestException('This listing does not have a payable auction win');
        }
        if (auction.winnerId !== buyerId) {
            throw new ForbiddenException('Only the winning dealership can pay the buyer fee');
        }
        if (auction.buyerFeePaid) {
            throw new BadRequestException('The auction buyer fee has already been paid');
        }
        return { auction, buyerId };
    }

    private async markAuctionBuyerFeePaid(
        transactionId: string,
        listingId: string | null | undefined,
        buyerId: string | null | undefined,
    ): Promise<boolean> {
        if (!listingId || !buyerId) return false;

        const auction = await this.prisma.auction.findFirst({
            where: {
                listingId,
                status: 'ENDED',
                deletedAt: null,
                winnerId: buyerId,
            },
        });
        if (!auction) return false;

        if (!auction.buyerFeePaid || auction.buyerFeeTransactionId !== transactionId) {
            await this.prisma.auction.update({
                where: { id: auction.id },
                data: {
                    buyerFeePaid: true,
                    buyerFeeTransactionId: transactionId,
                },
            });
        }

        return true;
    }

    async createCheckoutSession(
        listingId: string,
        userId: string,
        clientAmount: number,
        type: 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION' = 'FULL_PAYMENT',
        currency = 'gbp',
    ) {
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
        });

        if (!listing || listing.deletedAt) {
            throw new NotFoundException(`Listing "${listingId}" not found`);
        }

        let transactionUserId = userId;
        if (type === 'COMMISSION') {
            const payable = await this.getPayableAuctionForWinner(listingId, userId);
            transactionUserId = payable.buyerId;
        }

        // Re-derive the real charge amount server-side instead of trusting the
        // client-supplied `clientAmount` — same fix as createPaymentSheet (F2);
        // see that method's comment for the full rationale. `clientAmount` is
        // kept only as a mismatch-detection log, never used for the actual charge.
        let amount: number;
        switch (type) {
            case 'FULL_PAYMENT':
                amount = Number(listing.price);
                break;
            case 'COMMISSION':
                amount = this.AUCTION_BUYER_FEE;
                break;
            case 'DEPOSIT':
            default:
                amount = this.DEPOSIT_AMOUNT;
                break;
        }

        if (Math.abs(amount - clientAmount) > 0.01) {
            console.warn(
                `[PaymentsService.createCheckoutSession] client-supplied amount (${clientAmount}) did not match server-derived amount (${amount}) for type=${type} listing=${listingId} user=${userId} — using the server-derived amount.`,
            );
        }

        const stripe = await this.getStripe();
        const baseUrl = resolveFrontendUrl(this.config.get<string>('FRONTEND_URL') || this.config.get<string>('NEXT_PUBLIC_BASE_URL'));

        const descriptionMap: Record<string, string> = {
            DEPOSIT: `Refundable deposit for ${listing.title}`,
            FULL_PAYMENT: `Full payment for ${listing.title}`,
            COMMISSION: `Auction buyer fee — ${listing.title} (£${this.AUCTION_SELLER_BONUS} seller bonus + £${this.AUCTION_PLATFORM_FEE} platform fee)`,
        };

        const transaction = await this.prisma.transaction.create({
            data: {
                listingId,
                userId: transactionUserId,
                amount,
                type: type as any,
                status: 'PENDING',
                description: descriptionMap[type] ?? `Payment for ${listing.title}`,
            },
        });

        const productNameMap: Record<string, string> = {
            DEPOSIT: listing.title,
            FULL_PAYMENT: listing.title,
            COMMISSION: 'Auction Buyer Fee — Carmazium',
        };

        const productDescMap: Record<string, string> = {
            DEPOSIT: 'Refundable deposit — secures your vehicle',
            FULL_PAYMENT: `Full payment for ${listing.make || ''} ${listing.model || ''} ${listing.year || ''}`.trim(),
            COMMISSION: `£${this.AUCTION_SELLER_BONUS} released to seller after handover · £${this.AUCTION_PLATFORM_FEE} Carmazium platform fee (non-refundable)`,
        };

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency,
                        product_data: {
                            name: productNameMap[type] ?? listing.title,
                            description: productDescMap[type],
                            ...(type !== 'COMMISSION' && listing.images?.[0] && !listing.images[0].includes('example.com')
                                ? { images: [listing.images[0]] }
                                : {}),
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                transactionId: transaction.id,
                listingId,
                userId: transactionUserId,
                ...(transactionUserId !== userId ? { actorUserId: userId } : {}),
                type,
            },
            success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/checkout/cancel?listing_id=${listingId}&type=${type}`,
        });

        // Store Stripe session ID for reconciliation
        await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { stripePaymentId: session.id },
        });

        return {
            url: session.url,
            sessionId: session.id,
            transactionId: transaction.id,
        };
    }

    /**
     * Create a Stripe Checkout Session for an HPI Report.
     */
    async createHpiSession(vrm: string, userId: string, listingId: string) {
        const stripe = await this.getStripe();
        const baseUrl = resolveFrontendUrl(this.config.get<string>('FRONTEND_URL'));

        // Create a pending transaction record
        const transaction = await this.prisma.transaction.create({
            data: {
                userId,
                listingId,
                amount: this.HPI_REPORT_PRICE,
                type: 'HPI_REPORT' as any,
                status: 'PENDING',
                description: `Comprehensive HPI Report for ${vrm}`,
            },
        });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: 'Comprehensive HPI Report',
                            description: `Full history check for vehicle ${vrm}`,
                        },
                        unit_amount: Math.round(this.HPI_REPORT_PRICE * 100),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                transactionId: transaction.id,
                userId,
                vrm,
                listingId,
                type: 'HPI_REPORT',
            },
            success_url: `${baseUrl}/sell?hpi_success=true&vrm=${vrm}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/sell?hpi_cancel=true`,
        });

        await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { stripePaymentId: session.id },
        });

        return { url: session.url };
    }

    /**
     * Create a Stripe Checkout Session for a buyer paying to have an HPI
     * report emailed to them personally. Distinct from createHpiSession
     * above (the seller's request-a-report payment) — same £9.99 price,
     * different metadata type, different return destination.
     *
     * returnPath comes from the frontend (whichever page the buyer was on —
     * buy-cars, live auction, or won auction) rather than a fixed URL like
     * the seller flow uses, since this action is available from three
     * different pages. Restricted to known-safe internal paths so it can't
     * be used as an open redirect.
     */
    async createHpiEmailSession(listingId: string, userId: string, returnPath: string) {
        const stripe = await this.getStripe();
        const baseUrl = resolveFrontendUrl(this.config.get<string>('FRONTEND_URL'));

        if (!/^\/(buy-cars|auctions)\//.test(returnPath)) {
            throw new BadRequestException('Invalid return path');
        }

        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
            select: { vrm: true },
        });
        if (!listing) throw new NotFoundException('Listing not found');

        const transaction = await this.prisma.transaction.create({
            data: {
                userId,
                listingId,
                amount: this.HPI_REPORT_PRICE,
                type: 'HPI_REPORT_EMAIL' as any,
                status: 'PENDING',
                description: `Vehicle history report emailed for ${listing.vrm || listingId}`,
            },
        });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: 'Vehicle History Report — Emailed Copy',
                            description: 'Get this vehicle’s history report sent to your email as a PDF',
                        },
                        unit_amount: Math.round(this.HPI_REPORT_PRICE * 100),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                transactionId: transaction.id,
                userId,
                listingId,
                type: 'HPI_REPORT_EMAIL',
            },
            success_url: `${baseUrl}${returnPath}?hpi_email_success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}${returnPath}?hpi_email_cancel=true`,
        });

        await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { stripePaymentId: session.id },
        });

        return { url: session.url };
    }

    private async resolveListingFeeBusinessId(
        listingSellerId: string | null | undefined,
        userId: string,
    ): Promise<string> {
        if (!listingSellerId) {
            throw new BadRequestException('Listing does not have a seller');
        }
        if (listingSellerId === userId) return userId;

        const actor = await resolveDealerActor(this.prisma, userId);
        if (!actor || actor.ownerUserId !== listingSellerId) {
            throw new ForbiddenException('You do not have permission to pay for this listing');
        }
        assertDealerPermission(
            actor,
            'PAY_LISTING_FEE',
            'Your dealership role does not allow listing fee payments.',
        );
        return actor.ownerUserId;
    }

    /**
     * Create a Stripe Checkout Session for a Listing Badge Fee.
     */
    async createListingSession(badgeTier: 'BASIC' | 'STANDARD' | 'PREMIUM', userId: string, listingId: string) {
        // Never trust the browser to decide whether a retail listing is free or
        // which paid tier should be charged. The persisted listing is authoritative.
        const [actor, readiness] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true },
            }),
            this.getListingFeeReadiness(listingId),
        ]);
        const { listing } = readiness;

        if (actor?.role === 'ADMIN') {
            throw new BadRequestException(
                'Admin listings are free — no listing fee is charged. Submit the listing directly.',
            );
        }
        const transactionUserId = await this.resolveListingFeeBusinessId(
            listing.sellerId,
            userId,
        );
        if (listing.type !== 'CLASSIFIED') {
            throw new BadRequestException('Auction listings do not require a retail listing fee');
        }

        this.assertListingFeeReady(readiness);

        // Heal legacy FREE retail drafts and always charge using the server-side tier.
        const persistedTier =
            listing.badgeTier === 'FREE' ? 'BASIC' : listing.badgeTier;
        if (!(persistedTier in this.LISTING_FEES)) {
            throw new BadRequestException('Retail listing tier must be BASIC, STANDARD, or PREMIUM');
        }
        const chargeTier = persistedTier as 'BASIC' | 'STANDARD' | 'PREMIUM';

        if (listing.badgeTier !== chargeTier) {
            await this.prisma.listing.update({
                where: { id: listingId },
                data: { badgeTier: chargeTier },
            });
        }
        if (badgeTier !== chargeTier) {
            this.logger.warn(
                `Listing checkout tier mismatch for ${listingId}: client=${badgeTier}, persisted=${chargeTier}; charging persisted tier.`,
            );
        }

        const stripe = await this.getStripe();
        const baseUrl = resolveFrontendUrl(this.config.get<string>('FRONTEND_URL'));
        const amount = this.LISTING_FEES[chargeTier];

        // Create a pending transaction record
        const transaction = await this.prisma.transaction.create({
            data: {
                userId: transactionUserId,
                listingId,
                amount,
                type: 'LISTING_FEE' as any,
                status: 'PENDING',
                description: `${chargeTier} Listing Fee`,
            },
        });

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: `CarMazium ${chargeTier} Listing`,
                            description: `Professional listing fee for your vehicle`,
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                transactionId: transaction.id,
                userId: transactionUserId,
                ...(transactionUserId !== userId ? { actorUserId: userId } : {}),
                listingId,
                badgeTier: chargeTier,
                type: 'LISTING_FEE',
            },
            success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/dashboard/user?tab=inventory`,
        });

        await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { stripePaymentId: session.id },
        });

        return { url: session.url };
    }
    /**
     * Create a Stripe PaymentIntent + EphemeralKey for the React Native Payment Sheet.
     * Returns clientSecret, ephemeralKey, customerId, and a transactionId for tracking.
     */
    async createPaymentSheet(
        listingId: string,
        userId: string,
        clientAmount: number,
        type: 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION' | 'LISTING_FEE' | 'HPI_REPORT' | 'HPI_REPORT_EMAIL' = 'FULL_PAYMENT',
        currency = 'gbp',
        badgeTier?: 'BASIC' | 'STANDARD' | 'PREMIUM',
        vrm?: string,
    ) {
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
        });
        if (!listing || listing.deletedAt) {
            throw new NotFoundException(`Listing "${listingId}" not found`);
        }

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        let transactionUserId = userId;
        if (type === 'COMMISSION') {
            const payable = await this.getPayableAuctionForWinner(listingId, userId);
            transactionUserId = payable.buyerId;
        }

        // Re-derive the real charge amount server-side instead of trusting the
        // client-supplied `clientAmount` — without this, a modified client could
        // request a Payment Sheet for an arbitrary (e.g. £1) amount against a real
        // listing/auction and only ever be charged that. `clientAmount` is kept
        // only as a mismatch-detection log, never used to set the actual charge.
        let amount: number;
        switch (type) {
            case 'FULL_PAYMENT':
                amount = Number(listing.price);
                break;
            case 'LISTING_FEE': {
                transactionUserId = await this.resolveListingFeeBusinessId(
                    listing.sellerId,
                    userId,
                );
                if (listing.type !== 'CLASSIFIED') {
                    throw new BadRequestException('Auction listings do not require a retail listing fee');
                }

                const listingFeeReadiness = await this.getListingFeeReadiness(listingId);
                this.assertListingFeeReady(listingFeeReadiness);

                // Mobile Payment Sheet follows the same server-authoritative rule
                // as hosted Checkout: the saved listing tier determines the charge.
                // Heal any legacy FREE retail draft to BASIC (£1).
                const persistedTier = listing.badgeTier === 'FREE' ? 'BASIC' : listing.badgeTier;
                if (!(persistedTier in this.LISTING_FEES)) {
                    throw new BadRequestException('Retail listing tier must be BASIC, STANDARD, or PREMIUM');
                }
                badgeTier = persistedTier as 'BASIC' | 'STANDARD' | 'PREMIUM';
                if (listing.badgeTier !== badgeTier) {
                    await this.prisma.listing.update({
                        where: { id: listingId },
                        data: { badgeTier },
                    });
                }
                amount = this.LISTING_FEES[badgeTier];
                break;
            }
            case 'COMMISSION':
                amount = this.AUCTION_BUYER_FEE;
                break;
            case 'HPI_REPORT':
                if (!vrm) {
                    throw new BadRequestException('vrm is required for a HPI_REPORT payment.');
                }
                amount = this.HPI_REPORT_PRICE;
                break;
            case 'DEPOSIT':
            default:
                amount = this.DEPOSIT_AMOUNT;
                break;
        }

        if (Math.abs(amount - clientAmount) > 0.01) {
            console.warn(
                `[PaymentsService.createPaymentSheet] client-supplied amount (${clientAmount}) did not match server-derived amount (${amount}) for type=${type} badgeTier=${badgeTier ?? 'n/a'} listing=${listingId} user=${userId} — using the server-derived amount.`,
            );
        }

        const stripe = await this.getStripe();

        // Get or create Stripe Customer for this user
        let customerId = user.stripeCustomerId ?? null;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
                metadata: { userId },
            });
            customerId = customer.id;
            await this.prisma.user.update({
                where: { id: userId },
                data: { stripeCustomerId: customerId },
            });
        }

        // Create Ephemeral Key (required for Payment Sheet saved cards)
        const ephemeralKey = await stripe.ephemeralKeys.create(
            { customer: customerId },
            { apiVersion: '2026-02-25.clover' },
        );

        const descriptionMap: Record<string, string> = {
            DEPOSIT: `Refundable deposit for ${listing.title}`,
            FULL_PAYMENT: `Full payment for ${listing.title}`,
            COMMISSION: `Auction buyer fee — ${listing.title}`,
            LISTING_FEE: `${badgeTier ?? ''} Listing Fee — ${listing.title}`.trim(),
            HPI_REPORT: `Comprehensive HPI Report for ${vrm}`,
        };

        // Create a pending transaction record first (we'll store the PI id after)
        const transaction = await this.prisma.transaction.create({
            data: {
                listingId,
                userId: transactionUserId,
                amount,
                type: type as any,
                status: 'PENDING',
                description: descriptionMap[type] ?? `Payment for ${listing.title}`,
            },
        });

        // Create Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency,
            customer: customerId,
            automatic_payment_methods: { enabled: true },
            metadata: {
                transactionId: transaction.id,
                listingId,
                userId: transactionUserId,
                ...(transactionUserId !== userId ? { actorUserId: userId } : {}),
                type,
                // Only present for LISTING_FEE — the payment_intent.succeeded webhook
                // handler needs this to know which tier to activate the listing at.
                ...(badgeTier ? { badgeTier } : {}),
                // Only present for HPI_REPORT — the webhook needs this to know
                // which VRM to run the check against.
                ...(vrm ? { vrm } : {}),
            },
        });

        // Store Payment Intent ID for reconciliation
        await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { stripePaymentId: paymentIntent.id },
        });

        return {
            clientSecret: paymentIntent.client_secret,
            ephemeralKey: ephemeralKey.secret,
            customerId,
            transactionId: transaction.id,
            publishableKey: this.config.get<string>('STRIPE_PUBLISHABLE_KEY') ?? '',
        };
    }

    private async assertPaymentActorAccess(
        canonicalUserId: string | null | undefined,
        userId: string,
        permission?: DealerPermission,
    ): Promise<void> {
        if (!canonicalUserId) {
            throw new ForbiddenException('Payment session ownership could not be verified');
        }
        if (canonicalUserId === userId) return;

        if (!permission) {
            throw new ForbiddenException('You do not have permission to access this payment session');
        }

        const actor = await resolveDealerActor(this.prisma, userId);
        if (
            !actor
            || actor.ownerUserId !== canonicalUserId
            || !actor.isVerified
        ) {
            throw new ForbiddenException('You do not have permission to access this payment session');
        }

        assertDealerPermission(
            actor,
            permission,
            'Your dealership role does not allow this payment action.',
        );
    }

    private checkoutSessionPermission(session: any): DealerPermission | undefined {
        const metadata = session?.metadata ?? {};
        if (metadata.type === 'COMMISSION') return 'PAY_AUCTION_FEE';
        if (metadata.type === 'LISTING_FEE') return 'PAY_LISTING_FEE';
        if (metadata.type === 'KYC_VERIFICATION') return 'MANAGE_KYC';
        if (metadata.boostId && metadata.sellerId) return 'MANAGE_INVENTORY';
        return undefined;
    }

    private async assertCheckoutSessionAccess(session: any, userId: string): Promise<void> {
        const metadata = session?.metadata ?? {};
        const canonicalUserId = metadata.userId || metadata.sellerId || null;
        await this.assertPaymentActorAccess(
            canonicalUserId,
            userId,
            this.checkoutSessionPermission(session),
        );
    }

    async getSessionStatus(sessionId: string, userId: string) {
        const stripe = await this.getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        await this.assertCheckoutSessionAccess(session, userId);

        return {
            status: session.status,
            paymentStatus: session.payment_status,
            customerEmail: session.customer_details?.email ?? null,
            metadata: session.metadata,
            amountTotal: session.amount_total,
            currency: session.currency,
        };
    }

    /**
     * Get payment history for a user.
     */
    async getPaymentHistory(userId: string) {
        return this.prisma.transaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                listing: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        images: true,
                        make: true,
                        model: true,
                        year: true,
                    },
                },
            },
        });
    }

    /**
     * Handle Stripe webhook events with signature verification.
     */
    async handleWebhook(rawBody: Buffer, signature: string) {
        const stripe = await this.getStripe();
        const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');

        let event: any;
        try {
            event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret!);
        } catch (err: any) {
            throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
        }

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const { transactionId, listingId, type, boostId, kycId } = session.metadata;

                // 0. Handle Dealer KYC £1 verification fee
                if (type === 'KYC_VERIFICATION' && kycId) {
                    await this.markKycFeePaid(kycId, session.payment_intent ?? session.id);
                }

                // 0b. Trade Exchange service job — the customer paid the gross.
                // Funds are held on the platform; the contractor is paid by a
                // Connect transfer when the job is confirmed complete.
                if (type === 'SERVICE_JOB' && session.metadata.jobId && session.metadata.paymentId) {
                    await this.markServiceJobPaid(
                        session.metadata.jobId,
                        session.metadata.paymentId,
                        typeof session.payment_intent === 'string' ? session.payment_intent : null,
                    );
                }

                // 1. Handle Featured Boost (from FeaturedBoostService)
                if (boostId) {
                    await this.prisma.$transaction([
                        this.prisma.featuredBoost.update({
                            where: { id: boostId },
                            data: {
                                isActive: true,
                                stripePaymentId: session.payment_intent ?? session.id,
                            },
                        }),
                        this.prisma.listing.update({
                            where: { id: listingId },
                            data: {
                                isFeatured: true,
                                featuredUntil: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
                            },
                        }),
                    ]);
                }

                // 2. Handle Transaction Record
                if (transactionId) {
                    await this.prisma.transaction.update({
                        where: { id: transactionId },
                        data: {
                            status: 'COMPLETED',
                            stripePaymentId: session.payment_intent ?? session.id,
                        },
                    });
                }

                // 3. Handle Specific Types
                if (type === 'DEPOSIT') {
                    // Previously a no-op beyond marking the Transaction COMPLETED above —
                    // the seller was never told a buyer had paid a deposit on their listing.
                    this.notifyDepositPaid(listingId, session.metadata?.userId).catch(() => {});
                }

                if (type === 'FULL_PAYMENT') {
                    const buyerId: string | undefined = session.metadata?.userId;
                    const listing = await this.prisma.listing.findUnique({
                        where: { id: listingId },
                        select: { sellerId: true, price: true },
                    });
                    await this.prisma.$transaction(async (tx) => {
                        await tx.listing.update({
                            where: { id: listingId },
                            data: { status: 'SOLD' },
                        });
                        // Create Sale record so earnings dashboard reflects this purchase
                        const alreadyRecorded = await tx.sale.findFirst({ where: { listingId } });
                        if (!alreadyRecorded && listing?.sellerId) {
                            await tx.sale.create({
                                data: {
                                    listingId,
                                    sellerId: listing.sellerId,
                                    buyerId: buyerId ?? null,
                                    soldPrice: listing.price ?? 0,
                                },
                            });
                        }
                    });
                }

                if (type === 'LISTING_FEE' && listingId) {
                    // Payment is recorded above regardless. Submission is a
                    // separate decision and must pass the same authoritative
                    // completeness gate as every other path. HPI is optional.
                    await this.submitPaidListingIfReady(
                        listingId,
                        session.metadata.badgeTier,
                    );
                    await this.ensureIncludedHpiForTier(
                        listingId,
                        session.metadata.badgeTier,
                        transactionId,
                    ).catch(err => {
                        console.error('Failed to register included HPI report after listing payment:', err);
                    });
                }

                if (type === 'HPI_REPORT') {
                    const { vrm } = session.metadata;
                    // Reports are prepared by an admin, so payment only registers
                    // the request — it no longer produces the report itself.
                    this.hpiService.createPendingReport(listingId, vrm, transactionId).catch(err => {
                        console.error('Failed to register HPI report request after payment:', err);
                    });
                }

                if (type === 'HPI_REPORT_EMAIL') {
                    const buyerId: string | undefined = session.metadata?.userId;
                    if (buyerId) {
                        // Delivers immediately if the report's already done, or
                        // queues delivery for when an admin finishes it.
                        this.hpiService.requestEmailDelivery(listingId, buyerId, transactionId).catch(err => {
                            console.error('Failed to register HPI report email delivery after payment:', err);
                        });
                    }
                }

                // Auction buyer fee paid — mark auction and record transaction ID.
                // Shared with native PaymentIntent reconciliation so the two
                // clients cannot drift on the post-payment side effect.
                if (type === 'COMMISSION' && transactionId) {
                    await this.markAuctionBuyerFeePaid(transactionId, listingId, session.metadata?.userId);
                }
                break;
            }

            // ── Payment Sheet (native SDK) ──────────────────────────
            case 'payment_intent.succeeded': {
                const pi = event.data.object;
                const { transactionId, listingId, type, badgeTier, vrm } = pi.metadata ?? {};

                if (transactionId) {
                    await this.prisma.transaction.update({
                        where: { id: transactionId },
                        data: {
                            status: 'COMPLETED',
                            stripePaymentId: pi.id,
                        },
                    });
                }

                if (type === 'LISTING_FEE' && listingId) {
                    await this.submitPaidListingIfReady(listingId, badgeTier);
                    await this.ensureIncludedHpiForTier(
                        listingId,
                        badgeTier,
                        transactionId,
                    ).catch(err => {
                        console.error('Failed to register included HPI report after Payment Sheet listing payment:', err);
                    });
                }

                if (type === 'DEPOSIT' && listingId) {
                    this.notifyDepositPaid(listingId, pi.metadata?.userId).catch(() => {});
                }

                if (type === 'FULL_PAYMENT' && listingId) {
                    const buyerId: string | undefined = pi.metadata?.userId;
                    const listing = await this.prisma.listing.findUnique({
                        where: { id: listingId },
                        select: { sellerId: true, price: true },
                    });
                    await this.prisma.$transaction(async (tx) => {
                        await tx.listing.update({
                            where: { id: listingId },
                            data: { status: 'SOLD' },
                        });
                        const alreadyRecorded = await tx.sale.findFirst({ where: { listingId } });
                        if (!alreadyRecorded && listing?.sellerId) {
                            await tx.sale.create({
                                data: {
                                    listingId,
                                    sellerId: listing.sellerId,
                                    buyerId: buyerId ?? null,
                                    soldPrice: listing.price ?? 0,
                                },
                            });
                        }
                    });
                }

                if (type === 'COMMISSION' && transactionId) {
                    await this.markAuctionBuyerFeePaid(transactionId, listingId, pi.metadata?.userId);
                }

                if (type === 'HPI_REPORT' && listingId) {
                    this.hpiService.createPendingReport(listingId, vrm, transactionId).catch(err => {
                        console.error('Failed to register HPI report request after Payment Sheet payment:', err);
                    });
                }

                if (type === 'HPI_REPORT_EMAIL' && listingId) {
                    const buyerId: string | undefined = pi.metadata?.userId;
                    if (buyerId) {
                        this.hpiService.requestEmailDelivery(listingId, buyerId, transactionId).catch(err => {
                            console.error('Failed to register HPI report email delivery after Payment Sheet payment:', err);
                        });
                    }
                }
                break;
            }

            case 'checkout.session.expired': {
                const session = event.data.object;
                const { transactionId } = session.metadata ?? {};
                if (transactionId) {
                    await this.prisma.transaction.update({
                        where: { id: transactionId },
                        data: { status: 'FAILED' },
                    });
                }
                break;
            }

            // Mark seller's Connect onboarding complete as soon as Stripe confirms it.
            // This fires when the seller finishes Stripe's hosted onboarding flow,
            // covering the case where they close the tab before our return_url fires.
            case 'account.updated': {
                const account = event.data.object as any;
                const isComplete = this.connectTransferReady(account);
                // Update in both directions — Stripe can re-add requirements after the fact.
                await this.prisma.user.updateMany({
                    where: { stripeConnectAccountId: account.id },
                    data: { stripeConnectOnboardingComplete: isComplete },
                });
                break;
            }
        }

        return { received: true };
    }

    /**
     * Mark a dealer's £1 KYC verification fee as paid and notify admins.
     * Called from the webhook (primary path) and applyKycFee (fallback path) — both
     * routes converge here so the side effects only ever fire once per dealer.
     */
    private async markKycFeePaid(kycId: string, stripePaymentId: string) {
        const kyc = await this.prisma.dealerKyc.findUnique({
            where: { id: kycId },
            include: { dealerProfile: true },
        });
        if (!kyc || (kyc as any).stripeChargedAt) return; // already healed or unknown record

        const existingStatuses = (kyc.documentStatuses as Record<string, any>) || {};
        await this.prisma.dealerKyc.update({
            where: { id: kycId },
            data: {
                stripeChargedAt: new Date(),
                stripePaymentIntentId: stripePaymentId,
                documentStatuses: {
                    ...existingStatuses,
                    paymentReference: { status: 'APPROVED', note: 'Stripe verified' },
                    paymentScreenshot: { status: 'APPROVED', note: 'Stripe verified' },
                },
            } as any,
        });

        const companyName = kyc.dealerProfile?.companyName ?? 'A dealer';

        // Combined "submitted + fee paid" alert — this is the first point where the
        // submission is actually actionable for admin review.
        const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, email: true } });
        await Promise.all(
            admins.map((admin) =>
                this.notificationsService.create({
                    userId: admin.id,
                    type: 'SYSTEM',
                    title: 'Dealer KYC Submitted — £1 Verification Paid',
                    message: `${companyName} has paid the £1 KYC verification fee and is ready for review.`,
                    data: { kycId, stripePaymentId, companyName },
                    link: '/admin/kyc',
                }).catch(() => {}),
            ),
        );
        const adminEmails = admins.map((a) => a.email).filter(Boolean);
        if (adminEmails.length > 0) {
            await this.emailService.sendKycSubmissionAdminAlert(adminEmails, companyName).catch(() => {});
        }
    }

    /**
     * Webhook fallback for the £1 dealer KYC verification fee.
     * Called from the success page in case the webhook was delayed or missed.
     */
    async applyKycFee(sessionId: string, userId: string): Promise<{ applied: boolean }> {
        const kyc = await this.prisma.dealerKyc.findFirst({
            where: { stripeCheckoutSessionId: sessionId } as any,
        });
        if (!kyc) return { applied: false };

        const stripe = await this.getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        await this.assertCheckoutSessionAccess(session, userId);

        if ((kyc as any).stripeChargedAt) return { applied: true };
        if (session.payment_status !== 'paid') return { applied: false };

        await this.markKycFeePaid(kyc.id, (session.payment_intent as string) ?? session.id);
        return { applied: true };
    }

    /**
     * Webhook fallback for the auction buyer fee (£125 COMMISSION).
     * Called from the success page in case the webhook was delayed or missed.
     * Verifies the Stripe session and marks buyerFeePaid if confirmed paid.
     */
    async applyAuctionFee(sessionId: string, userId: string): Promise<{ applied: boolean }> {
        const transaction = await this.prisma.transaction.findFirst({
            where: { stripePaymentId: sessionId, type: 'COMMISSION' as any },
        });
        if (!transaction) return { applied: false };
        await this.assertPaymentActorAccess(
            transaction.userId,
            userId,
            'PAY_AUCTION_FEE',
        );

        if (transaction.status !== 'COMPLETED') {
            const stripe = await this.getStripe();
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.payment_status !== 'paid') return { applied: false };

            await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: 'COMPLETED' },
            });
        }

        const applied = await this.markAuctionBuyerFeePaid(
            transaction.id,
            transaction.listingId,
            transaction.userId,
        );
        return { applied };
    }

    /**
     * Native Payment Sheet equivalent of applyAuctionFee().
     *
     * React Native receives a successful PaymentSheet result before our Stripe
     * webhook is guaranteed to have reached Fly. Reconcile the exact
     * PaymentIntent created for this user/transaction before mobile is allowed
     * to show the auction fee as confirmed.
     */
    async reconcileAuctionFeeIntent(
        transactionId: string,
        userId: string,
    ): Promise<{ applied: boolean; status: string }> {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id: transactionId },
        });
        if (!transaction) {
            throw new NotFoundException('Payment transaction not found');
        }
        if (transaction.userId !== userId) {
            const actor = await resolveDealerActor(this.prisma, userId);
            if (
                !actor
                || actor.ownerUserId !== transaction.userId
                || !actor.isVerified
            ) {
                throw new ForbiddenException('You do not have permission to reconcile this payment');
            }
            assertDealerPermission(
                actor,
                'PAY_AUCTION_FEE',
                'Your dealership role does not allow auction fee payments.',
            );
        }
        if (transaction.type !== ('COMMISSION' as any)) {
            throw new BadRequestException('Transaction is not an auction buyer fee');
        }
        if (!transaction.stripePaymentId?.startsWith('pi_')) {
            throw new BadRequestException('Transaction does not reference a native PaymentIntent');
        }

        const stripe = await this.getStripe();
        const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripePaymentId);
        const metadata = paymentIntent.metadata ?? {};

        if (
            metadata.transactionId !== transaction.id ||
            metadata.userId !== transaction.userId ||
            metadata.listingId !== transaction.listingId ||
            metadata.type !== 'COMMISSION'
        ) {
            throw new BadRequestException('PaymentIntent metadata does not match this auction fee');
        }

        if (paymentIntent.status !== 'succeeded') {
            return { applied: false, status: paymentIntent.status };
        }

        if (transaction.status !== 'COMPLETED') {
            await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    status: 'COMPLETED',
                    stripePaymentId: paymentIntent.id,
                },
            });
        }

        const applied = await this.markAuctionBuyerFeePaid(
            transaction.id,
            transaction.listingId,
            transaction.userId,
        );
        return { applied, status: paymentIntent.status };
    }

    /**
     * Webhook fallback for the HPI report fee (£9.99).
     * Called from the /sell page in case the webhook was delayed or missed —
     * without this, ListingWizard.tsx only ever trusted the bare `hpi_success`
     * URL flag with no server-side confirmation, so a delayed/dropped webhook
     * meant the customer paid but the report was never actually generated.
     */
    async applyHpiFee(sessionId: string, userId: string): Promise<{ applied: boolean }> {
        const transaction = await this.prisma.transaction.findFirst({
            where: { stripePaymentId: sessionId, type: 'HPI_REPORT' as any },
        });
        if (!transaction) return { applied: false };
        await this.assertPaymentActorAccess(transaction.userId, userId);

        // Already completed with a report on file — nothing left to do.
        if (transaction.status === 'COMPLETED' && transaction.listingId) {
            const existing = await this.prisma.hpiReport.findUnique({ where: { listingId: transaction.listingId } });
            if (existing) return { applied: true };
        }

        const stripe = await this.getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') return { applied: false };

        await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'COMPLETED' },
        });

        const vrm = session.metadata?.vrm;
        if (!transaction.listingId || !vrm) return { applied: false };

        try {
            // Idempotent — safe even if the webhook already registered this request.
            await this.hpiService.createPendingReport(transaction.listingId, vrm, transaction.id);
        } catch (err) {
            console.error('Failed to register HPI report request in applyHpiFee fallback:', err);
            return { applied: false };
        }
        return { applied: true };
    }

    /**
     * Webhook fallback for a buyer's "email me this report" fee — same
     * reasoning as applyHpiFee above, mirrored for the buyer-side flow.
     */
    async applyHpiEmailFee(sessionId: string, userId: string): Promise<{ applied: boolean }> {
        const transaction = await this.prisma.transaction.findFirst({
            where: { stripePaymentId: sessionId, type: 'HPI_REPORT_EMAIL' as any },
        });
        if (!transaction) return { applied: false };
        await this.assertPaymentActorAccess(transaction.userId, userId);

        if (transaction.status === 'COMPLETED') {
            // Already registered — requestEmailDelivery is itself idempotent
            // on transactionId, but skip the Stripe round-trip when we can.
            const already = await this.prisma.hpiReportEmailRequest.findFirst({ where: { transactionId: transaction.id } });
            if (already) return { applied: true };
        }

        const stripe = await this.getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') return { applied: false };

        await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'COMPLETED' },
        });

        const buyerId = session.metadata?.userId;
        if (!transaction.listingId || !buyerId) return { applied: false };

        try {
            await this.hpiService.requestEmailDelivery(transaction.listingId, buyerId, transaction.id);
        } catch (err) {
            console.error('Failed to register HPI report email delivery in applyHpiEmailFee fallback:', err);
            return { applied: false };
        }
        return { applied: true };
    }

    /**
     * Issue a partial Stripe refund of £100 to the auction buyer (platform keeps £25).
     * Called by admin when denying a handover proof.
     */
    async issueRefundForAuction(auctionId: string): Promise<void> {
        const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
        if (!auction?.buyerFeeTransactionId) return;

        const transaction = await this.prisma.transaction.findUnique({
            where: { id: auction.buyerFeeTransactionId },
        });
        if (!transaction?.stripePaymentId) return;

        const stripe = await this.getStripe();

        // Web stores a Checkout Session id (cs_...) while native Payment Sheet
        // stores the PaymentIntent id (pi_...) directly. Refund the same buyer
        // fee regardless of which client collected it.
        let paymentIntentId: string | null = null;
        if (transaction.stripePaymentId.startsWith('pi_')) {
            paymentIntentId = transaction.stripePaymentId;
        } else {
            const session = await stripe.checkout.sessions.retrieve(transaction.stripePaymentId);
            paymentIntentId =
                typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.payment_intent?.id ?? null;
        }

        if (!paymentIntentId) {
            throw new BadRequestException('Buyer fee payment could not be resolved for refund');
        }

        await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: 10000, // £100 in pence — platform keeps the £25 fee
        });

        await this.prisma.transaction.update({
            where: { id: auction.buyerFeeTransactionId },
            data: { status: 'REFUNDED' as any },
        });
    }

    /**
     * Full £125 buyer-fee refund after a completed purchase-linked inspection
     * records FAULTS_FOUND. The idempotency key makes a retry safe if Stripe
     * succeeds but the subsequent auction-state transaction has to be retried.
     */
    async issueFullRefundForAuctionInspection(auctionId: string): Promise<void> {
        const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
        if (!auction?.buyerFeeTransactionId) {
            throw new BadRequestException('No paid auction buyer fee is recorded');
        }

        const transaction = await this.prisma.transaction.findUnique({
            where: { id: auction.buyerFeeTransactionId },
        });
        if (!transaction?.stripePaymentId) {
            throw new BadRequestException('Buyer fee payment reference is missing');
        }

        const stripe = await this.getStripe();
        let paymentIntentId: string | null = null;
        if (transaction.stripePaymentId.startsWith('pi_')) {
            paymentIntentId = transaction.stripePaymentId;
        } else {
            const session = await stripe.checkout.sessions.retrieve(transaction.stripePaymentId);
            paymentIntentId =
                typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.payment_intent?.id ?? null;
        }

        if (!paymentIntentId) {
            throw new BadRequestException('Buyer fee payment could not be resolved for refund');
        }

        // A handover-proof denial may already have refunded £100 of this same
        // £125 fee. Inspection refusal promises a *full* buyer-fee refund, so
        // reconcile existing Stripe refunds and top up only the remainder.
        const existingRefunds = await stripe.refunds.list({
            payment_intent: paymentIntentId,
            limit: 100,
        });
        const alreadyRefunded = existingRefunds.data
            .filter((refund: any) => refund.status !== 'failed' && refund.status !== 'canceled')
            .reduce((sum: number, refund: any) => sum + Number(refund.amount || 0), 0);
        const remainingPence = Math.max(0, 12500 - alreadyRefunded);

        if (remainingPence > 0) {
            await stripe.refunds.create(
                {
                    payment_intent: paymentIntentId,
                    amount: remainingPence,
                },
                {
                    idempotencyKey: `auction-inspection-refusal-${transaction.id}-${remainingPence}`,
                },
            );
        }

        if (transaction.status !== ('REFUNDED' as any)) {
            await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: 'REFUNDED' as any },
            });
        }
    }

    /**
     * Transfer the seller payout (£100) to their connected Stripe Express account.
     * Called by AdminService after superadmin approves handover proof.
     */
    async issueSellerPayout(
        stripeConnectAccountId: string,
        amountPence = 10000,
        idempotencyKey?: string,
    ): Promise<string> {
        const stripe = await this.getStripe();
        const transfer = await stripe.transfers.create(
            {
                amount: amountPence,
                currency: 'gbp',
                destination: stripeConnectAccountId,
            },
            idempotencyKey ? { idempotencyKey } : undefined,
        );
        return transfer.id;
    }
}
