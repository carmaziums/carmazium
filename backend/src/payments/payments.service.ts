import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    /**
     * Lazily create a Stripe SDK instance.
     */
    private async getStripe() {
        const Stripe = (await import('stripe')).default;
        return new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
            apiVersion: '2025-04-30.basil',
        });
    }

    /**
     * Create a Stripe Checkout Session for a vehicle purchase or deposit.
     */
    async createCheckoutSession(
        listingId: string,
        userId: string,
        amount: number,
        type: 'DEPOSIT' | 'FULL_PAYMENT' = 'FULL_PAYMENT',
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

        // Create a pending transaction record
        const transaction = await this.prisma.transaction.create({
            data: {
                listingId,
                userId,
                amount,
                type,
                status: 'PENDING',
                description: type === 'DEPOSIT'
                    ? `Refundable deposit for ${listing.title}`
                    : `Full payment for ${listing.title}`,
            },
        });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency,
                        product_data: {
                            name: listing.title,
                            description: type === 'DEPOSIT'
                                ? `Refundable deposit — secures your vehicle`
                                : `Full payment for ${listing.make || ''} ${listing.model || ''} ${listing.year || ''}`.trim(),
                            ...(listing.images?.[0] && !listing.images[0].includes('example.com')
                                ? { images: [listing.images[0]] }
                                : {}),
                        },
                        unit_amount: Math.round(amount * 100), // pence
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
     * Get the status of a Stripe Checkout Session.
     */
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
                const { transactionId, listingId, type } = session.metadata;

                await this.prisma.transaction.update({
                    where: { id: transactionId },
                    data: {
                        status: 'COMPLETED',
                        stripePaymentId: session.payment_intent ?? session.id,
                    },
                });

                // If full payment, mark listing as SOLD
                if (type === 'FULL_PAYMENT') {
                    await this.prisma.listing.update({
                        where: { id: listingId },
                        data: { status: 'SOLD' },
                    });
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
}
