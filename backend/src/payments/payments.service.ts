import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { HpiService } from '../hpi/hpi.service';

@Injectable()
export class PaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly hpiService: HpiService,
    ) {}

    // Prices in GBP
    private readonly HPI_REPORT_PRICE = 9.99;
    private readonly LISTING_FEES = {
        BASIC: 1.00,  // £1 one-off
        STANDARD: 10.00,
        PREMIUM: 25.00,
    };
    private readonly BOOST_PRICE = 25.00;

    /**
     * Lazily create a Stripe SDK instance.
     */
    private async getStripe() {
        const Stripe = (await import('stripe')).default;
        return new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
            apiVersion: '2026-02-25.clover',
        });
    }

    /**
     * Create a Stripe Checkout Session for a vehicle purchase or deposit.
     */
    private readonly AUCTION_BUYER_FEE = 125;
    private readonly AUCTION_SELLER_BONUS = 100;
    private readonly AUCTION_PLATFORM_FEE = 25;

    async createCheckoutSession(
        listingId: string,
        userId: string,
        amount: number,
        type: 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION' = 'FULL_PAYMENT',
        currency = 'gbp',
    ) {
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
        });

        if (!listing || listing.deletedAt) {
            throw new NotFoundException(`Listing "${listingId}" not found`);
        }

        const stripe = await this.getStripe();
        const baseUrl = this.config.get<string>('FRONTEND_URL') || this.config.get<string>('NEXT_PUBLIC_BASE_URL') || 'http://localhost:3000';

        const descriptionMap: Record<string, string> = {
            DEPOSIT: `Refundable deposit for ${listing.title}`,
            FULL_PAYMENT: `Full payment for ${listing.title}`,
            COMMISSION: `Auction buyer fee — ${listing.title} (£${this.AUCTION_SELLER_BONUS} seller bonus + £${this.AUCTION_PLATFORM_FEE} platform fee)`,
        };

        const transaction = await this.prisma.transaction.create({
            data: {
                listingId,
                userId,
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
                userId,
                type,
            },
            success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/checkout/cancel?listing_id=${listingId}`,
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
        const baseUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

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
     * Create a Stripe Checkout Session for a Listing Badge Fee.
     */
    async createListingSession(badgeTier: 'BASIC' | 'STANDARD' | 'PREMIUM', userId: string, listingId: string) {
        const stripe = await this.getStripe();
        const baseUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
        const amount = this.LISTING_FEES[badgeTier];

        // Create a pending transaction record
        const transaction = await this.prisma.transaction.create({
            data: {
                userId,
                listingId,
                amount,
                type: 'LISTING_FEE' as any,
                status: 'PENDING',
                description: `${badgeTier} Listing Fee`,
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
                            name: `CarMazium ${badgeTier} Listing`,
                            description: `Professional listing fee for your vehicle`,
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                transactionId: transaction.id,
                userId,
                listingId,
                badgeTier,
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
    async getSessionStatus(sessionId: string) {
        const stripe = await this.getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        return {
            status: session.status,
            paymentStatus: session.payment_status,
            customerEmail: session.customer_details?.email ?? null,
            metadata: session.metadata,
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
                const { transactionId, listingId, type, boostId } = session.metadata;

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
                if (type === 'FULL_PAYMENT') {
                    await this.prisma.listing.update({
                        where: { id: listingId },
                        data: { status: 'SOLD' },
                    });
                }

                if (type === 'LISTING_FEE') {
                    const badgeTier = session.metadata.badgeTier;
                    const isPremium = badgeTier === 'PREMIUM';
                    
                    await this.prisma.listing.update({
                        where: { id: listingId },
                        data: { 
                            status: 'ACTIVE',
                            badgeTier,
                            isFeatured: isPremium,
                            featuredUntil: isPremium ? new Date(Date.now() + 28 * 24 * 60 * 60 * 1000) : null
                        },
                    });
                }

                if (type === 'HPI_REPORT') {
                    const { vrm } = session.metadata;
                    this.hpiService.generateAndSaveReport(listingId, vrm, transactionId).catch(err => {
                        console.error('Failed to generate HPI report after payment:', err);
                    });
                }

                // Auction buyer fee paid — mark auction and record transaction ID
                if (type === 'COMMISSION') {
                    const auction = await this.prisma.auction.findFirst({
                        where: { listingId, status: 'ENDED', deletedAt: null },
                    });
                    if (auction) {
                        await this.prisma.auction.update({
                            where: { id: auction.id },
                            data: {
                                buyerFeePaid: true,
                                buyerFeeTransactionId: transactionId,
                            },
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
        }

        return { received: true };
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
        const session = await stripe.checkout.sessions.retrieve(transaction.stripePaymentId);
        const paymentIntentId = session.payment_intent as string;

        if (paymentIntentId) {
            await stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount: 10000, // £100 in pence — platform keeps the £25 fee
            });
        }

        await this.prisma.transaction.update({
            where: { id: auction.buyerFeeTransactionId },
            data: { status: 'REFUNDED' as any },
        });
    }
}
