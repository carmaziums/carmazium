import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferResponseStatus } from './dto/respond-offer.dto';
import { Offer, OfferStatus } from '@prisma/client';

@Injectable()
export class OffersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
    ) { }

    // ─── Buyer: Make an offer ────────────────────────────────────────────────

    /**
     * Create a new offer on a listing.
     * Validates that the offer amount falls within the listing's priceMin–priceMax range.
     * A buyer may have only one PENDING offer per listing at a time.
     */
    async makeOffer(buyerId: string, dto: CreateOfferDto): Promise<Offer> {
        const listing = await this.prisma.listing.findFirst({
            where: { id: dto.listingId, deletedAt: null, status: 'ACTIVE' },
        });

        if (!listing) {
            throw new NotFoundException('Listing not found or is no longer active.');
        }

        // Prevent the seller from making an offer on their own listing
        if (listing.sellerId === buyerId) {
            throw new ForbiddenException('You cannot make an offer on your own listing.');
        }

        // Validate offer amount against price range
        const min = listing.priceMin !== null ? Number(listing.priceMin) : null;
        const max = listing.priceMax !== null ? Number(listing.priceMax) : null;

        if (min !== null && dto.amount < min) {
            throw new BadRequestException(
                `Offer must be at least £${min.toLocaleString('en-GB')} (the seller's minimum).`,
            );
        }
        if (max !== null && dto.amount > max) {
            throw new BadRequestException(
                `Offer cannot exceed £${max.toLocaleString('en-GB')} (the seller's maximum).`,
            );
        }

        // Cancel any existing PENDING offer from this buyer on this listing
        await this.prisma.offer.updateMany({
            where: { listingId: dto.listingId, buyerId, status: 'PENDING' },
            data: { status: 'WITHDRAWN' },
        });

        const offer = await this.prisma.offer.create({
            data: {
                listingId: dto.listingId,
                buyerId,
                amount: dto.amount,
                message: dto.message ?? null,
            },
        });

        // Notify the seller
        if (listing.sellerId) {
            await this.notificationsService.create({
                userId: listing.sellerId,
                type: 'OFFER_RECEIVED',
                title: 'New Offer Received',
                message: `You received an offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${listing.title}".`,
                data: { listingId: listing.id, offerId: offer.id },
            });
        }

        return offer;
    }

    // ─── Seller: Get all offers for a specific listing ───────────────────────

    /**
     * Returns all offers on a listing. Only the listing's owner may call this.
     */
    async getOffersForListing(listingId: string, sellerId: string): Promise<Offer[]> {
        const listing = await this.prisma.listing.findFirst({
            where: { id: listingId, deletedAt: null },
        });

        if (!listing) {
            throw new NotFoundException('Listing not found.');
        }

        if (listing.sellerId && listing.sellerId !== sellerId) {
            throw new ForbiddenException('You do not own this listing.');
        }

        return this.prisma.offer.findMany({
            where: { listingId },
            orderBy: { createdAt: 'desc' },
            include: {
                buyer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        profileImage: true,
                    },
                },
            },
        }) as Promise<Offer[]>;
    }

    // ─── Buyer: Get all their own offers ─────────────────────────────────────

    /**
     * Returns all offers submitted by the authenticated buyer, with listing details.
     */
    async getMyOffers(buyerId: string): Promise<Offer[]> {
        return this.prisma.offer.findMany({
            where: { buyerId },
            orderBy: { createdAt: 'desc' },
            include: {
                listing: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        images: true,
                        price: true,
                        priceMin: true,
                        priceMax: true,
                        status: true,
                        make: true,
                        model: true,
                        year: true,
                    },
                },
            },
        }) as Promise<Offer[]>;
    }

    // ─── Seller: Respond to an offer ─────────────────────────────────────────

    /**
     * Accept or reject an offer. Only the listing's seller may respond.
     * Accepting an offer will automatically reject all other PENDING offers on the same listing.
     */
    async respondToOffer(
        offerId: string,
        sellerId: string,
        status: OfferResponseStatus,
    ): Promise<Offer> {
        const offer = await this.prisma.offer.findUnique({
            where: { id: offerId },
            include: {
                listing: {
                    select: { id: true, title: true, sellerId: true },
                },
            },
        });

        if (!offer) {
            throw new NotFoundException('Offer not found.');
        }

        if (offer.listing.sellerId !== sellerId) {
            throw new ForbiddenException('You do not own the listing for this offer.');
        }

        if (offer.status !== 'PENDING') {
            throw new BadRequestException(`This offer is already ${offer.status.toLowerCase()}.`);
        }

        const prismaStatus: OfferStatus = status === OfferResponseStatus.ACCEPTED ? 'ACCEPTED' : 'REJECTED';

        const updated = await this.prisma.offer.update({
            where: { id: offerId },
            data: { status: prismaStatus },
        });

        // If accepted, reject all other pending offers for the same listing
        if (prismaStatus === 'ACCEPTED') {
            await this.prisma.offer.updateMany({
                where: {
                    listingId: offer.listingId,
                    id: { not: offerId },
                    status: 'PENDING',
                },
                data: { status: 'REJECTED' },
            });
        }

        // Notify the buyer
        const notifMessage =
            prismaStatus === 'ACCEPTED'
                ? `Your offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${offer.listing.title}" was accepted! Contact the seller to proceed.`
                : `Your offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${offer.listing.title}" was declined.`;

        await this.notificationsService.create({
            userId: offer.buyerId,
            type: prismaStatus === 'ACCEPTED' ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED',
            title: prismaStatus === 'ACCEPTED' ? '🎉 Offer Accepted!' : 'Offer Declined',
            message: notifMessage,
            data: { listingId: offer.listingId, offerId: offer.id },
        });

        return updated;
    }

    // ─── Public: Get latest offer for a listing/buyer pair ───────────────────

    /**
     * Returns the most recent offer from a specific buyer on a specific listing.
     * Used on the vehicle detail page to show offer status.
     */
    async getLatestOfferForBuyer(listingId: string, buyerId: string): Promise<Offer | null> {
        return this.prisma.offer.findFirst({
            where: { listingId, buyerId },
            orderBy: { createdAt: 'desc' },
        });
    }
}
