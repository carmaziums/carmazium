import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { addDays } from 'date-fns';
import { resolveFrontendUrl } from '../core/frontend-url';

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
        const baseUrl = resolveFrontendUrl(this.config.get<string>('FRONTEND_URL'));

        // /dashboard/seller/listings is a dead redirect stub that drops query
        // params entirely, and dealers who boost from their own inventory tab
        // were being sent to the plain-seller dashboard regardless — route
        // straight to the real, role-correct inventory tab instead.
        const seller = await this.prisma.user.findUnique({ where: { id: sellerId }, select: { role: true } });
        const returnPath = seller?.role === 'DEALER' ? '/dashboard/dealer/inventory' : '/dashboard/user?tab=inventory';

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
            success_url: `${baseUrl}${returnPath}${returnPath.includes('?') ? '&' : '?'}boost=success`,
            cancel_url: `${baseUrl}${returnPath}${returnPath.includes('?') ? '&' : '?'}boost=cancelled`,
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

        if (expired.length > 0) {
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
        }

        // Some listings become featured directly at creation time or via the
        // listing-fee payment webhook (PREMIUM badge tier) rather than through
        // a FeaturedBoost row, so they're invisible to the sweep above. Catch
        // any listing whose featuredUntil has passed regardless of how it was
        // set, so isFeatured never goes stale.
        const staleListings = await this.prisma.listing.updateMany({
            where: { isFeatured: true, featuredUntil: { lt: now } },
            data: { isFeatured: false, featuredUntil: null },
        });

        return { expired: expired.length + staleListings.count };
    }
}
