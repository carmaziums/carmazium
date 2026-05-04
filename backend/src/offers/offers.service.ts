import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferResponseStatus } from './dto/respond-offer.dto';
import { Offer, OfferStatus } from '@prisma/client';

@Injectable()
export class OffersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
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

        // Remove strict priceMin/priceMax validation to prevent leaking seller's hidden bounds
        // Instead, the only restriction is that the offer must be at least 70% of the asking price
        const askingPrice = Number(listing.price);
        const minAllowedOffer = Math.floor(askingPrice * 0.7);

        const buyerMax = dto.amountMax ?? dto.amount;
        
        if (buyerMax < minAllowedOffer) {
            throw new BadRequestException(
                `Offer must be at least £${minAllowedOffer.toLocaleString('en-GB')} (70% of the asking price).`,
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
                amountMin: dto.amountMin ?? dto.amount,
                amountMax: dto.amountMax ?? dto.amount,
                message: dto.message ?? null,
            },
        });

        // Notify the seller
        if (listing.sellerId) {
            const notification = await this.notificationsService.create({
                userId: listing.sellerId,
                type: 'OFFER_RECEIVED',
                title: 'New Offer Received',
                message: `You received an offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${listing.title}".`,
                data: { listingId: listing.id, offerId: offer.id },
            });
            // Push real-time notification via WebSocket
            this.notificationsGateway.sendNotification(listing.sellerId, notification);
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
                        sellerId: true,
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

        if (offer.status !== 'PENDING' && !(offer.status === 'ACCEPTED' && status === OfferResponseStatus.REJECTED)) {
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
            // NOTE: The listing intentionally stays ACTIVE after an offer is accepted.
            // The seller must manually mark it as SOLD from their inventory.
            // This allows relisting if the buyer doesn't follow through.
        }

        // Notify the buyer
        const notifMessage =
            prismaStatus === 'ACCEPTED'
                ? `Your offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${offer.listing.title}" was accepted! Contact the seller to proceed.`
                : `Your offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${offer.listing.title}" was declined.`;

        const buyerNotification = await this.notificationsService.create({
            userId: offer.buyerId,
            type: prismaStatus === 'ACCEPTED' ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED',
            title: prismaStatus === 'ACCEPTED' ? '🎉 Offer Accepted!' : 'Offer Declined',
            message: notifMessage,
            data: { listingId: offer.listingId, offerId: offer.id },
        });
        // Push real-time notification to the buyer
        this.notificationsGateway.sendNotification(offer.buyerId, buyerNotification);

        // If accepted, also notify the seller that an offer was accepted (listing stays active)
        if (prismaStatus === 'ACCEPTED' && offer.listing.sellerId) {
            const sellerNotification = await this.notificationsService.create({
                userId: offer.listing.sellerId,
                type: 'DEAL_CLOSED',
                title: '✅ Offer Accepted',
                message: `You accepted an offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${offer.listing.title}". The listing remains active — mark it as Sold from your inventory when the deal is complete.`,
                data: { listingId: offer.listingId, offerId: offer.id },
            });
            this.notificationsGateway.sendNotification(offer.listing.sellerId, sellerNotification);
        }

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

    /**
     * Returns the current authenticated buyer's most recent offer for a listing.
     * Exposes getLatestOfferForBuyer for use via the REST API.
     */
    async getMyOfferForListing(listingId: string, buyerId: string): Promise<Offer | null> {
        return this.getLatestOfferForBuyer(listingId, buyerId);
    }

    // ─── Seller: Count total pending offers across all their listings ─────────

    /**
     * Returns the total number of PENDING offers across all listings owned by the seller.
     * Used to show a badge/dot on the Offers tab in the seller dashboard sidebar.
     */
    async getPendingOffersCount(sellerId: string): Promise<number> {
        // First find all listing IDs owned by this seller
        const listings = await this.prisma.listing.findMany({
            where: { sellerId, deletedAt: null },
            select: { id: true },
        });
        const listingIds = listings.map(l => l.id);
        if (listingIds.length === 0) return 0;

        return this.prisma.offer.count({
            where: {
                listingId: { in: listingIds },
                status: 'PENDING',
            },
        });
    }

    // ─── Buyer: Withdraw an offer ───────────────────────────────────────────

    /**
     * Withdraw an offer. Only the buyer who submitted it may withdraw.
     * The offer must be in PENDING status.
     */
    async withdrawOffer(offerId: string, buyerId: string): Promise<Offer> {
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

        if (offer.buyerId !== buyerId) {
            throw new ForbiddenException('You did not submit this offer.');
        }

        if (offer.status !== 'PENDING') {
            throw new BadRequestException(`You cannot withdraw an offer that is already ${offer.status.toLowerCase()}.`);
        }

        const updated = await this.prisma.offer.update({
            where: { id: offerId },
            data: { status: 'WITHDRAWN' },
        });

        // Notify the seller that the offer was withdrawn
        if (offer.listing.sellerId) {
            const sellerNotification = await this.notificationsService.create({
                userId: offer.listing.sellerId,
                type: 'OFFER_REJECTED', // Using REJECTED type for withdrawn notifications
                title: 'Offer Withdrawn',
                message: `An offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${offer.listing.title}" was withdrawn by the buyer.`,
                data: { listingId: offer.listingId, offerId: offer.id },
            });
            this.notificationsGateway.sendNotification(offer.listing.sellerId, sellerNotification);
        }

        return updated;
    }
}
