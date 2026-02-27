import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { addDays } from 'date-fns';

const BOOST_DURATION_DAYS = 28;
const BOOST_AMOUNT = 25.0;
const BOOST_CURRENCY = 'gbp';

@Injectable()
export class FeaturedBoostService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) { }

    private get isBypassMode(): boolean {
        return this.config.get<string>('PAYMENT_BYPASS') === 'true';
    }

    /**
     * Activate a listing boost.
     * - Bypass mode: immediately activates the boost, no payment required.
     * - Stripe mode (future): creates a Checkout Session and returns a redirect URL.
     */
    async activateBoost(listingId: string, sellerId: string) {
        // Ensure listing exists and belongs to this seller
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
        });

        if (!listing || listing.deletedAt) {
            throw new NotFoundException(`Listing "${listingId}" not found`);
        }

        if (listing.sellerId && listing.sellerId !== sellerId) {
            throw new ForbiddenException('You do not own this listing');
        }

        if (listing.status !== 'ACTIVE') {
            throw new BadRequestException('Only ACTIVE listings can be boosted');
        }

        // Check if already actively featured
        if (listing.isFeatured && listing.featuredUntil && listing.featuredUntil > new Date()) {
            throw new BadRequestException('This listing is already featured');
        }

        if (this.isBypassMode) {
            return this.activateBypass(listingId, sellerId);
        }

        // ── Stripe mode (called when PAYMENT_BYPASS=false) ──────────────────
        return this.createStripeSession(listingId, sellerId);
    }

    /**
     * Bypass mode: immediately activate the boost without any payment.
     */
    private async activateBypass(listingId: string, sellerId: string) {
        const expiresAt = addDays(new Date(), BOOST_DURATION_DAYS);

        const [boost] = await this.prisma.$transaction([
            this.prisma.featuredBoost.create({
                data: {
                    listingId,
                    sellerId,
                    amountPaid: BOOST_AMOUNT,
                    currency: BOOST_CURRENCY,
                    expiresAt,
                    isActive: true,
                    bypassed: true,
                },
            }),
            this.prisma.listing.update({
                where: { id: listingId },
                data: { isFeatured: true, featuredUntil: expiresAt },
            }),
        ]);

        return {
            bypassed: true,
            boostId: boost.id,
            expiresAt,
            message: `Listing boosted for ${BOOST_DURATION_DAYS} days (bypass mode — no payment taken)`,
        };
    }

    /**
     * Stripe mode: create a Checkout Session.
     * Called only when PAYMENT_BYPASS=false and Stripe keys are configured.
     */
    private async createStripeSession(listingId: string, sellerId: string) {
        // Dynamically import Stripe so the module loads even without the key
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
            apiVersion: '2024-11-20.acacia',
        });

        const expiresAt = addDays(new Date(), BOOST_DURATION_DAYS);
        const baseUrl = this.config.get<string>('NEXT_PUBLIC_BASE_URL') || 'http://localhost:3001';

        // Create a pending boost record first (activated by webhook)
        const boost = await this.prisma.featuredBoost.create({
            data: {
                listingId,
                sellerId,
                amountPaid: BOOST_AMOUNT,
                currency: BOOST_CURRENCY,
                expiresAt,
                isActive: false,
                bypassed: false,
            },
        });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: BOOST_CURRENCY,
                        product_data: {
                            name: '⭐ Featured Listing Boost — 4 Weeks',
                            description: 'Your listing will appear at the top of search results and in the Featured section for 28 days.',
                        },
                        unit_amount: BOOST_AMOUNT * 100, // pence
                    },
                    quantity: 1,
                },
            ],
            metadata: { boostId: boost.id, listingId, sellerId },
            success_url: `${baseUrl}/dashboard/seller/listings?boost=success`,
            cancel_url: `${baseUrl}/dashboard/seller/listings?boost=cancelled`,
        });

        // Store session ID for webhook reconciliation
        await this.prisma.featuredBoost.update({
            where: { id: boost.id },
            data: { stripeSessionId: session.id },
        });

        return { url: session.url, sessionId: session.id };
    }

    /**
     * Stripe webhook handler — activates the boost when payment completes.
     */
    async handleStripeWebhook(rawBody: Buffer, signature: string) {
        if (this.isBypassMode) {
            return { received: true, mode: 'bypass' };
        }

        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
            apiVersion: '2024-11-20.acacia',
        });

        let event: any;
        try {
            event = stripe.webhooks.constructEvent(
                rawBody,
                signature,
                this.config.get<string>('STRIPE_WEBHOOK_SECRET')!,
            );
        } catch (err: any) {
            throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const { boostId, listingId } = session.metadata;

            await this.prisma.$transaction([
                this.prisma.featuredBoost.update({
                    where: { id: boostId },
                    data: {
                        isActive: true,
                        stripePaymentId: session.payment_intent,
                    },
                }),
                this.prisma.listing.update({
                    where: { id: listingId },
                    data: {
                        isFeatured: true,
                        featuredUntil: addDays(new Date(), BOOST_DURATION_DAYS),
                    },
                }),
            ]);
        }

        return { received: true };
    }

    /**
     * Returns all boosts for the authenticated seller.
     */
    async getMyBoosts(sellerId: string) {
        return this.prisma.featuredBoost.findMany({
            where: { sellerId },
            orderBy: { createdAt: 'desc' },
            include: {
                listing: {
                    select: { id: true, title: true, slug: true, images: true, status: true },
                },
            },
        });
    }

    /**
     * Returns the active boost for a listing (if any).
     */
    async getBoostStatus(listingId: string) {
        const boost = await this.prisma.featuredBoost.findFirst({
            where: { listingId, isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        return {
            isFeatured: !!boost,
            expiresAt: boost?.expiresAt ?? null,
            daysRemaining: boost
                ? Math.max(0, Math.ceil((boost.expiresAt.getTime() - Date.now()) / 86_400_000))
                : 0,
        };
    }

    /**
     * Expires boosts whose featuredUntil has passed.
     * Called by the daily cron job.
     */
    async expireBoosts(): Promise<{ expired: number }> {
        const now = new Date();

        // Find expired active boosts
        const expired = await this.prisma.featuredBoost.findMany({
            where: { isActive: true, expiresAt: { lt: now } },
            select: { id: true, listingId: true },
        });

        if (expired.length === 0) return { expired: 0 };

        const expiredIds = expired.map((b) => b.id);
        const listingIds = [...new Set(expired.map((b) => b.listingId))];

        await this.prisma.$transaction([
            // Deactivate the boost records
            this.prisma.featuredBoost.updateMany({
                where: { id: { in: expiredIds } },
                data: { isActive: false },
            }),
            // Reset the listing fields
            this.prisma.listing.updateMany({
                where: { id: { in: listingIds } },
                data: { isFeatured: false, featuredUntil: null },
            }),
        ]);

        return { expired: expired.length };
    }
}
