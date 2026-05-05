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
            where: { id: dto.listingId, deletedAt: null },
        });

        if (!listing) {
            throw new NotFoundException('Listing not found.');
        }

        if (listing.status === 'SOLD') {
            throw new BadRequestException('This listing has already been sold. You cannot make an offer.');
        }

        if (listing.status !== 'ACTIVE') {
            throw new BadRequestException('This listing is not currently active.');
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
            try {
                const notification = await this.notificationsService.create({
                    userId: listing.sellerId,
                    type: 'OFFER_RECEIVED',
                    title: 'New Offer Received',
                    message: `You received an offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${listing.title}".`,
                    link: '/dashboard/seller/offers',
                    data: { listingId: listing.id, offerId: offer.id },
                });
                // Push real-time notification via WebSocket
                this.notificationsGateway.sendNotification(listing.sellerId, notification);
            } catch (error) {
                console.error('Failed to send offer notification:', error);
                // We don't rethrow here because the offer was successfully created
            }
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
        counterAmount?: number,
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

        // Authorization check: User must be listing owner OR staff of the dealership owner
        const listingOwnerId = offer.listing.sellerId;
        let isAuthorized = listingOwnerId === sellerId;

        if (!isAuthorized && listingOwnerId) {
            // Check if listing owner is a dealer and responder is their staff
            const ownerDealerProfile = await this.prisma.dealerProfile.findUnique({
                where: { userId: listingOwnerId }
            });
            if (ownerDealerProfile) {
                const staffMember = await this.prisma.dealerStaff.findFirst({
                    where: { userId: sellerId, dealerProfileId: ownerDealerProfile.id, isActive: true }
                });
                if (staffMember) isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            throw new ForbiddenException('You do not have permission to respond to this offer.');
        }

        if (offer.status !== 'PENDING' && !(offer.status === 'ACCEPTED' && status === OfferResponseStatus.REJECTED)) {
            throw new BadRequestException(`This offer is already ${offer.status.toLowerCase()}.`);
        }

        if (status === OfferResponseStatus.COUNTERED && !counterAmount) {
            throw new BadRequestException('A counter amount is required when countering an offer.');
        }

        const prismaStatus: OfferStatus = status as unknown as OfferStatus;

        const updated = await this.prisma.offer.update({
            where: { id: offerId },
            data: { 
                status: prismaStatus,
                counterAmount: status === OfferResponseStatus.COUNTERED ? counterAmount : null,
            },
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
        let notifMessage = '';
        let notifTitle = '';
        let notifType = '';

        if (prismaStatus === 'ACCEPTED') {
            notifTitle = '🎉 Offer Accepted!';
            notifMessage = `Your offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${offer.listing.title}" was accepted! Contact the seller to proceed.`;
            notifType = 'OFFER_ACCEPTED';
        } else if (prismaStatus === 'REJECTED') {
            notifTitle = 'Offer Declined';
            notifMessage = `Your offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${offer.listing.title}" was declined.`;
            notifType = 'OFFER_REJECTED';
        } else if (prismaStatus === 'COUNTERED') {
            notifTitle = '🔄 Counter Offer Received';
            notifMessage = `The seller countered your offer on "${offer.listing.title}" with £${Number(counterAmount).toLocaleString('en-GB')}.`;
            notifType = 'OFFER_RECEIVED';
        }

        try {
            const buyerNotification = await this.notificationsService.create({
                userId: offer.buyerId,
                type: notifType,
                title: notifTitle,
                message: notifMessage,
                link: prismaStatus === 'COUNTERED' ? `/vehicle/${offer.listingId}` : '/dashboard/buyer/offers',
                data: { listingId: offer.listingId, offerId: offer.id },
            });
            // Push real-time notification to the buyer
            this.notificationsGateway.sendNotification(offer.buyerId, buyerNotification);
        } catch (error) {
            console.error('Failed to notify buyer after offer response:', error);
        }

        // If accepted, also notify the seller that an offer was accepted (listing stays active)
        if (prismaStatus === 'ACCEPTED' && offer.listing.sellerId) {
            try {
                const sellerNotification = await this.notificationsService.create({
                    userId: offer.listing.sellerId,
                    type: 'DEAL_CLOSED',
                    title: '✅ Offer Accepted',
                    message: `You accepted an offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${offer.listing.title}". The listing remains active — mark it as Sold from your inventory when the deal is complete.`,
                    link: '/dashboard/seller/offers',
                    data: { listingId: offer.listingId, offerId: offer.id },
                });
                this.notificationsGateway.sendNotification(offer.listing.sellerId, sellerNotification);
            } catch (error) {
                console.error('Failed to notify seller after offer acceptance:', error);
            }
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
    /**
     * Returns the total number of PENDING offers across all listings owned by the seller/dealer.
     */
    async getPendingOffersCount(userId: string): Promise<number> {
        // Handle staff/owner logic to find the dealership
        let targetOwnerId = userId;
        const staffRecord = await this.prisma.dealerStaff.findFirst({
            where: { userId, isActive: true },
            select: { dealerProfile: { select: { userId: true } } }
        });
        if (staffRecord) {
            targetOwnerId = staffRecord.dealerProfile.userId;
        }

        const listings = await this.prisma.listing.findMany({
            where: { sellerId: targetOwnerId, deletedAt: null },
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

    /**
     * Buyer: Respond to a counter-offer from the seller
     */
    async respondToCounterOffer(
        offerId: string,
        buyerId: string,
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

        if (offer.buyerId !== buyerId) {
            throw new ForbiddenException('You do not own this offer.');
        }

        if (offer.status !== 'COUNTERED') {
            throw new BadRequestException('This offer has not been countered or is already closed.');
        }

        const prismaStatus: OfferStatus = status as unknown as OfferStatus;

        const updated = await this.prisma.offer.update({
            where: { id: offerId },
            data: { status: prismaStatus },
        });



        // Notify the seller
        if (offer.listing.sellerId) {
            const notifTitle = prismaStatus === 'ACCEPTED' ? '💰 Counter Offer Accepted!' : 'Counter Offer Declined';
            const notifMessage = prismaStatus === 'ACCEPTED'
                ? `The buyer accepted your counter offer of £${Number(offer.counterAmount).toLocaleString('en-GB')} for "${offer.listing.title}"! Contact them to finalize, then mark the listing as Sold from your dashboard.`
                : `The buyer declined your counter offer for "${offer.listing.title}".`;

            const sellerNotification = await this.notificationsService.create({
                userId: offer.listing.sellerId,
                type: prismaStatus === 'ACCEPTED' ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED',
                title: notifTitle,
                message: notifMessage,
                data: { listingId: offer.listingId, offerId: offer.id },
            });
            this.notificationsGateway.sendNotification(offer.listing.sellerId, sellerNotification);
        }

        return updated;
    }
    /**
     * Seller/Dealer: Get all offers received across all their listings
     */
    async getReceivedOffers(userId: string): Promise<Offer[]> {
        // Handle staff/owner logic to find the dealership
        let targetOwnerId = userId;
        const staffRecord = await this.prisma.dealerStaff.findFirst({
            where: { userId, isActive: true },
            select: { dealerProfile: { select: { userId: true } } }
        });
        if (staffRecord) {
            targetOwnerId = staffRecord.dealerProfile.userId;
        }

        const listings = await this.prisma.listing.findMany({
            where: { sellerId: targetOwnerId, deletedAt: null },
            select: { id: true },
        });
        const listingIds = listings.map(l => l.id);
        if (listingIds.length === 0) return [];

        return this.prisma.offer.findMany({
            where: {
                listingId: { in: listingIds },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                listing: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        vrm: true,
                        price: true,
                    },
                },
                buyer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        }) as Promise<Offer[]>;
    }
}
