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
import { AmendOfferDto } from './dto/amend-offer.dto';
import { OfferResponseStatus } from './dto/respond-offer.dto';
import { Offer, OfferStatus } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { AuctionsService, RetailDealAuctionCancellation } from '../auctions/auctions.service';

const PENDING_OFFER_LIFETIME_MS = 72 * 60 * 60 * 1000;
const COUNTER_OFFER_LIFETIME_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class OffersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
        private readonly emailService: EmailService,
        private readonly auctionsService: AuctionsService,
    ) { }

    private isPendingOfferExpired(updatedAt: Date): boolean {
        return updatedAt.getTime() < Date.now() - PENDING_OFFER_LIFETIME_MS;
    }

    private validateBuyerOfferAmount(amount: number, askingPrice: number): void {
        const minAllowedOffer = Math.floor(askingPrice * 0.7);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new BadRequestException('A valid offer amount is required.');
        }
        if (amount < minAllowedOffer) {
            throw new BadRequestException(
                `Offer must be at least £${minAllowedOffer.toLocaleString('en-GB')} (70% of the asking price).`,
            );
        }
        if (amount > askingPrice) {
            throw new BadRequestException(
                `Offer cannot exceed the asking price of £${askingPrice.toLocaleString('en-GB')}.`,
            );
        }
    }

    /**
     * Atomically reserve a retail listing for one accepted offer, close every
     * other open negotiation, and cancel any linked auction through the auction
     * lifecycle service. Only one concurrent acceptance can win the ACTIVE ->
     * OFFER_ACCEPTED state transition.
     */
    private async closeRetailDeal(offer: any, finalAmount: number): Promise<Offer> {
        let auctionCancellation: RetailDealAuctionCancellation | null = null;

        const updatedOffer = await this.prisma.$transaction(async (tx) => {
            const reserved = await tx.listing.updateMany({
                where: {
                    id: offer.listingId,
                    status: 'ACTIVE',
                    deletedAt: null,
                },
                data: { status: 'OFFER_ACCEPTED' },
            });

            if (reserved.count !== 1) {
                throw new BadRequestException(
                    'This vehicle is no longer available for a new accepted offer.',
                );
            }

            const accepted = await tx.offer.update({
                where: { id: offer.id },
                data: {
                    status: 'ACCEPTED',
                    finalAmount,
                    counterExpiresAt: null,
                },
            });

            await tx.offer.updateMany({
                where: {
                    listingId: offer.listingId,
                    id: { not: offer.id },
                    status: { in: ['PENDING', 'COUNTERED'] },
                },
                data: {
                    status: 'REJECTED',
                    counterExpiresAt: null,
                },
            });

            const listing = await tx.listing.findUnique({
                where: { id: offer.listingId },
                select: { linkedListingId: true },
            });

            if (listing?.linkedListingId) {
                auctionCancellation = await this.auctionsService.cancelLinkedAuctionForRetailDeal(
                    listing.linkedListingId,
                    offer.listingId,
                    tx,
                );
            }

            return accepted;
        });

        await this.auctionsService.publishRetailDealAuctionCancellation(auctionCancellation);
        return updatedOffer as Offer;
    }

    /**
     * Expire untouched retail offers after 72 hours and counter-offers after
     * their 48-hour response window. We keep the existing OfferStatus enum and
     * close expired rows as REJECTED so older clients remain compatible.
     */
    @Cron('*/10 * * * *')
    async expireStaleOffers(): Promise<void> {
        const now = new Date();
        const pendingCutoff = new Date(now.getTime() - PENDING_OFFER_LIFETIME_MS);
        const stale = await this.prisma.offer.findMany({
            where: {
                OR: [
                    { status: 'PENDING', updatedAt: { lt: pendingCutoff } },
                    { status: 'COUNTERED', counterExpiresAt: { lt: now } },
                ],
            },
            include: {
                listing: {
                    select: { id: true, title: true, sellerId: true },
                },
            },
        });

        for (const offer of stale) {
            const closed = await this.prisma.offer.updateMany({
                where: { id: offer.id, status: offer.status },
                data: { status: 'REJECTED', counterExpiresAt: null },
            });
            if (closed.count !== 1) continue;

            try {
                const buyerNotification = await this.notificationsService.create({
                    userId: offer.buyerId,
                    type: 'OFFER_EXPIRED',
                    title: 'Offer Expired',
                    message: `Your offer negotiation on "${offer.listing.title}" expired. If the vehicle is still available, you can submit a new offer.`,
                    link: '/dashboard/buyer/offers',
                    entityType: 'OFFER',
                    entityId: offer.id,
                    actionType: 'EXPIRED',
                    data: { listingId: offer.listingId, offerId: offer.id },
                });
                this.notificationsGateway.sendNotification(offer.buyerId, buyerNotification);

                if (offer.listing.sellerId) {
                    const sellerNotification = await this.notificationsService.create({
                        userId: offer.listing.sellerId,
                        type: 'OFFER_EXPIRED',
                        title: 'Offer Expired',
                        message: `An offer negotiation on "${offer.listing.title}" expired without agreement.`,
                        link: '/dashboard/seller/offers',
                        entityType: 'OFFER',
                        entityId: offer.id,
                        actionType: 'EXPIRED',
                        data: { listingId: offer.listingId, offerId: offer.id },
                    });
                    this.notificationsGateway.sendNotification(offer.listing.sellerId, sellerNotification);
                }
            } catch (error) {
                console.error('[OffersService] Failed to notify parties of expired offer:', error);
            }
        }
    }

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
        if (listing.type !== 'CLASSIFIED') {
            throw new BadRequestException('Retail offers are only available on retail listings. Use auction bidding for auction vehicles.');
        }
        if (listing.status === 'SOLD') {
            throw new BadRequestException('This listing has already been sold. You cannot make an offer.');
        }
        if (listing.status === 'OFFER_ACCEPTED') {
            throw new BadRequestException('This vehicle is sale pending and is not accepting new offers.');
        }
        if (listing.status !== 'ACTIVE') {
            throw new BadRequestException('This listing is not currently active.');
        }
        if (listing.sellerId === buyerId) {
            throw new ForbiddenException('You cannot make an offer on your own listing.');
        }

        const askingPrice = Number(listing.price);
        this.validateBuyerOfferAmount(dto.amount, askingPrice);

        // Retail is a private negotiation, not a public price ladder. Other
        // buyers' offers never affect what this buyer is allowed to submit.
        const existingOpen = await this.prisma.offer.findFirst({
            where: {
                listingId: dto.listingId,
                buyerId,
                status: { in: ['PENDING', 'COUNTERED'] },
            },
            orderBy: { updatedAt: 'desc' },
        });

        if (existingOpen) {
            const counterExpired =
                existingOpen.status === 'COUNTERED' &&
                existingOpen.counterExpiresAt &&
                existingOpen.counterExpiresAt < new Date();
            const pendingExpired =
                existingOpen.status === 'PENDING' &&
                this.isPendingOfferExpired(existingOpen.updatedAt);

            if (counterExpired || pendingExpired) {
                await this.prisma.offer.updateMany({
                    where: { id: existingOpen.id, status: existingOpen.status },
                    data: { status: 'REJECTED', counterExpiresAt: null },
                });
            } else {
                throw new BadRequestException(
                    existingOpen.status === 'PENDING'
                        ? 'You already have a pending offer on this vehicle. Amend or withdraw it instead of creating another.'
                        : 'You already have an active negotiation on this vehicle. Use the counter-offer controls or cancel it first.',
                );
            }
        }

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

        const offer = await this.prisma.offer.create({
            data: {
                listingId: dto.listingId,
                buyerId,
                sellerId: listing.sellerId,
                amount: dto.amount,
                initialAmount: dto.amount,
                // Legacy range fields are retained in the schema for backwards
                // compatibility, but retail negotiation now has one explicit
                // private offer amount.
                amountMin: dto.amount,
                amountMax: dto.amount,
                message: dto.message ?? null,
            },
        });

        if (listing.sellerId) {
            try {
                const notification = await this.notificationsService.create({
                    userId: listing.sellerId,
                    type: 'OFFER_RECEIVED',
                    title: 'New Offer Received',
                    message: `You received a private offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${listing.title}".`,
                    link: '/dashboard/seller/offers',
                    entityType: 'OFFER',
                    entityId: offer.id,
                    actionType: 'CREATED',
                    data: { listingId: listing.id, offerId: offer.id },
                });
                this.notificationsGateway.sendNotification(listing.sellerId, notification);

                const seller = await this.prisma.user.findUnique({
                    where: { id: listing.sellerId },
                    select: { email: true, firstName: true },
                });
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
                    select: {
                        id: true,
                        title: true,
                        sellerId: true,
                        slug: true,
                        status: true,
                        price: true,
                    },
                },
            },
        });

        if (!offer) {
            throw new NotFoundException('Offer not found.');
        }

        const listingOwnerId = offer.listing.sellerId;
        let isAuthorized = listingOwnerId === sellerId;

        if (!isAuthorized && listingOwnerId) {
            const ownerDealerProfile = await this.prisma.dealerProfile.findUnique({
                where: { userId: listingOwnerId },
            });
            if (ownerDealerProfile) {
                const staffMember = await this.prisma.dealerStaff.findFirst({
                    where: {
                        userId: sellerId,
                        dealerProfileId: ownerDealerProfile.id,
                        isActive: true,
                    },
                });
                if (staffMember) isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            throw new ForbiddenException('You do not have permission to respond to this offer.');
        }

        const now = new Date();
        const counterExpired =
            offer.status === 'COUNTERED' &&
            !!offer.counterExpiresAt &&
            offer.counterExpiresAt < now;
        const pendingExpired =
            offer.status === 'PENDING' &&
            this.isPendingOfferExpired(offer.updatedAt);

        if (counterExpired || pendingExpired) {
            await this.prisma.offer.updateMany({
                where: { id: offerId, status: offer.status },
                data: { status: 'REJECTED', counterExpiresAt: null },
            });
            throw new BadRequestException(
                counterExpired
                    ? 'This offer has expired after the 48-hour counter window.'
                    : 'This offer has expired after 72 hours without a response.',
            );
        }

        const cancellingAcceptedDeal =
            offer.status === 'ACCEPTED' &&
            status === OfferResponseStatus.REJECTED;
        const isSellerTurn =
            offer.status === 'COUNTERED' &&
            offer.lastCounteredBy === 'BUYER';

        if (
            offer.status !== 'PENDING' &&
            !isSellerTurn &&
            !cancellingAcceptedDeal
        ) {
            throw new BadRequestException(
                `This offer is already ${offer.status.toLowerCase()}.`,
            );
        }

        if (!cancellingAcceptedDeal && offer.listing.status !== 'ACTIVE') {
            throw new BadRequestException('This vehicle is no longer available for negotiation.');
        }

        if (status === OfferResponseStatus.COUNTERED) {
            if (!counterAmount || !Number.isFinite(counterAmount) || counterAmount <= 0) {
                throw new BadRequestException('A valid counter amount is required when countering an offer.');
            }
            const askingPrice = Number(offer.listing.price);
            if (counterAmount > askingPrice) {
                throw new BadRequestException(
                    `Counter offer cannot exceed the asking price of £${askingPrice.toLocaleString('en-GB')}.`,
                );
            }
            const buyerPosition = Number(
                offer.status === 'COUNTERED'
                    ? offer.counterAmount ?? offer.amount
                    : offer.amount,
            );
            if (counterAmount <= buyerPosition) {
                throw new BadRequestException(
                    'The seller counter must be above the buyer\'s current offer. Accept the buyer offer instead if you agree with that amount.',
                );
            }
            if (offer.counterAttemptsSeller >= 5) {
                throw new BadRequestException('Counter-offer limit reached. You must Accept or Decline.');
            }
        }

        const prismaStatus: OfferStatus = status as unknown as OfferStatus;
        const agreedAmt = Number(
            offer.status === 'COUNTERED'
                ? offer.counterAmount ?? offer.amount
                : offer.amount,
        );

        let updated: Offer;

        if (prismaStatus === 'ACCEPTED') {
            updated = await this.closeRetailDeal(offer, agreedAmt);
        } else {
            const updateData: any = {
                status: prismaStatus,
                sellerCounterAmount:
                    status === OfferResponseStatus.COUNTERED
                        ? counterAmount
                        : undefined,
                counterAmount:
                    status === OfferResponseStatus.COUNTERED
                        ? counterAmount
                        : null,
                counterExpiresAt:
                    status === OfferResponseStatus.COUNTERED
                        ? new Date(Date.now() + COUNTER_OFFER_LIFETIME_MS)
                        : null,
            };

            if (status === OfferResponseStatus.COUNTERED) {
                updateData.counterAttemptsSeller = { increment: 1 };
                updateData.lastCounteredBy = 'SELLER';
            }

            updated = await this.prisma.offer.update({
                where: { id: offerId },
                data: updateData,
            });

            if (cancellingAcceptedDeal) {
                await this.prisma.listing.updateMany({
                    where: { id: offer.listingId, status: 'OFFER_ACCEPTED' },
                    data: { status: 'ACTIVE' },
                });
            }
        }

        if (
            status === OfferResponseStatus.COUNTERED &&
            offer.counterAttemptsSeller + 1 === 5
        ) {
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
                    this.notificationsGateway.sendNotification(
                        offer.listing.sellerId,
                        sellerNotif,
                    );
                }
            } catch (error) {
                console.error(
                    '[OffersService] Failed to send counter limit notifications:',
                    error,
                );
            }
        }

        let notifMessage = '';
        let notifTitle = '';
        let notifType = '';

        if (prismaStatus === 'ACCEPTED') {
            notifTitle = 'Offer Accepted';
            notifMessage = `Your offer of £${agreedAmt.toLocaleString('en-GB')} on "${offer.listing.title}" was accepted. The vehicle is now sale pending while you and the seller complete the deal.`;
            notifType = 'OFFER_ACCEPTED';
        } else if (prismaStatus === 'REJECTED') {
            notifTitle = cancellingAcceptedDeal ? 'Deal Cancelled' : 'Offer Declined';
            notifMessage = cancellingAcceptedDeal
                ? `The previously accepted deal on "${offer.listing.title}" was cancelled by the seller and the vehicle is available again.`
                : `Your offer of £${Number(offer.amount).toLocaleString('en-GB')} on "${offer.listing.title}" was declined.`;
            notifType = 'OFFER_REJECTED';
        } else if (prismaStatus === 'COUNTERED') {
            notifTitle = 'Counter Offer Received';
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
            this.notificationsGateway.sendNotification(
                offer.buyerId,
                buyerNotification,
            );

            const buyer = await this.prisma.user.findUnique({
                where: { id: offer.buyerId },
                select: { email: true, firstName: true },
            });
            if (
                buyer?.email &&
                await this.notificationsService.shouldSendEmail(
                    offer.buyerId,
                    notifType,
                )
            ) {
                const slug = offer.listing.slug;
                if (prismaStatus === 'ACCEPTED') {
                    this.emailService.sendOfferAcceptedEmail(
                        buyer.email,
                        buyer.firstName || 'there',
                        offer.listing.title,
                        agreedAmt,
                        slug,
                    ).catch(console.error);
                } else if (prismaStatus === 'REJECTED') {
                    this.emailService.sendOfferRejectedEmail(
                        buyer.email,
                        buyer.firstName || 'there',
                        offer.listing.title,
                        agreedAmt,
                        slug,
                    ).catch(console.error);
                } else if (
                    prismaStatus === 'COUNTERED' &&
                    counterAmount
                ) {
                    this.emailService.sendOfferCounteredEmail(
                        buyer.email,
                        buyer.firstName || 'there',
                        offer.listing.title,
                        agreedAmt,
                        counterAmount,
                        slug,
                    ).catch(console.error);
                }
            }
        } catch (error) {
            console.error('Failed to notify buyer after offer response:', error);
        }

        if (prismaStatus === 'ACCEPTED' && offer.listing.sellerId) {
            try {
                const sellerNotification = await this.notificationsService.create({
                    userId: offer.listing.sellerId,
                    type: 'DEAL_CLOSED',
                    title: 'Offer Accepted — Sale Pending',
                    message: `You accepted £${agreedAmt.toLocaleString('en-GB')} on "${offer.listing.title}". The vehicle is reserved as Sale Pending. Mark it Sold when payment/handover is complete, or cancel the deal to relist.`,
                    link: '/dashboard/seller/offers',
                    entityType: 'OFFER',
                    entityId: offer.id,
                    actionType: 'ACCEPTED',
                    data: { listingId: offer.listingId, offerId: offer.id },
                });
                this.notificationsGateway.sendNotification(
                    offer.listing.sellerId,
                    sellerNotification,
                );
            } catch (error) {
                console.error(
                    'Failed to notify seller after offer acceptance:',
                    error,
                );
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
                OR: [
                    { status: 'PENDING' },
                    { status: 'COUNTERED', lastCounteredBy: 'BUYER' },
                ],
            },
        });
    }

    /**
     * Returns the count of the buyer's outgoing offers that are COUNTERED
     * (seller sent a counter-offer and buyer needs to respond).
     */
    async getBuyerActionCount(buyerId: string): Promise<number> {
        return this.prisma.offer.count({
            where: { buyerId, status: 'COUNTERED', lastCounteredBy: 'SELLER' },
        });
    }

    // ─── Buyer: Amend a pending offer ──────────────────────────────────────

    /**
     * Amend a PENDING offer before the seller responds.
     *
     * This preserves the same Offer row/negotiation ledger instead of creating
     * a duplicate offer. The same marketplace protections as makeOffer apply:
     * the listing must still be active, the offer must be at least 70% of the
     * asking price, and it must remain strictly above another buyer's highest
     * active offer.
     */
    async amendOffer(offerId: string, buyerId: string, dto: AmendOfferDto): Promise<Offer> {
        const offer = await this.prisma.offer.findUnique({
            where: { id: offerId },
            include: {
                listing: {
                    select: {
                        id: true,
                        title: true,
                        sellerId: true,
                        status: true,
                        deletedAt: true,
                        price: true,
                    },
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
            throw new BadRequestException(
                'Only a pending offer can be amended. If the seller has countered, use the counter-offer controls instead.',
            );
        }
        if (offer.listing.deletedAt || offer.listing.status !== 'ACTIVE') {
            throw new BadRequestException('This listing is no longer active.');
        }
        if (offer.listing.sellerId === buyerId) {
            throw new ForbiddenException('You cannot make an offer on your own listing.');
        }

        const askingPrice = Number(offer.listing.price);
        const minAllowedOffer = Math.floor(askingPrice * 0.7);
        const buyerMin = dto.amountMin ?? dto.amount;
        const buyerMax = dto.amountMax ?? dto.amount;

        if (buyerMin > buyerMax) {
            throw new BadRequestException('Minimum offer amount cannot be higher than maximum offer amount.');
        }
        if (dto.amount < buyerMin || dto.amount > buyerMax) {
            throw new BadRequestException('Offer amount must be within your minimum and maximum offer range.');
        }
        if (buyerMax < minAllowedOffer) {
            throw new BadRequestException(
                `Offer must be at least £${minAllowedOffer.toLocaleString('en-GB')} (70% of the asking price).`,
            );
        }

        const highestOtherOffer = await this.prisma.offer.findFirst({
            where: {
                listingId: offer.listingId,
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

        const updated = await this.prisma.offer.update({
            where: { id: offerId },
            data: {
                amount: dto.amount,
                amountMin: buyerMin,
                amountMax: buyerMax,
                message: dto.message !== undefined ? (dto.message || null) : offer.message,
            },
        });

        if (offer.listing.sellerId) {
            try {
                const notification = await this.notificationsService.create({
                    userId: offer.listing.sellerId,
                    type: 'OFFER_AMENDED',
                    title: 'Offer Updated',
                    message: `A buyer updated their offer on "${offer.listing.title}" to £${Number(dto.amount).toLocaleString('en-GB')}.`,
                    link: '/dashboard/seller/offers',
                    entityType: 'OFFER',
                    entityId: offer.id,
                    actionType: 'AMENDED',
                    data: { listingId: offer.listingId, offerId: offer.id },
                });
                this.notificationsGateway.sendNotification(offer.listing.sellerId, notification);
            } catch (error) {
                console.error('[OffersService] Failed to notify seller of amended offer:', error);
            }
        }

        return updated;
    }

    // ─── Buyer: Withdraw an offer ───────────────────────────────────────────

    /**
     * Withdraw an active offer. Only the buyer who submitted it may withdraw.
     * PENDING and COUNTERED negotiations can be cancelled; closed offers cannot.
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

        if (!['PENDING', 'COUNTERED'].includes(offer.status)) {
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

                // Email the seller when buyer accepts counter — same "Offer
                // accepted" toggle as the buyer-side acceptance email above.
                if (prismaStatus === 'ACCEPTED' && offer.counterAmount && await this.notificationsService.shouldSendEmail(offer.listing.sellerId, 'OFFER_ACCEPTED')) {
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
                        status: true,
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
