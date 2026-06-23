import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { EmailService } from '../email/email.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferResponseStatus } from './dto/respond-offer.dto';
import { Offer, OfferStatus } from '@prisma/client';

@Injectable()
export class OffersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
        private readonly emailService: EmailService,
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

        // Incremental bidding: enforce that the new bid is strictly higher than the highest active offer
        // from any OTHER buyer. Active = PENDING / COUNTERED / ACCEPTED.
        // We exclude WITHDRAWN and REJECTED, and we exclude the current buyer's own prior offers
        // (those are auto-superseded just below).
        const highestOtherOffer = await this.prisma.offer.findFirst({
            where: {
                listingId: dto.listingId,
                buyerId: { not: buyerId },
                status: { in: ['PENDING', 'COUNTERED', 'ACCEPTED'] },
            },
            orderBy: [
                { counterAmount: 'desc' },
                { amount: 'desc' },
            ],
        });

        if (highestOtherOffer) {
            const competingAmount = Math.max(
                Number(highestOtherOffer.amount),
                Number(highestOtherOffer.counterAmount ?? 0),
            );
            if (dto.amount <= competingAmount) {
                throw new BadRequestException(
                    `Your bid must be higher than the current highest bid of £${competingAmount.toLocaleString('en-GB')}.`,
                );
            }
        }

        // Block new offer if buyer's prior negotiation was exhausted and seller has decided
        const exhaustedOffer = await this.prisma.offer.findFirst({
            where: {
                listingId: dto.listingId,
                buyerId,
                counterAttemptsBuyer: { gte: 5 },
                status: { in: ['ACCEPTED', 'REJECTED'] },
            },
        });
        if (exhaustedOffer) {
            throw new BadRequestException(
                'You cannot make a new offer on this listing after the negotiation limit has been reached.',
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
                sellerId: listing.sellerId,
                amount: dto.amount,
                initialAmount: dto.amount,
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
                    entityType: 'OFFER',
                    entityId: offer.id,
                    actionType: 'CREATED',
                    data: { listingId: listing.id, offerId: offer.id },
                });
                this.notificationsGateway.sendNotification(listing.sellerId, notification);

                // Email the seller
                const seller = await this.prisma.user.findUnique({ where: { id: listing.sellerId }, select: { email: true, firstName: true } });
                if (seller?.email) {
                    this.emailService.sendOfferReceivedEmail(
                        seller.email,
                        seller.firstName || 'there',
                        listing.title,
                        Number(offer.amount),
                    ).catch(console.error);
                }
            } catch (error) {
                console.error('Failed to send offer notification:', error);
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
                    select: { id: true, title: true, sellerId: true, slug: true },
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

        // Expiry check: if a COUNTERED offer has passed its 48-hour window, auto-reject it
        if (
            offer.counterExpiresAt &&
            offer.counterExpiresAt < new Date() &&
            offer.status === 'COUNTERED'
        ) {
            await this.prisma.offer.update({ where: { id: offerId }, data: { status: 'REJECTED' } });
            throw new BadRequestException('This offer has expired after the 48-hour counter window.');
        }

        // Allow seller to respond when offer is PENDING, or when it's COUNTERED and the buyer last countered (seller's turn)
        const isSellerTurn = offer.status === 'COUNTERED' && offer.lastCounteredBy === 'BUYER';
        if (offer.status !== 'PENDING' && !isSellerTurn && !(offer.status === 'ACCEPTED' && status === OfferResponseStatus.REJECTED)) {
            throw new BadRequestException(`This offer is already ${offer.status.toLowerCase()}.`);
        }

        if (status === OfferResponseStatus.COUNTERED && !counterAmount) {
            throw new BadRequestException('A counter amount is required when countering an offer.');
        }

        // Counter attempt limit check for seller
        if (status === OfferResponseStatus.COUNTERED && offer.counterAttemptsSeller >= 5) {
            throw new BadRequestException('Counter-offer limit reached. You must Accept or Decline.');
        }

        const prismaStatus: OfferStatus = status as unknown as OfferStatus;

        const updateData: any = {
            status: prismaStatus,
            sellerCounterAmount: status === OfferResponseStatus.COUNTERED ? counterAmount : undefined,
            finalAmount: prismaStatus === 'ACCEPTED' ? offer.amount : undefined,
            counterAmount: status === OfferResponseStatus.COUNTERED ? counterAmount : null,
        };

        if (status === OfferResponseStatus.COUNTERED) {
            updateData.counterAttemptsSeller = { increment: 1 };
            updateData.lastCounteredBy = 'SELLER';
            updateData.counterExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        }

        const updated = await this.prisma.offer.update({
            where: { id: offerId },
            data: updateData,
        });

        // Send limit-reached notifications if seller just hit the 5th counter
        if (status === OfferResponseStatus.COUNTERED && offer.counterAttemptsSeller + 1 === 5) {
            try {
                const buyerNotif = await this.notificationsService.create({
                    userId: offer.buyerId,
                    type: 'OFFER_COUNTERED',
                    title: 'Counter Limit Reached',
                    message: 'Counter limit reached — awaiting seller\'s final decision.',
                    link: '/dashboard/buyer/offers',
                    entityType: 'OFFER',
                    entityId: offer.id,
                    actionType: 'COUNTER_LIMIT_REACHED',
                    data: { listingId: offer.listingId, offerId: offer.id },
                });
                this.notificationsGateway.sendNotification(offer.buyerId, buyerNotif);

                if (offer.listing.sellerId) {
                    const sellerNotif = await this.notificationsService.create({
                        userId: offer.listing.sellerId,
                        type: 'OFFER_COUNTERED',
                        title: 'Counter Limit Reached',
                        message: 'Counter limit reached — you must Accept or Decline.',
                        link: '/dashboard/seller/offers',
                        entityType: 'OFFER',
                        entityId: offer.id,
                        actionType: 'COUNTER_LIMIT_REACHED',
                        data: { listingId: offer.listingId, offerId: offer.id },
                    });
                    this.notificationsGateway.sendNotification(offer.listing.sellerId, sellerNotif);
                }
            } catch (error) {
                console.error('[OffersService] Failed to send counter limit notifications:', error);
            }
        }

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
            // Update listing status to OFFER_ACCEPTED
            await this.prisma.listing.update({
                where: { id: offer.listingId },
                data: { status: 'OFFER_ACCEPTED' }
            });

            // Auto-cancel any linked auction so the vehicle isn't still bidding
            const listing = await this.prisma.listing.findUnique({
                where: { id: offer.listingId },
                select: { linkedListingId: true } as any,
            });
            const linkedId = (listing as any)?.linkedListingId as string | null;
            if (linkedId) {
                const linkedAuction = await this.prisma.auction.findFirst({
                    where: { listingId: linkedId, status: { in: ['ACTIVE', 'SCHEDULED'] } },
                });
                if (linkedAuction) {
                    await this.prisma.auction.update({
                        where: { id: linkedAuction.id },
                        data: { status: 'CANCELLED' },
                    });
                    await this.prisma.listing.update({
                        where: { id: linkedId },
                        data: { status: 'DRAFT' } as any,
                    });
                }
                // Clear the link on both sides
                await this.prisma.listing.updateMany({
                    where: { id: { in: [offer.listingId, linkedId] } },
                    data: { linkedListingId: null } as any,
                });
            }
        }

        // If rejecting a previously-accepted offer (seller "Cancel & Relist"),
        // revert the listing back to ACTIVE so buyers can make new offers.
        if (prismaStatus === 'REJECTED' && offer.status === 'ACCEPTED') {
            await this.prisma.listing.update({
                where: { id: offer.listingId },
                data: { status: 'ACTIVE' }
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
            notifType = 'OFFER_COUNTERED';
        }

        try {
            const buyerNotification = await this.notificationsService.create({
                userId: offer.buyerId,
                type: notifType,
                title: notifTitle,
                message: notifMessage,
                link: '/dashboard/buyer/offers',
                entityType: 'OFFER',
                entityId: offer.id,
                actionType: prismaStatus,
                data: { listingId: offer.listingId, offerId: offer.id },
            });
            this.notificationsGateway.sendNotification(offer.buyerId, buyerNotification);

            // Email the buyer
            const buyer = await this.prisma.user.findUnique({ where: { id: offer.buyerId }, select: { email: true, firstName: true } });
            if (buyer?.email) {
                const slug = offer.listing.slug;
                const amt = Number(offer.amount);
                if (prismaStatus === 'ACCEPTED') {
                    this.emailService.sendOfferAcceptedEmail(buyer.email, buyer.firstName || 'there', offer.listing.title, amt, slug).catch(console.error);
                } else if (prismaStatus === 'REJECTED') {
                    this.emailService.sendOfferRejectedEmail(buyer.email, buyer.firstName || 'there', offer.listing.title, amt, slug).catch(console.error);
                } else if (prismaStatus === 'COUNTERED' && counterAmount) {
                    this.emailService.sendOfferCounteredEmail(buyer.email, buyer.firstName || 'there', offer.listing.title, amt, counterAmount, slug).catch(console.error);
                }
            }
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
                    entityType: 'OFFER',
                    entityId: offer.id,
                    actionType: 'ACCEPTED',
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
            where: { sellerId: targetOwnerId, deletedAt: null, status: 'ACTIVE' },
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

    /**
     * Returns the count of the buyer's outgoing offers that are COUNTERED
     * (seller sent a counter-offer and buyer needs to respond).
     */
    async getBuyerActionCount(buyerId: string): Promise<number> {
        return this.prisma.offer.count({
            where: { buyerId, status: 'COUNTERED' },
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
                type: 'OFFER_WITHDRAWN',
                title: 'Offer Withdrawn',
                message: `An offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${offer.listing.title}" was withdrawn by the buyer.`,
                link: '/dashboard/seller/offers',
                entityType: 'OFFER',
                entityId: offer.id,
                actionType: 'WITHDRAWN',
                data: { listingId: offer.listingId, offerId: offer.id },
            });
            this.notificationsGateway.sendNotification(offer.listing.sellerId, sellerNotification);
        }

        return updated;
    }

    /**
     * Buyer: Respond to a counter-offer from the seller (accept, reject, or re-counter)
     */
    async respondToCounterOffer(
        offerId: string,
        buyerId: string,
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

        if (offer.buyerId !== buyerId) {
            throw new ForbiddenException('You do not own this offer.');
        }

        if (offer.status !== 'COUNTERED') {
            throw new BadRequestException('This offer has not been countered or is already closed.');
        }
        if (offer.lastCounteredBy === 'BUYER') {
            throw new BadRequestException('Awaiting the seller\'s response to your previous counter.');
        }

        // Expiry check: if the 48-hour counter window has passed, auto-reject
        if (
            offer.counterExpiresAt &&
            offer.counterExpiresAt < new Date() &&
            offer.status === 'COUNTERED'
        ) {
            await this.prisma.offer.update({ where: { id: offerId }, data: { status: 'REJECTED' } });
            throw new BadRequestException('This offer has expired after the 48-hour counter window.');
        }

        // Buyer re-counter path
        if (status === OfferResponseStatus.COUNTERED) {
            if (!counterAmount || counterAmount <= 0) {
                throw new BadRequestException('Counter amount is required when issuing a counter-offer.');
            }
            if (offer.counterAttemptsBuyer >= 5) {
                throw new BadRequestException('Counter-offer limit reached — awaiting seller final decision.');
            }

            const updatedOffer = await this.prisma.$transaction(async (tx) => {
                return tx.offer.update({
                    where: { id: offerId },
                    data: {
                        status: 'COUNTERED',
                        buyerCounterAmount: counterAmount,
                        counterAmount: counterAmount,
                        counterAttemptsBuyer: { increment: 1 },
                        lastCounteredBy: 'BUYER',
                        counterExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
                    },
                });
            });

            // Send limit-reached notifications if buyer just hit the 5th counter
            if (offer.counterAttemptsBuyer + 1 === 5) {
                try {
                    const buyerNotif = await this.notificationsService.create({
                        userId: offer.buyerId,
                        type: 'OFFER_COUNTERED',
                        title: 'Counter Limit Reached',
                        message: 'Counter limit reached — awaiting seller\'s final decision.',
                        link: '/dashboard/buyer/offers',
                        entityType: 'OFFER',
                        entityId: offer.id,
                        actionType: 'COUNTER_LIMIT_REACHED',
                        data: { listingId: offer.listingId, offerId: offer.id },
                    });
                    this.notificationsGateway.sendNotification(offer.buyerId, buyerNotif);

                    if (offer.listing.sellerId) {
                        const sellerNotif = await this.notificationsService.create({
                            userId: offer.listing.sellerId,
                            type: 'OFFER_COUNTERED',
                            title: 'Counter Limit Reached',
                            message: 'Counter limit reached — you must Accept or Decline.',
                            link: '/dashboard/seller/offers',
                            entityType: 'OFFER',
                            entityId: offer.id,
                            actionType: 'COUNTER_LIMIT_REACHED',
                            data: { listingId: offer.listingId, offerId: offer.id },
                        });
                        this.notificationsGateway.sendNotification(offer.listing.sellerId, sellerNotif);
                    }
                } catch (error) {
                    console.error('[OffersService] Failed to send counter limit notifications (buyer):', error);
                }
            }

            // Notify the seller that the buyer re-countered
            if (offer.listing.sellerId) {
                try {
                    const sellerNotif = await this.notificationsService.create({
                        userId: offer.listing.sellerId,
                        type: 'OFFER_COUNTERED',
                        title: 'Re-Counter Offer Received',
                        message: `The buyer re-countered your offer on "${offer.listing.title}" with £${Number(counterAmount).toLocaleString('en-GB')}.`,
                        link: '/dashboard/seller/offers',
                        entityType: 'OFFER',
                        entityId: offer.id,
                        actionType: 'COUNTERED',
                        data: { listingId: offer.listingId, offerId: offer.id },
                    });
                    this.notificationsGateway.sendNotification(offer.listing.sellerId, sellerNotif);
                } catch (error) {
                    console.error('[OffersService] Failed to notify seller of buyer re-counter:', error);
                }
            }

            return updatedOffer;
        }

        const prismaStatus: OfferStatus = status as unknown as OfferStatus;

        const updated = await this.prisma.offer.update({
            where: { id: offerId },
            data: {
                status: prismaStatus,
                finalAmount: prismaStatus === 'ACCEPTED' ? offer.counterAmount : undefined
            },
        });

        if (prismaStatus === 'ACCEPTED') {
            await this.prisma.offer.updateMany({
                where: {
                    listingId: offer.listingId,
                    id: { not: offerId },
                    status: 'PENDING',
                },
                data: { status: 'REJECTED' },
            });
            await this.prisma.listing.update({
                where: { id: offer.listingId },
                data: { status: 'OFFER_ACCEPTED' }
            });
        }

        // Notify the seller (non-fatal — deal is already recorded)
        if (offer.listing.sellerId) {
            try {
                const notifTitle = prismaStatus === 'ACCEPTED' ? '💰 Counter Offer Accepted!' : 'Counter Offer Declined';
                const notifMessage = prismaStatus === 'ACCEPTED'
                    ? `The buyer accepted your counter offer of £${Number(offer.counterAmount).toLocaleString('en-GB')} for "${offer.listing.title}"! Contact them to finalize, then mark the listing as Sold from your dashboard.`
                    : `The buyer declined your counter offer for "${offer.listing.title}".`;

                const sellerNotification = await this.notificationsService.create({
                    userId: offer.listing.sellerId,
                    type: prismaStatus === 'ACCEPTED' ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED',
                    title: notifTitle,
                    message: notifMessage,
                    link: '/dashboard/seller/offers',
                    entityType: 'OFFER',
                    entityId: offer.id,
                    actionType: prismaStatus,
                    data: { listingId: offer.listingId, offerId: offer.id },
                });
                this.notificationsGateway.sendNotification(offer.listing.sellerId, sellerNotification);

                // Email the seller when buyer accepts counter
                if (prismaStatus === 'ACCEPTED' && offer.counterAmount) {
                    const seller = await this.prisma.user.findUnique({ where: { id: offer.listing.sellerId }, select: { email: true, firstName: true } });
                    if (seller?.email) {
                        this.emailService.sendCounterAcceptedEmail(
                            seller.email,
                            seller.firstName || 'there',
                            offer.listing.title,
                            Number(offer.counterAmount),
                        ).catch(console.error);
                    }
                }
            } catch (notifErr) {
                console.error('[OffersService] Failed to notify seller after counter acceptance:', notifErr?.message);
            }
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
