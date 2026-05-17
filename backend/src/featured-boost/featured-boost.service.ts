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

    /**
     * Activate a listing boost via Stripe Checkout.
     * Returns { url } to redirect the seller to Stripe.
     */
    async activateBoost(listingId: string, sellerId: string) {
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
        });

        if (!listing || listing.deletedAt) {
            throw new NotFoundException(`Listing "${listingId}" not found`);
        }

        if (listing.sellerId && listing.sellerId !== sellerId) {
            throw new ForbiddenException('You do not own this listing');
        }

        if (listing.isFeatured && listing.featuredUntil && listing.featuredUntil > new Date()) {
            throw new BadRequestException('This listing is already featured');
        }

        return this.createStripeSession(listingId, sellerId);
    }

    private async createStripeSession(listingId: string, sellerId: string) {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
            apiVersion: '2026-02-25.clover',
        });

        const expiresAt = addDays(new Date(), BOOST_DURATION_DAYS);
        const baseUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

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
                        unit_amount: BOOST_AMOUNT * 100,
                    },
                    quantity: 1,
                },
            ],
            metadata: { boostId: boost.id, listingId, sellerId },
            success_url: `${baseUrl}/dashboard/seller/listings?boost=success`,
            cancel_url: `${baseUrl}/dashboard/seller/listings?boost=cancelled`,
        });

        await this.prisma.featuredBoost.update({
            where: { id: boost.id },
            data: { stripeSessionId: session.id },
        });

        return { url: session.url, sessionId: session.id };
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

        const expired = await this.prisma.featuredBoost.findMany({
            where: { isActive: true, expiresAt: { lt: now } },
            select: { id: true, listingId: true },
        });

        if (expired.length === 0) return { expired: 0 };

        const expiredIds = expired.map((b) => b.id);
        const listingIds = [...new Set(expired.map((b) => b.listingId))];

        await this.prisma.$transaction([
            this.prisma.featuredBoost.updateMany({
                where: { id: { in: expiredIds } },
                data: { isActive: false },
            }),
            this.prisma.listing.updateMany({
                where: { id: { in: listingIds } },
                data: { isFeatured: false, featuredUntil: null },
            }),
        ]);

        return { expired: expired.length };
    }
}
