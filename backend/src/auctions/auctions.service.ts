import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    forwardRef,
    Inject,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuctionGateway, AuctionEndPayload } from './auction.gateway';
import { EmailService } from '../email/email.service';
import { ChatService } from '../chat/chat.service';
import { HandoverDocumentsService } from './handover-documents.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { UpdateAuctionDigestDto } from './dto/update-auction-digest.dto';
import { Auction, Prisma, ServiceType, ServiceJobStatus, InspectionOutcome } from '@prisma/client';
import { AUCTION_DURATION_MS, calculateFirstOfferFloor, calculatePlatformOpeningBid } from './auction-pricing';
import { getListingSubmissionReadiness } from '../listings/listing-readiness';
import { PaymentsService } from '../payments/payments.service';
import {
    assertDealerPermission,
    DealerPermission,
    resolveBusinessBuyerId,
    resolveDealerActor,
} from '../dealers/dealer-access';

const ANTI_SNIPE_MINUTES = 3;
// Grace window a declared winner has to pay the £125 buyer fee before the win
// auto-reverts — see UnpaidAuctionFeeExpiryService.
const BUYER_FEE_GRACE_MS = 72 * 60 * 60 * 1000; // 72 hours

export interface RetailDealAuctionCancellation {
    auctionId: string;
    bidderIds: string[];
    listingTitle: string;
}

@Injectable()
export class AuctionsService {
    private readonly logger = new Logger(AuctionsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        @Inject(forwardRef(() => AuctionGateway))
        private readonly auctionGateway: AuctionGateway,
        private readonly emailService: EmailService,
        @Inject(forwardRef(() => ChatService))
        private readonly chatService: ChatService,
        private readonly handoverDocuments: HandoverDocumentsService,
        private readonly paymentsService: PaymentsService,
    ) { }

    private trackAuctionEvent(
        type: string,
        payload: Record<string, unknown>,
        userId?: string,
    ): void {
        const analyticsEvent = (this.prisma as any).analyticsEvent;
        if (!analyticsEvent?.create) return;

        analyticsEvent.create({
            data: {
                type,
                payload,
                userId: userId ?? null,
            },
        }).catch(() => {
            // Analytics must never fail an auction state transition.
        });
    }

    private async resolveSellerBusinessId(
        userId: string,
        permission: Extract<DealerPermission, 'VIEW_INVENTORY' | 'MANAGE_INVENTORY'>,
    ): Promise<string> {
        const actor = await resolveDealerActor(this.prisma, userId);
        if (!actor) return userId;

        assertDealerPermission(
            actor,
            permission,
            permission === 'VIEW_INVENTORY'
                ? 'Your dealership role does not allow auction inventory access.'
                : 'Your dealership role does not allow auction changes.',
        );
        return actor.ownerUserId;
    }

    private async resolveBuyerBusinessId(
        userId: string,
        permission?: Extract<
            DealerPermission,
            'VIEW_TRADE' | 'PLACE_BID' | 'VIEW_PURCHASES' | 'PAY_AUCTION_FEE'
        >,
    ): Promise<string> {
        const actor = await resolveDealerActor(this.prisma, userId);
        if (!actor) return userId;

        if (permission) {
            assertDealerPermission(
                actor,
                permission,
                'Your dealership role does not allow this auction purchase action.',
            );
        }
        return actor.ownerUserId;
    }

    async create(createAuctionDto: CreateAuctionDto, userId: string): Promise<Auction> {
        const sellerId = await this.resolveSellerBusinessId(userId, 'MANAGE_INVENTORY');
        const now = new Date();
        const startTime = new Date(createAuctionDto.startTime);

        // Allow immediate start with a small clock-skew tolerance.
        if (Number.isNaN(startTime.getTime()) || startTime.getTime() < now.getTime() - 60 * 1000) {
            throw new BadRequestException('Start time cannot be in the past');
        }

        const endTime = new Date(startTime.getTime() + AUCTION_DURATION_MS);

        const listing = await this.prisma.listing.findUnique({
            where: { id: createAuctionDto.listingId },
        });

        if (!listing || listing.deletedAt) {
            throw new NotFoundException('Listing not found');
        }
        if (listing.sellerId !== sellerId) {
            throw new ForbiddenException('You do not own this listing');
        }
        if (listing.status === 'SOLD') {
            throw new BadRequestException('This listing has already been sold');
        }

        const existing = await this.prisma.auction.findUnique({
            where: { listingId: createAuctionDto.listingId },
        });

        // Reserve-not-met legacy auctions were historically converted to a
        // DRAFT CLASSIFIED shell. Reuse only that proven ended/cancelled auction
        // record; an arbitrary retail draft still belongs in the linked-auction flow.
        const isReauctionableRetailDraft = (
            listing.type === 'CLASSIFIED'
            && listing.status === 'DRAFT'
            && !!existing
            && !existing.deletedAt
            && ['ENDED', 'CANCELLED'].includes(existing.status)
            && !existing.winnerId
        );

        if (listing.type !== 'AUCTION' && !isReauctionableRetailDraft) {
            throw new BadRequestException(
                'This endpoint only schedules an AUCTION listing. Use the linked-auction flow to auction a retail listing.',
            );
        }

        if (existing && !existing.deletedAt && existing.status !== 'ENDED' && existing.status !== 'CANCELLED') {
            throw new BadRequestException('An auction already exists for this listing');
        }

        const normaliseVrm = (value: string | null | undefined) =>
            (value ?? '').replace(/\s/g, '').toUpperCase();

        // Linked auctions reuse the HPI request from their active retail source.
        // New reserve-not-met records now retain that link. For legacy records
        // whose link was previously erased, recover exactly one unlinked ACTIVE
        // retail sibling with the same seller+VRM and re-establish the reciprocal
        // relationship atomically when the auction is restarted.
        let linkedRetailSource: any = null;
        let shouldHealLegacyLink = false;

        if (listing.linkedListingId) {
            linkedRetailSource = await this.prisma.listing.findUnique({
                where: { id: listing.linkedListingId },
                include: { hpiReport: { select: { id: true } } },
            });
            if (
                !linkedRetailSource
                || linkedRetailSource.deletedAt
                || linkedRetailSource.type !== 'CLASSIFIED'
                || linkedRetailSource.status !== 'ACTIVE'
                || linkedRetailSource.sellerId !== sellerId
                || linkedRetailSource.linkedListingId !== listing.id
            ) {
                throw new BadRequestException(
                    'The linked retail listing is no longer active and correctly paired with this auction. Refresh the vehicle before re-auctioning.',
                );
            }
        } else if (isReauctionableRetailDraft && normaliseVrm(listing.vrm)) {
            const candidates = await this.prisma.listing.findMany({
                where: {
                    id: { not: listing.id },
                    sellerId,
                    type: 'CLASSIFIED',
                    status: 'ACTIVE',
                    deletedAt: null,
                    linkedListingId: null,
                },
                include: { hpiReport: { select: { id: true } } },
            });
            const sameVehicle = candidates.filter(
                (candidate: any) => normaliseVrm(candidate.vrm) === normaliseVrm(listing.vrm),
            );
            if (sameVehicle.length === 1) {
                linkedRetailSource = sameVehicle[0];
                shouldHealLegacyLink = true;
            }
        }

        // This endpoint is a submission path used by seller auction dashboards.
        // It must enforce the same completeness/HPI contract as publishListing()
        // before it can move anything into the admin review queue.
        const ownHpi = await this.prisma.hpiReport.findUnique({
            where: { listingId: listing.id },
            select: { id: true },
        });
        const readiness = getListingSubmissionReadiness(listing, {
            hasRequiredHpi: Boolean(ownHpi || linkedRetailSource?.hpiReport),
        });
        if (readiness.missingFields.length > 0) {
            throw new BadRequestException(
                `Listing is not ready to submit. Missing: ${readiness.missingFields.join(', ')}.`,
            );
        }
        if (readiness.missingHpi) {
            throw new BadRequestException(
                'A CarMazium vehicle history (HPI) report must be requested before this auction can be submitted.',
            );
        }

        const marketValue = Number(listing.price);
        if (!Number.isFinite(marketValue) || marketValue <= 0) {
            throw new BadRequestException('A valid Estimated Market Value is required before this vehicle can be auctioned');
        }
        const platformStartingBid = calculatePlatformOpeningBid(marketValue);
        const needsReview = listing.status !== 'PENDING_REVIEW';

        let auction: Auction;

        if (existing) {
            const archivedAt = new Date();
            auction = await this.prisma.$transaction(async (tx) => {
                if (shouldHealLegacyLink && linkedRetailSource) {
                    const claimed = await tx.listing.updateMany({
                        where: {
                            id: linkedRetailSource.id,
                            sellerId,
                            type: 'CLASSIFIED',
                            status: 'ACTIVE',
                            deletedAt: null,
                            linkedListingId: null,
                        },
                        data: { linkedListingId: listing.id },
                    });
                    if (claimed.count !== 1) {
                        throw new BadRequestException(
                            'The retail listing changed while this auction was being restarted. Refresh and try again.',
                        );
                    }
                }

                await tx.listing.update({
                    where: { id: createAuctionDto.listingId },
                    data: {
                        status: 'PENDING_REVIEW',
                        rejectionReason: null,
                        ...(isReauctionableRetailDraft ? { type: 'AUCTION' as const } : {}),
                        ...(shouldHealLegacyLink && linkedRetailSource
                            ? { linkedListingId: linkedRetailSource.id }
                            : {}),
                    },
                });
                await tx.bid.updateMany({
                    where: {
                        listingId: createAuctionDto.listingId,
                        deletedAt: null,
                        archivedAt: null,
                    },
                    data: { archivedAt },
                });
                return tx.auction.update({
                    where: { id: existing.id },
                    data: {
                        startTime,
                        endTime,
                        reservePrice: createAuctionDto.reservePrice,
                        startingBid: platformStartingBid,
                        minIncrement: createAuctionDto.minIncrement,
                        buyItNowPrice: createAuctionDto.buyItNowPrice ?? null,
                        status: 'SCHEDULED',
                        deletedAt: null,
                        winnerId: null,
                        winningBidAmount: null,
                        wonAt: null,
                        buyerFeePaid: false,
                        buyerFeeTransactionId: null,
                        handoverProofUrl: null,
                        handoverSubmittedAt: null,
                        sellerBonusReleased: false,
                        sellerBonusReleasedAt: null,
                        buyItNowPendingBuyerId: null,
                        buyItNowPendingAt: null,
                    },
                });
            });
        } else {
            auction = await this.prisma.$transaction(async (tx) => {
                await tx.listing.update({
                    where: { id: createAuctionDto.listingId },
                    data: {
                        status: 'PENDING_REVIEW',
                        rejectionReason: null,
                    },
                });
                return tx.auction.create({
                    data: {
                        listingId: createAuctionDto.listingId,
                        startTime,
                        endTime,
                        reservePrice: createAuctionDto.reservePrice,
                        startingBid: platformStartingBid,
                        minIncrement: createAuctionDto.minIncrement,
                        buyItNowPrice: createAuctionDto.buyItNowPrice ?? null,
                        status: 'SCHEDULED',
                    },
                });
            });
        }

        if (needsReview) {
            this.notifyAuctionSubmittedForReview(listing.id, listing.title, listing.sellerId).catch(() => { });
        }

        return auction;
    }

    private async notifyAuctionSubmittedForReview(listingId: string, listingTitle: string, sellerId: string | null): Promise<void> {
        if (!sellerId) return;
        const notification = await this.notificationsService.create({
            userId: sellerId,
            type: 'LISTING_SUBMITTED',
            title: 'Auction Submitted for Review',
            message: `"${listingTitle}" has been submitted and is awaiting admin review before the auction goes live.`,
            link: '/dashboard/seller/auctions',
            entityType: 'Listing',
            entityId: listingId,
            actionType: 'SUBMITTED',
        }).catch(() => null);
    }

    async findAllActive(): Promise<any[]> {
        return this.prisma.auction.findMany({
            // listing.status filter is defense-in-depth — the activation cron
            // already only flips SCHEDULED -> ACTIVE for approved listings.
            where: { status: 'ACTIVE', deletedAt: null, listing: { status: 'ACTIVE' } },
            include: {
                listing: {
                    include: {
                        seller: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                dealerProfile: { select: { companyName: true, logo: true } },
                                sellerProfile: { select: { reliabilityScore: true } },
                            },
                        },
                        bids: {
                            where: { deletedAt: null, cancelledAt: null, archivedAt: null },
                            orderBy: { amount: 'desc' },
                            take: 1,
                            select: { amount: true },
                        },
                        _count: { select: { bids: { where: { deletedAt: null, cancelledAt: null, archivedAt: null } } } },
                    },
                },
            },
            orderBy: { endTime: 'asc' },
        });
    }

    async findAllScheduled(page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
        const skip = (page - 1) * limit;
        // Only surface auctions whose listing has cleared admin review — a
        // SCHEDULED auction still sitting on a PENDING_REVIEW/REJECTED listing
        // isn't approved yet and shouldn't show in the public "Upcoming" tab.
        const where = { status: 'SCHEDULED' as const, deletedAt: null, listing: { status: 'ACTIVE' as const } };
        const [data, total] = await Promise.all([
            this.prisma.auction.findMany({
                where,
                include: {
                    listing: {
                        include: {
                            seller: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    dealerProfile: { select: { companyName: true, logo: true } },
                                    sellerProfile: { select: { reliabilityScore: true } },
                                },
                            },
                            _count: { select: { bids: { where: { deletedAt: null, cancelledAt: null, archivedAt: null } } } },
                        },
                    },
                },
                orderBy: { startTime: 'asc' },
                skip,
                take: limit,
            }),
            this.prisma.auction.count({ where }),
        ]);
        // Private proof keys become short-lived signed URLs; the key itself
        // never leaves the server.
        return { data: await this.handoverDocuments.hydrateMany(data), total };
    }

    /**
     * `viewerId` is only present when the caller is authenticated (via
     * OptionalSessionAuthGuard). Unlike ListingsService.findBySlug (a "log in
     * to view" gate), every seller contact detail here — phone, email,
     * business address, website — is withheld from the response payload
     * until the viewer has won this specific auction AND paid the buyer fee;
     * only an `*Available` boolean is sent otherwise, for the frontend to
     * render a locked/blurred placeholder.
     */
    async findOne(id: string, viewerId?: string): Promise<any> {
        const auction = await this.prisma.auction.findUnique({
            where: { id },
            include: {
                listing: {
                    include: {
                        seller: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                phone: true,
                                dealerProfile: { select: { companyName: true, logo: true, businessAddress: true, website: true, phone: true } },
                            },
                        },
                        bids: {
                            where: { deletedAt: null, cancelledAt: null, archivedAt: null },
                            orderBy: { amount: 'desc' },
                            take: 50,
                            include: {
                                bidder: { select: { id: true, firstName: true, lastName: true } },
                            },
                        },
                        // Bidders should be able to see the report before they bid,
                        // not just after winning — same "inspect before bidding"
                        // principle as the damage/condition viewer already gives
                        // every listing. Not contact-gated: an HPI report isn't
                        // personal data the way the seller's phone/email is.
                        hpiReport: { select: { status: true, isClear: true } },
                    },
                },
                winner: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        if (!auction || auction.deletedAt) {
            throw new NotFoundException(`Auction not found`);
        }

        const seller = auction.listing?.seller as any;
        if (seller) {
            const viewerBusinessId = viewerId
                ? await resolveBusinessBuyerId(this.prisma, viewerId)
                : null;
            const canSeeContactDetails =
                !!viewerBusinessId
                && viewerBusinessId === auction.winnerId
                && !!auction.buyerFeePaid;
            (auction.listing as any).seller = this.gateSellerContactDetails(seller, canSeeContactDetails);
        }

        return this.clearExpiredBin(auction);
    }

    async findMyAuctions(userId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
        const sellerId = await this.resolveSellerBusinessId(userId, 'VIEW_INVENTORY');
        const skip = (page - 1) * limit;
        const where = { deletedAt: null, listing: { sellerId } };
        const [data, total] = await Promise.all([
            this.prisma.auction.findMany({
                where,
                include: {
                    listing: {
                        include: {
                            bids: {
                                where: { deletedAt: null, cancelledAt: null, archivedAt: null },
                                orderBy: { amount: 'desc' },
                                take: 1,
                                select: { amount: true },
                            },
                            _count: { select: { bids: { where: { deletedAt: null, cancelledAt: null, archivedAt: null } } } },
                            linkedListing: { select: { id: true, status: true, badgeTier: true } },
                        },
                    },
                    winner: { select: { id: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.auction.count({ where }),
        ]);
        return { data, total };
    }

    /**
     * Strips every seller contact detail unless the viewer has earned them.
     *
     * "Earned" means: they won this specific auction AND paid the £125 buyer
     * fee. Logging in is not enough, and neither is merely winning — the fee
     * is what unlocks contact, and this is the only thing enforcing that.
     *
     * Shared by findOne() and findWonAuctions() deliberately. They used to
     * gate separately and drifted: the list view only ever nulled `phone`, so
     * a winner who hadn't paid still received the seller's EMAIL (plus the
     * dealer's business address and website) in the API response, and the
     * won-auctions page rendered the email straight onto the "Pay the £125
     * fee to unlock messaging" card. Any new route that returns a seller must
     * call this rather than hand-rolling the check again.
     *
     * The `*Available` booleans exist so the UI can show a locked-state
     * affordance ("this seller has a phone number") without leaking the value.
     */
    private gateSellerContactDetails(seller: any, canSeeContactDetails: boolean) {
        if (!seller) return seller;
        return {
            ...seller,
            phone: canSeeContactDetails ? seller.phone : null,
            phoneAvailable: !!seller.phone,
            email: canSeeContactDetails ? seller.email : null,
            emailAvailable: !!seller.email,
            ...(seller.dealerProfile ? {
                dealerProfile: {
                    ...seller.dealerProfile,
                    phone: canSeeContactDetails ? seller.dealerProfile.phone : null,
                    phoneAvailable: !!seller.dealerProfile.phone,
                    businessAddress: canSeeContactDetails ? seller.dealerProfile.businessAddress : null,
                    businessAddressAvailable: !!seller.dealerProfile.businessAddress,
                    website: canSeeContactDetails ? seller.dealerProfile.website : null,
                    websiteAvailable: !!seller.dealerProfile.website,
                },
            } : {}),
        };
    }

    // Auctions the current user WON as a bidder — distinct from findMyAuctions
    // above, which is scoped to auctions the user SOLD. Mobile's Auctions tab
    // previously only ever showed the seller-side list; won-auction purchases
    // were only discoverable via the separate, generic Purchases screen (Sale
    // records, no auction-specific fields). Added for mobile-production-
    // readiness-plan.md F43. Includes `listing.seller` (unlike findMyAuctions,
    // which has no reason to — the buyer needs to know who to contact).
    async findWonAuctions(userId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
        const buyerId = await this.resolveBuyerBusinessId(userId, 'VIEW_PURCHASES');
        const skip = (page - 1) * limit;
        const where = { deletedAt: null, winnerId: buyerId };
        const [data, total] = await Promise.all([
            this.prisma.auction.findMany({
                where,
                include: {
                    listing: {
                        include: {
                            bids: {
                                where: { deletedAt: null, cancelledAt: null, archivedAt: null },
                                orderBy: { amount: 'desc' },
                                take: 1,
                                select: { amount: true },
                            },
                            _count: { select: { bids: { where: { deletedAt: null, cancelledAt: null, archivedAt: null } } } },
                            // Winner-only query (where: winnerId = the requesting user), so unlike
                            // findOne/findAllActive it's safe to include direct contact details here
                            // — matches the same phone/email exposure already used for completed
                            // retail purchases in dealers.service.ts::getDealerPurchases.
                            seller: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    email: true,
                                    phone: true,
                                    dealerProfile: { select: { companyName: true, logo: true, businessAddress: true } },
                                },
                            },
                            // Only present if the seller purchased a report — same "if it has
                            // any" gating already used everywhere else HPI data is shown.
                            hpiReport: { select: { status: true, isClear: true } },
                        },
                    },
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.auction.count({ where }),
        ]);

        // Same fee gate as findOne(), via the same helper. This list is shown
        // to the winner BEFORE they pay, so every contact detail — not just the
        // phone number, which is all this used to null — has to be withheld
        // until buyerFeePaid. `where` already scopes to winnerId === userId, so
        // reaching this row is itself proof the viewer won it.
        const gated = data.map((auction: any) => {
            if (auction.listing?.seller) {
                auction.listing = {
                    ...auction.listing,
                    seller: this.gateSellerContactDetails(auction.listing.seller, !!auction.buyerFeePaid),
                };
            }
            return auction;
        });

        return { data: gated, total };
    }

    async update(id: string, updateAuctionDto: UpdateAuctionDto, userId: string): Promise<Auction> {
        const sellerId = await this.resolveSellerBusinessId(userId, 'MANAGE_INVENTORY');
        const auction = await this.findOne(id);

        if (auction.listing.sellerId !== sellerId) {
            throw new ForbiddenException('You do not own this auction');
        }

        if (auction.status !== 'SCHEDULED') {
            throw new BadRequestException('Only SCHEDULED auctions can be updated');
        }

        const startTime = updateAuctionDto.startTime
            ? new Date(updateAuctionDto.startTime)
            : auction.startTime;

        if (
            Number.isNaN(startTime.getTime())
            || startTime.getTime() < Date.now() - 60 * 1000
        ) {
            throw new BadRequestException('Start time cannot be in the past');
        }

        const endTime = new Date(startTime.getTime() + AUCTION_DURATION_MS);
        const platformStartingBid = calculatePlatformOpeningBid(Number(auction.listing.price));

        return this.prisma.auction.update({
            where: { id },
            data: {
                startTime,
                endTime,
                ...(updateAuctionDto.reservePrice !== undefined && { reservePrice: updateAuctionDto.reservePrice }),
                // Keep scheduled auctions aligned with the same server-owned
                // 70%-of-market-value opening rule as newly created auctions.
                startingBid: platformStartingBid,
                ...(updateAuctionDto.minIncrement !== undefined && { minIncrement: updateAuctionDto.minIncrement }),
                ...(updateAuctionDto.buyItNowPrice !== undefined && { buyItNowPrice: updateAuctionDto.buyItNowPrice }),
            },
        });
    }

    // Digest — seller-authored custom tags/batch labels and self-rating for their own
    // auction listing. Editable any time before the auction ends, unlike update() which
    // is restricted to SCHEDULED auctions since it recalculates timing/pricing.
    async updateDigest(id: string, dto: UpdateAuctionDigestDto, userId: string): Promise<Auction> {
        const sellerId = await this.resolveSellerBusinessId(userId, 'MANAGE_INVENTORY');
        const auction = await this.findOne(id);

        if (auction.listing.sellerId !== sellerId) {
            throw new ForbiddenException('You do not own this auction');
        }

        if (auction.status === 'ENDED' || auction.status === 'CANCELLED') {
            throw new BadRequestException('Cannot edit the digest of an ended or cancelled auction');
        }

        return this.prisma.auction.update({
            where: { id },
            data: {
                ...(dto.customTags !== undefined && { customTags: dto.customTags }),
                ...(dto.sellerSelfRating !== undefined && { sellerSelfRating: dto.sellerSelfRating }),
            },
        });
    }

    async cancel(id: string, userId: string): Promise<Auction> {
        const sellerId = await this.resolveSellerBusinessId(userId, 'MANAGE_INVENTORY');
        const auction = await this.findOne(id);

        if (auction.listing.sellerId !== sellerId) {
            throw new ForbiddenException('You do not own this auction');
        }

        if (auction.status !== 'SCHEDULED') {
            throw new BadRequestException('Only SCHEDULED auctions can be cancelled');
        }

        // Clear the auction and its review/live state atomically. A cancelled
        // AUCTION listing must not remain ACTIVE or PENDING_REVIEW with no live
        // auction behind it. The seller can reschedule the same row later.
        const classifiedId = (auction.listing as any).linkedListingId as string | null;
        const operations: any[] = [
            this.prisma.auction.update({
                where: { id },
                data: {
                    status: 'CANCELLED',
                    buyItNowPendingBuyerId: null,
                    buyItNowPendingAt: null,
                },
            }),
            this.prisma.listing.update({
                where: { id: auction.listingId },
                data: {
                    status: 'DRAFT',
                    linkedListingId: null,
                    ...(classifiedId ? { deletedAt: new Date() } : {}),
                } as any,
            }),
        ];
        if (classifiedId) {
            operations.push(this.prisma.listing.update({
                where: { id: classifiedId },
                data: { linkedListingId: null } as any,
            }));
        }

        const [cancelled] = await this.prisma.$transaction(operations);
        return cancelled;
    }

    /**
     * Cancel a linked auction because the same vehicle has entered a retail
     * sale-pending state. When a transaction client is supplied, all database
     * changes participate in the caller's transaction; realtime/push side
     * effects are deliberately published only after that transaction commits.
     */
    async cancelLinkedAuctionForRetailDeal(
        auctionListingId: string,
        retailListingId: string,
        tx?: Prisma.TransactionClient,
    ): Promise<RetailDealAuctionCancellation | null> {
        const db: any = tx ?? this.prisma;

        const auction = await db.auction.findFirst({
            where: {
                listingId: auctionListingId,
                status: { in: ['ACTIVE', 'SCHEDULED'] },
                deletedAt: null,
            },
            select: {
                id: true,
                listing: { select: { title: true } },
            },
        });

        const bidderRows = auction
            ? await db.bid.findMany({
                where: {
                    listingId: auctionListingId,
                    deletedAt: null,
                    cancelledAt: null,
                    archivedAt: null,
                },
                distinct: ['bidderId'],
                select: { bidderId: true },
            })
            : [];

        // Break the dual-channel relationship whether or not the auction is
        // still live. A retail acceptance owns the vehicle from this point.
        await db.listing.updateMany({
            where: { id: { in: [retailListingId, auctionListingId] } },
            data: { linkedListingId: null },
        });

        if (!auction) return null;

        await db.auction.update({
            where: { id: auction.id },
            data: {
                status: 'CANCELLED',
                buyItNowPendingBuyerId: null,
                buyItNowPendingAt: null,
            },
        });

        await db.listing.update({
            where: { id: auctionListingId },
            data: {
                status: 'DRAFT',
                linkedListingId: null,
                deletedAt: new Date(),
            },
        });

        return {
            auctionId: auction.id,
            bidderIds: bidderRows.map((row: any) => row.bidderId),
            listingTitle: auction.listing?.title ?? 'this vehicle',
        };
    }

    /**
     * Realtime and persisted notifications for a retail-deal auction
     * cancellation. Call only after the surrounding database transaction has
     * committed successfully.
     */
    async publishRetailDealAuctionCancellation(
        cancellation: RetailDealAuctionCancellation | null,
    ): Promise<void> {
        if (!cancellation) return;

        this.auctionGateway.broadcastAuctionEnd(cancellation.auctionId, {
            auctionId: cancellation.auctionId,
            winnerId: null,
            winningBidAmount: null,
            reserveMet: false,
        });

        for (const bidderId of cancellation.bidderIds) {
            try {
                const notification = await this.notificationsService.create({
                    userId: bidderId,
                    type: 'AUCTION_CANCELLED',
                    title: 'Auction Closed',
                    message: `The auction for "${cancellation.listingTitle}" has closed because the vehicle is now sale pending through a retail offer.`,
                    link: '/dashboard/dealer/my-offers',
                    entityType: 'AUCTION',
                    entityId: cancellation.auctionId,
                    actionType: 'CANCELLED',
                });
            } catch (error) {
                console.error('[AuctionsService] Failed to notify bidder of retail-deal cancellation:', error);
            }
        }
    }

    async sellerClose(auctionId: string, userId: string): Promise<void> {
        const sellerId = await this.resolveSellerBusinessId(userId, 'MANAGE_INVENTORY');

        // Ownership, ACTIVE state and reserve status are revalidated under the
        // same per-listing lock used by bidding. A seller therefore cannot close
        // "without sale" while a simultaneous dealer bid has just met reserve.
        await this.closeAuction(auctionId, {
            sellerEarlyClose: true,
            sellerId,
        });
    }

    async acceptBid(auctionId: string, bidId: string, sellerId: string): Promise<void> {
        const businessSellerId = await this.resolveSellerBusinessId(sellerId, 'MANAGE_INVENTORY');

        const lookup = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            select: { listingId: true, deletedAt: true },
        });
        if (!lookup || lookup.deletedAt) {
            throw new NotFoundException('Auction not found');
        }

        const accepted = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lookup.listingId}, 0))`;

            const auction = await tx.auction.findUnique({
                where: { id: auctionId },
                include: {
                    listing: {
                        select: {
                            id: true,
                            title: true,
                            sellerId: true,
                            linkedListingId: true,
                            year: true,
                            make: true,
                            model: true,
                        },
                    },
                },
            });

            if (!auction || auction.deletedAt) {
                throw new NotFoundException('Auction not found');
            }
            if (auction.listing.sellerId !== businessSellerId) {
                throw new ForbiddenException('You do not own this auction');
            }
            if (auction.status !== 'ACTIVE') {
                throw new BadRequestException('Only ACTIVE auctions can have a bid accepted');
            }

            const [bid, highestBid] = await Promise.all([
                tx.bid.findUnique({ where: { id: bidId } }),
                tx.bid.findFirst({
                    where: {
                        listingId: auction.listingId,
                        deletedAt: null,
                        cancelledAt: null,
                        archivedAt: null,
                    },
                    orderBy: { amount: 'desc' },
                }),
            ]);

            if (!bid || bid.listingId !== auction.listingId || bid.deletedAt || bid.cancelledAt || bid.archivedAt) {
                throw new NotFoundException('Bid not found in this auction');
            }
            if (!highestBid || highestBid.id !== bid.id) {
                throw new BadRequestException(
                    'Only the current highest bid can be accepted. Refresh the auction and accept the latest offer.',
                );
            }

            const winningAmount = Number(bid.amount);
            const reservePrice = Number(auction.reservePrice);
            if (winningAmount >= reservePrice) {
                throw new BadRequestException(
                    'The reserve has been met. The auction must continue normally until it ends.',
                );
            }

            const winnerId = bid.bidderId;
            const linkedListingId = auction.listing.linkedListingId;
            const wonAt = new Date();

            await tx.auction.update({
                where: { id: auctionId },
                data: {
                    status: 'ENDED',
                    winnerId,
                    winningBidAmount: bid.amount,
                    wonAt,
                    buyItNowPendingBuyerId: null,
                    buyItNowPendingAt: null,
                },
            });
            await tx.listing.update({
                where: { id: auction.listingId },
                data: { status: 'SOLD' },
            });
            if (linkedListingId) {
                await tx.listing.update({
                    where: { id: linkedListingId },
                    data: { status: 'SOLD' },
                });
            }
            await tx.sale.create({
                data: {
                    listingId: auction.listingId,
                    sellerId: businessSellerId,
                    buyerId: winnerId,
                    soldPrice: bid.amount,
                },
            });
            await tx.sellerProfile.upsert({
                where: { userId: businessSellerId },
                create: { userId: businessSellerId, totalSales: 1 },
                update: { totalSales: { increment: 1 } },
            });

            return {
                auction,
                winnerId,
                winningAmount,
            };
        });

        // The existing reserveMet=true payload is also the successful-sale
        // signal consumed by the web/native end banners. Here the seller has
        // explicitly accepted a below-reserve offer, so there is a valid winner
        // even though the numerical reserve itself was not reached.
        const acceptedReserve = Number(accepted.auction.reservePrice);
        const acceptedStartingBid = Number(accepted.auction.startingBid);
        this.trackAuctionEvent('auction_offer_accepted', {
            auction_id: auctionId,
            listing_id: accepted.auction.listingId,
            winner_id: accepted.winnerId,
            amount: accepted.winningAmount,
            reserve_price: acceptedReserve,
            starting_bid: acceptedStartingBid,
            percent_below_reserve: acceptedReserve > 0
                ? Math.max(0, Math.round(((acceptedReserve - accepted.winningAmount) / acceptedReserve) * 1000) / 10)
                : 0,
            percent_below_starting_bid: acceptedStartingBid > 0
                ? Math.max(0, Math.round(((acceptedStartingBid - accepted.winningAmount) / acceptedStartingBid) * 1000) / 10)
                : 0,
            outcome: 'SELLER_ACCEPTED_BELOW_RESERVE',
        }, businessSellerId);
        this.trackAuctionEvent('auction_outcome', {
            auction_id: auctionId,
            listing_id: accepted.auction.listingId,
            outcome: 'SELLER_ACCEPTED_BELOW_RESERVE',
            winner_id: accepted.winnerId,
            winning_amount: accepted.winningAmount,
            reserve_price: acceptedReserve,
            starting_bid: acceptedStartingBid,
            had_real_bids: true,
        });

        const endPayload: AuctionEndPayload = {
            auctionId,
            winnerId: accepted.winnerId,
            winningBidAmount: accepted.winningAmount,
            reserveMet: true,
        };
        this.auctionGateway.broadcastAuctionEnd(auctionId, endPayload);
        await this.notifyAuctionEnd(
            accepted.auction,
            accepted.winnerId,
            accepted.winningAmount,
            true,
        );
    }

    /**
     * Admin correction for an auction reserve entered incorrectly by the seller.
     *
     * Safety rules:
     * - only SCHEDULED or ACTIVE auctions can be corrected;
     * - existing bids are never edited;
     * - once the reserve has been met, an admin cannot raise it above the
     *   current highest bid and retroactively make the reserve unmet;
     * - reserve cannot exceed an existing Buy It Now price.
     *
     * Lowering a reserve below the current top bid is allowed. In that case the
     * reserve becomes met immediately and any pending Buy It Now request is
     * cleared because the normal auction should now run to its end.
     */
    async adminCorrectReservePrice(
        auctionId: string,
        reservePrice: number,
        reason?: string,
    ): Promise<Auction> {
        if (!Number.isFinite(reservePrice) || reservePrice <= 0) {
            throw new BadRequestException('Reserve price must be greater than £0');
        }

        // Read only the listing key up front. The actual validation and update
        // are repeated inside the same per-listing advisory lock used by bid
        // placement, so a dealer's first offer cannot race an admin reserve
        // correction and be validated against stale pricing.
        const lookup = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            select: { listingId: true, deletedAt: true },
        });
        if (!lookup || lookup.deletedAt) {
            throw new NotFoundException('Auction not found');
        }

        const correction = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lookup.listingId}, 0))`;

            const auction = await tx.auction.findUnique({
                where: { id: auctionId },
                include: {
                    listing: {
                        select: {
                            id: true,
                            title: true,
                            sellerId: true,
                        },
                    },
                },
            });

            if (!auction || auction.deletedAt) {
                throw new NotFoundException('Auction not found');
            }
            if (auction.status !== 'SCHEDULED' && auction.status !== 'ACTIVE') {
                throw new BadRequestException('Only SCHEDULED or ACTIVE auctions can have their reserve corrected');
            }
            if (auction.buyItNowPrice != null && reservePrice > Number(auction.buyItNowPrice)) {
                throw new BadRequestException('Reserve price cannot be higher than the Buy It Now price');
            }

            const [topBid, activeBidCount] = await Promise.all([
                tx.bid.findFirst({
                    where: {
                        listingId: auction.listingId,
                        deletedAt: null,
                        cancelledAt: null,
                        archivedAt: null,
                    },
                    orderBy: { amount: 'desc' },
                    select: { amount: true },
                }),
                tx.bid.count({
                    where: {
                        listingId: auction.listingId,
                        deletedAt: null,
                        cancelledAt: null,
                        archivedAt: null,
                    },
                }),
            ]);

            const oldReserve = Number(auction.reservePrice);
            const topBidAmount = topBid ? Number(topBid.amount) : null;
            const reserveWasMet = topBidAmount !== null && topBidAmount >= oldReserve;
            const reserveWillBeMet = topBidAmount !== null && topBidAmount >= reservePrice;

            if (auction.status === 'ACTIVE' && reserveWasMet && !reserveWillBeMet) {
                throw new BadRequestException(
                    'The reserve has already been met. It cannot be raised above the current highest bid.',
                );
            }

            const updated = await tx.auction.update({
                where: { id: auctionId },
                data: {
                    reservePrice,
                    ...(reserveWillBeMet && {
                        buyItNowPendingBuyerId: null,
                        buyItNowPendingAt: null,
                    }),
                },
            });

            const firstOfferFloor = topBidAmount === null
                ? calculateFirstOfferFloor(Number(auction.startingBid), reservePrice)
                : null;

            return {
                updated,
                listingTitle: auction.listing.title,
                sellerId: auction.listing.sellerId,
                startingBid: Number(auction.startingBid),
                minIncrement: Number(auction.minIncrement),
                oldReserve,
                topBidAmount,
                activeBidCount,
                reserveWillBeMet,
                firstOfferFloor,
            };
        });

        if (correction.sellerId) {
            const reasonText = reason?.trim() ? ` Reason: ${reason.trim()}` : '';
            const pricingText = correction.topBidAmount === null
                ? ` There are currently no active dealer bids. The starting bid remains £${correction.startingBid.toLocaleString('en-GB')} as a guide, and first offers can now be made from £${Number(correction.firstOfferFloor).toLocaleString('en-GB')}.`
                : correction.reserveWillBeMet
                    ? ` The current highest bid of £${correction.topBidAmount.toLocaleString('en-GB')} now meets the reserve. Existing bids remain unchanged and the auction continues normally.`
                    : ` The current highest bid remains £${correction.topBidAmount.toLocaleString('en-GB')}. Existing bids are unchanged; the next minimum bid remains the current highest bid plus the £${correction.minIncrement.toLocaleString('en-GB')} increment.`;

            await this.notificationsService.create({
                userId: correction.sellerId,
                type: 'AUCTION_UPDATED',
                title: 'Auction reserve corrected',
                message: `CarMazium corrected the reserve for "${correction.listingTitle}" from £${correction.oldReserve.toLocaleString('en-GB')} to £${reservePrice.toLocaleString('en-GB')}.${pricingText}${reasonText}`,
                link: '/dashboard/seller/auctions',
                entityType: 'Auction',
                entityId: auctionId,
                actionType: 'PRICE_CORRECTED',
                data: {
                    oldReserve: correction.oldReserve,
                    newReserve: reservePrice,
                    topBidAmount: correction.topBidAmount,
                    firstOfferFloor: correction.firstOfferFloor,
                    startingBid: correction.startingBid,
                    reserveMet: correction.reserveWillBeMet,
                    reason: reason?.trim() || null,
                },
            }).catch(() => null);
        }

        this.trackAuctionEvent('auction_reserve_corrected', {
            auction_id: auctionId,
            listing_id: lookup.listingId,
            old_reserve: correction.oldReserve,
            new_reserve: reservePrice,
            starting_bid: correction.startingBid,
            top_bid_amount: correction.topBidAmount,
            active_bid_count: correction.activeBidCount,
            reserve_met_after: correction.reserveWillBeMet,
            first_offer_floor_after: correction.firstOfferFloor,
            reason: reason?.trim() || null,
        });

        // Live viewers already listen for this event and refetch the canonical
        // auction. Because the correction committed before this broadcast, web
        // and native recompute the first-offer floor from the new reserve without
        // ever observing a half-written price state.
        this.auctionGateway.broadcastPriceUpdated(auctionId, reservePrice);
        return correction.updated;
    }

    /**
     * Admin override: ends a live auction immediately, assigning a specific
     * dealer as winner regardless of whether they ever bid on it. Winning
     * amount is always the Buy It Now price if one was set, otherwise the
     * reserve price — never the current top bid, since the assigned dealer
     * may not have placed one. The dealer still goes through the normal
     * £125 buyer-fee flow afterward (unchanged — endAuctionWithWinner doesn't
     * touch buyerFeePaid), same as any other winner.
     */
    async adminAssignWinner(auctionId: string, dealerId: string): Promise<void> {
        const auction = await this.findOne(auctionId);
        if (auction.status !== 'ACTIVE') {
            throw new BadRequestException('Only ACTIVE (live) auctions can have a winner assigned');
        }

        const dealer = await this.prisma.user.findUnique({ where: { id: dealerId } });
        if (!dealer || dealer.deletedAt) {
            throw new NotFoundException('Dealer not found');
        }
        if (dealer.role !== 'DEALER') {
            throw new BadRequestException('Only dealer accounts can be assigned as an auction winner');
        }

        const sellerId = auction.listing.sellerId;
        if (!sellerId) {
            throw new BadRequestException('This listing has no seller on record');
        }
        if (sellerId === dealerId) {
            throw new BadRequestException('Cannot assign the listing\'s own seller as the winning buyer');
        }

        const amount = auction.buyItNowPrice != null ? Number(auction.buyItNowPrice) : Number(auction.reservePrice);
        const linkedListingId = (auction.listing as any).linkedListingId as string | null;

        await this.endAuctionWithWinner(auctionId, dealerId, amount, sellerId, linkedListingId);
        await this.notifyAuctionEnd(auction, dealerId, amount, true);
    }

    /**
     * Called by UnpaidAuctionFeeExpiryService (hourly cron). Any ENDED auction
     * with a winner who hasn't paid the £125 buyer fee within BUYER_FEE_GRACE_MS
     * of wonAt gets unwound: the win is cancelled, the Sale record removed, the
     * listing returns to a coherent seller-controlled state, and both the
     * former winner and seller are notified. Linked auctions restore the retail
     * channel; standalone auctions return to inventory for relist/re-auction.
     */
    async revertUnpaidWins(): Promise<{ reverted: number }> {
        const cutoff = new Date(Date.now() - BUYER_FEE_GRACE_MS);
        const stale = await this.prisma.auction.findMany({
            where: {
                status: 'ENDED',
                winnerId: { not: null },
                buyerFeePaid: false,
                wonAt: { not: null, lt: cutoff },
                deletedAt: null,
            },
            include: {
                listing: { select: { id: true, title: true, sellerId: true, linkedListingId: true } },
            },
        });

        for (const auction of stale) {
            const winnerId = auction.winnerId!;
            const listing = auction.listing;

            const linkedRetailId = listing.linkedListingId;
            await this.prisma.$transaction([
                this.prisma.auction.update({
                    where: { id: auction.id },
                    data: { status: 'CANCELLED', winnerId: null, winningBidAmount: null, wonAt: null },
                }),
                this.prisma.listing.update({
                    where: { id: listing.id },
                    data: linkedRetailId
                        ? {
                            status: 'DRAFT',
                            linkedListingId: null,
                            deletedAt: new Date(),
                        } as any
                        : {
                            status: 'DRAFT',
                            type: 'CLASSIFIED',
                            linkedListingId: null,
                        } as any,
                }),
                ...(linkedRetailId ? [
                    this.prisma.listing.update({
                        where: { id: linkedRetailId },
                        data: {
                            status: 'ACTIVE',
                            linkedListingId: null,
                        } as any,
                    }),
                ] : []),
                this.prisma.sale.deleteMany({ where: { listingId: listing.id, buyerId: winnerId } }),
                ...(listing.sellerId ? [
                    this.prisma.sellerProfile.update({
                        where: { userId: listing.sellerId },
                        data: { totalSales: { decrement: 1 } },
                    }),
                ] : []),
            ]);

            await this.notificationsService.create({
                userId: winnerId,
                type: 'AUCTION_WIN_EXPIRED',
                title: 'Your auction win was cancelled',
                message: `You didn't pay the £125 buyer fee for "${listing.title}" in time, so the win was cancelled.`,
                entityType: 'AUCTION',
                entityId: auction.id,
                link: `/dashboard/dealer/auctions/won`,
            }).catch(() => {});

            if (listing.sellerId) {
                const notification = await this.notificationsService.create({
                    userId: listing.sellerId,
                    type: 'AUCTION_WIN_EXPIRED',
                    title: 'Auction sale fell through',
                    message: linkedRetailId
                        ? `The winning buyer for "${listing.title}" didn't pay the buyer fee in time. Your retail listing has been restored and the auction was cancelled.`
                        : `The winning buyer for "${listing.title}" didn't pay the buyer fee in time. The vehicle has returned to your inventory so you can relist or re-auction it.`,
                    entityType: 'AUCTION',
                    entityId: auction.id,
                    link: `/dashboard/seller/auctions`,
                }).catch(() => null);
            }

            this.auctionGateway.broadcastAuctionEnd(auction.id, {
                auctionId: auction.id,
                winnerId: null,
                winningBidAmount: null,
                reserveMet: false,
            });
        }

        return { reverted: stale.length };
    }

    /**
     * A winning buyer may refuse the vehicle only when a completed,
     * purchase-linked CarMazium inspection recorded FAULTS_FOUND. The £125
     * buyer fee is refunded in full before the sale is unwound, then the same
     * seller-restoration rules as an unpaid win return the vehicle for
     * repair/relist.
     */
    async refuseAfterInspection(
        auctionId: string,
        buyerId: string,
        reason?: string,
    ): Promise<{ refused: boolean; refundedAmount: number; inspectionJobId: string }> {
        buyerId = await this.resolveBuyerBusinessId(buyerId, 'PAY_AUCTION_FEE');
        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            include: {
                listing: {
                    select: {
                        id: true,
                        title: true,
                        sellerId: true,
                        linkedListingId: true,
                    },
                },
                serviceJobs: {
                    where: {
                        customerId: buyerId,
                        serviceType: ServiceType.INSPECTION,
                        status: { in: [ServiceJobStatus.COMPLETED, ServiceJobStatus.RELEASED] },
                        inspectionOutcome: InspectionOutcome.FAULTS_FOUND,
                    },
                    orderBy: { completedAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        inspectionSummary: true,
                        completedAt: true,
                    },
                },
            },
        });
        if (!auction || auction.deletedAt) throw new NotFoundException('Auction not found');

        if (auction.buyerRefusedAt) {
            if (auction.buyerRefusedById !== buyerId || !auction.buyerRefusalInspectionJobId) {
                throw new ForbiddenException('This auction was already refused by a different buyer.');
            }
            return {
                refused: true,
                refundedAmount: 125,
                inspectionJobId: auction.buyerRefusalInspectionJobId,
            };
        }

        if (auction.winnerId !== buyerId) throw new ForbiddenException('Only the winning buyer can refuse this vehicle.');
        if (auction.status !== 'ENDED') throw new BadRequestException('Only an ended auction can be refused after inspection.');
        if (!auction.buyerFeePaid || !auction.buyerFeeTransactionId) {
            throw new BadRequestException('The auction buyer fee has not been paid.');
        }
        if (auction.sellerBonusReleased) {
            throw new BadRequestException('Handover has already been approved and can no longer be refused.');
        }

        const inspection = auction.serviceJobs[0];
        if (!inspection) {
            throw new BadRequestException(
                'A completed CarMazium inspection with FAULTS_FOUND is required before refusing this auction purchase.',
            );
        }

        try {
            await this.paymentsService.issueFullRefundForAuctionInspection(auction.id);
        } catch (error: any) {
            const message = error?.message || 'Unknown Stripe refund error';
            await this.prisma.auction.update({
                where: { id: auction.id },
                data: { stripeRefundError: message },
            }).catch(() => {});
            throw error;
        }

        const linkedRetailId = auction.listing.linkedListingId;
        const refusedAt = new Date();
        await this.prisma.$transaction([
            this.prisma.auction.update({
                where: { id: auction.id },
                data: {
                    status: 'CANCELLED',
                    winnerId: null,
                    winningBidAmount: null,
                    wonAt: null,
                    buyerFeePaid: false,
                    buyerRefusedAt: refusedAt,
                    buyerRefusedById: buyerId,
                    buyerRefusalReason: reason?.trim() || inspection.inspectionSummary || 'Faults found during inspection',
                    buyerRefusalInspectionJobId: inspection.id,
                    handoverProofUrl: null,
                    handoverProofPath: null,
                    handoverSubmittedAt: null,
                    stripeRefundError: null,
                },
            }),
            this.prisma.listing.update({
                where: { id: auction.listing.id },
                data: linkedRetailId
                    ? {
                        status: 'DRAFT',
                        linkedListingId: null,
                        deletedAt: new Date(),
                    } as any
                    : {
                        status: 'DRAFT',
                        type: 'CLASSIFIED',
                        linkedListingId: null,
                    } as any,
            }),
            ...(linkedRetailId ? [
                this.prisma.listing.update({
                    where: { id: linkedRetailId },
                    data: {
                        status: 'DRAFT',
                        linkedListingId: null,
                    } as any,
                }),
            ] : []),
            this.prisma.sale.deleteMany({
                where: { listingId: auction.listing.id, buyerId },
            }),
            ...(auction.listing.sellerId ? [
                this.prisma.sellerProfile.update({
                    where: { userId: auction.listing.sellerId },
                    data: { totalSales: { decrement: 1 } },
                }),
            ] : []),
        ]);

        await this.handoverDocuments.deleteProof(
            auction.handoverProofPath,
            auction.handoverProofUrl,
        ).catch(() => {});

        await this.notificationsService.create({
            userId: buyerId,
            type: 'SYSTEM',
            title: 'Vehicle refused after inspection',
            message: `Your refusal of "${auction.listing.title}" was accepted because the linked inspection recorded faults. Your £125 buyer fee has been refunded.`,
            entityType: 'AUCTION',
            entityId: auction.id,
            link: '/dashboard/dealer/auctions/won',
        }).catch(() => {});

        if (auction.listing.sellerId) {
            const sellerNotification = await this.notificationsService.create({
                userId: auction.listing.sellerId,
                type: 'SYSTEM',
                title: 'Auction sale cancelled after inspection',
                message: linkedRetailId
                    ? `The buyer refused "${auction.listing.title}" after a CarMazium inspection recorded faults. The auction has been cancelled and your retail listing returned to draft so you can repair or update it before relisting.`
                    : `The buyer refused "${auction.listing.title}" after a CarMazium inspection recorded faults. The vehicle is back in your inventory so you can repair, relist or re-auction it.`,
                entityType: 'AUCTION',
                entityId: auction.id,
                link: '/dashboard/seller/auctions',
            }).catch(() => null);
        }

        this.auctionGateway.broadcastAuctionEnd(auction.id, {
            auctionId: auction.id,
            winnerId: null,
            winningBidAmount: null,
            reserveMet: false,
        });

        return { refused: true, refundedAmount: 125, inspectionJobId: inspection.id };
    }

    async remove(id: string, userId: string): Promise<Auction> {
        const sellerId = await this.resolveSellerBusinessId(userId, 'MANAGE_INVENTORY');
        const auction = await this.findOne(id);

        if (auction.listing.sellerId !== sellerId) {
            throw new ForbiddenException('You do not own this auction');
        }

        if (auction.status !== 'SCHEDULED') {
            throw new BadRequestException('Only SCHEDULED auctions can be deleted');
        }

        const classifiedId = (auction.listing as any).linkedListingId as string | null;
        const operations: any[] = [
            this.prisma.auction.update({
                where: { id },
                data: {
                    status: 'CANCELLED',
                    deletedAt: new Date(),
                    buyItNowPendingBuyerId: null,
                    buyItNowPendingAt: null,
                },
            }),
            this.prisma.listing.update({
                where: { id: auction.listingId },
                data: {
                    status: 'DRAFT',
                    linkedListingId: null,
                    ...(classifiedId ? { deletedAt: new Date() } : {}),
                } as any,
            }),
        ];
        if (classifiedId) {
            operations.push(this.prisma.listing.update({
                where: { id: classifiedId },
                data: { linkedListingId: null } as any,
            }));
        }

        const [removed] = await this.prisma.$transaction(operations);
        return removed;
    }

    /**
     * Record handover proof for an ended auction.
     *
     * `proofPath` is an object key in the private handover bucket, written by
     * the multipart upload endpoint. `proofUrl` is the legacy public URL, still
     * sent by released mobile clients; it is kept working on purpose until the
     * app ships against the private endpoint.
     */
    async submitHandoverProof(
        auctionId: string,
        userId: string,
        proof: { proofUrl?: string; proofPath?: string },
    ): Promise<any> {
        const sellerId = await this.resolveSellerBusinessId(userId, 'MANAGE_INVENTORY');
        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            include: { listing: { select: { sellerId: true, title: true } } },
        });

        if (!auction || auction.deletedAt) {
            throw new NotFoundException('Auction not found');
        }
        if (auction.listing.sellerId !== sellerId) {
            throw new ForbiddenException('You do not own this auction');
        }
        if (auction.status !== 'ENDED') {
            throw new BadRequestException('Handover proof can only be submitted for ended auctions');
        }
        if (!auction.winnerId) {
            throw new BadRequestException('This auction has no winner');
        }
        if (auction.handoverProofUrl || (auction as any).handoverProofPath) {
            throw new BadRequestException('Handover proof has already been submitted');
        }

        const updated = await this.prisma.auction.update({
            where: { id: auctionId },
            data: {
                // Exactly one of these is set. A private upload leaves the
                // legacy column null so nothing public is ever recorded for it.
                handoverProofUrl: proof.proofPath ? null : proof.proofUrl,
                handoverProofPath: proof.proofPath ?? null,
                handoverSubmittedAt: new Date(),
            } as any,
        });

        // Persist + deliver the handover review notice through the canonical notification path.
        await this.notificationsService.create({
            userId: sellerId,
            type: 'AUCTION_ENDED',
            title: 'Handover proof received',
            message: `Your proof for "${auction.listing.title}" is under review. Your £100 seller bonus will be released once verified.`,
            entityType: 'AUCTION',
            entityId: auctionId,
            link: `/dashboard/seller/auctions`,
        }).catch(() => null);

        return updated;
    }

    // Called by BidsService after a bid is placed
    async maybeExtend(auctionId: string, bidPlacedAt: Date): Promise<Auction | null> {
        const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
        if (!auction) return null;

        const antiSnipeWindow = ANTI_SNIPE_MINUTES * 60 * 1000;
        const timeLeft = auction.endTime.getTime() - bidPlacedAt.getTime();

        if (timeLeft > 0 && timeLeft <= antiSnipeWindow) {
            return this.prisma.auction.update({
                where: { id: auctionId },
                data: {
                    endTime: new Date(auction.endTime.getTime() + antiSnipeWindow),
                },
            });
        }

        return null;
    }

    // Called by AuctionLifecycleService when endTime has passed. Seller early
    // close uses the same path with an explicit flag so both routes share the
    // exact same auction/bid lock and cannot race live bidding.
    async closeAuction(
        auctionId: string,
        options?: { sellerEarlyClose?: boolean; sellerId?: string },
    ): Promise<void> {
        const lookup = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            select: { listingId: true, deletedAt: true },
        });
        if (!lookup || lookup.deletedAt) return;

        const outcome = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lookup.listingId}, 0))`;

            const auction = await tx.auction.findUnique({
                where: { id: auctionId },
                include: {
                    listing: {
                        include: {
                            bids: {
                                where: { deletedAt: null, cancelledAt: null, archivedAt: null },
                                orderBy: { amount: 'desc' },
                                take: 1,
                                include: { bidder: { select: { id: true, firstName: true } } },
                            },
                        },
                    },
                },
            });

            if (!auction || auction.deletedAt || auction.status !== 'ACTIVE') {
                return null;
            }

            const sellerEarlyClose = options?.sellerEarlyClose === true;
            if (sellerEarlyClose) {
                if (!options?.sellerId || auction.listing.sellerId !== options.sellerId) {
                    throw new ForbiddenException('You do not own this auction');
                }
            } else {
                // A lifecycle close that lost a race to an anti-snipe extension
                // must stand down. The scheduler will see the new end time on
                // its next pass instead of ending a still-live auction.
                const currentEndTime = new Date(auction.endTime);
                if (currentEndTime.getTime() > Date.now()) {
                    return null;
                }
            }

            const topBid = auction.listing.bids[0] ?? null;
            const reserveMet = !!topBid && Number(topBid.amount) >= Number(auction.reservePrice);

            if (sellerEarlyClose && reserveMet) {
                throw new BadRequestException(
                    'The reserve has been met. The auction must continue normally until it ends.',
                );
            }

            // Seller early-close is explicitly a no-sale route. Normal expiry
            // awards a winner only when the highest real bid meets reserve.
            if (!sellerEarlyClose && reserveMet && topBid) {
                const sellerId = auction.listing.sellerId;
                const linkedListingId = (auction.listing as any).linkedListingId as string | null;
                const wonAt = new Date();

                await tx.auction.update({
                    where: { id: auctionId },
                    data: {
                        status: 'ENDED',
                        winnerId: topBid.bidderId,
                        winningBidAmount: topBid.amount,
                        wonAt,
                        buyItNowPendingBuyerId: null,
                        buyItNowPendingAt: null,
                    },
                });
                await tx.listing.update({
                    where: { id: auction.listingId },
                    data: { status: 'SOLD' },
                });
                if (linkedListingId) {
                    await tx.listing.update({
                        where: { id: linkedListingId },
                        data: { status: 'SOLD' },
                    });
                }
                if (sellerId) {
                    await tx.sale.create({
                        data: {
                            listingId: auction.listingId,
                            sellerId,
                            buyerId: topBid.bidderId,
                            soldPrice: topBid.amount,
                        },
                    });
                    await tx.sellerProfile.upsert({
                        where: { userId: sellerId },
                        create: { userId: sellerId, totalSales: 1 },
                        update: { totalSales: { increment: 1 } },
                    });
                }

                return {
                    auction,
                    winnerId: topBid.bidderId,
                    winningAmount: Number(topBid.amount),
                    saleCompleted: true,
                    outcomeType: 'RESERVE_MET_SALE' as const,
                    highestBidAmount: Number(topBid.amount),
                };
            }

            // No winner — either the timed auction expired below reserve or the
            // seller deliberately closed a below-reserve auction without sale.
            const classifiedId = (auction.listing as any).linkedListingId as string | null;

            await tx.auction.update({
                where: { id: auctionId },
                data: {
                    status: 'ENDED',
                    winnerId: null,
                    winningBidAmount: null,
                    buyItNowPendingBuyerId: null,
                    buyItNowPendingAt: null,
                },
            });
            await tx.listing.update({
                where: { id: auction.listingId },
                data: classifiedId
                    ? {
                        status: 'DRAFT',
                        type: 'AUCTION',
                    } as any
                    : {
                        status: 'DRAFT',
                        type: 'CLASSIFIED',
                        linkedListingId: null,
                    } as any,
            });

            return {
                auction,
                winnerId: null,
                winningAmount: null,
                saleCompleted: false,
                outcomeType: sellerEarlyClose
                    ? 'SELLER_EARLY_CLOSE_UNSOLD' as const
                    : topBid
                        ? 'BELOW_RESERVE_UNSOLD' as const
                        : 'NO_BIDS_UNSOLD' as const,
                highestBidAmount: topBid ? Number(topBid.amount) : null,
            };
        });

        if (!outcome) return;

        this.trackAuctionEvent('auction_outcome', {
            auction_id: auctionId,
            listing_id: outcome.auction.listingId,
            outcome: outcome.outcomeType,
            winner_id: outcome.winnerId,
            winning_amount: outcome.winningAmount,
            highest_bid_amount: outcome.highestBidAmount,
            reserve_price: Number(outcome.auction.reservePrice),
            starting_bid: Number(outcome.auction.startingBid),
            had_real_bids: outcome.highestBidAmount !== null,
            seller_early_close: options?.sellerEarlyClose === true,
        });

        const endPayload: AuctionEndPayload = {
            auctionId,
            winnerId: outcome.winnerId,
            winningBidAmount: outcome.winningAmount,
            reserveMet: outcome.saleCompleted,
        };
        this.auctionGateway.broadcastAuctionEnd(auctionId, endPayload);
        await this.notifyAuctionEnd(
            outcome.auction,
            outcome.winnerId,
            outcome.winningAmount,
            outcome.saleCompleted,
        );
    }

    private async notifyAuctionEnd(
        auction: any,
        winnerId: string | null,
        winningAmount: number | null,
        reserveMet: boolean,
    ): Promise<void> {
        const listing = auction.listing;
        const vehicle = `${listing.year ?? ''} ${listing.make ?? ''} ${listing.model ?? ''}`.trim();

        if (reserveMet && winnerId && winningAmount !== null) {
            // Notify winner — persisted + push delivered via notificationsService.create()
            await this.notificationsService.create({
                userId: winnerId,
                type: 'AUCTION_WON',
                title: 'You won the auction!',
                message: `You won the auction for ${vehicle} with a bid of £${winningAmount.toLocaleString()}. Pay the £125 CarMazium buyer fee to unlock the seller's contact details and auction chat.`,
                entityType: 'AUCTION',
                entityId: auction.id,
                link: `/dashboard/dealer/auctions/won`,
            });

            // Notify seller — persisted + push delivered
            if (listing.sellerId) {
                await this.notificationsService.create({
                    userId: listing.sellerId,
                    type: 'AUCTION_ENDED',
                    title: 'Your auction has ended',
                    message: `Your auction for ${vehicle} has ended. Winning bid: £${winningAmount.toLocaleString()}. The winning dealer must pay the £125 CarMazium buyer fee before seller contact and auction chat are unlocked.`,
                    entityType: 'AUCTION',
                    entityId: auction.id,
                    link: `/dashboard/seller/auctions`,
                });
            }

            // Auction chat is intentionally not created here. ChatService enforces
            // buyerFeePaid for auction conversations; the winner must first pay
            // CarMazium's £125 buyer fee. After payment, web/native can create
            // or open the canonical winner/seller room without exposing seller
            // contact before the platform fee is confirmed.

            // Email winner and seller
            const [buyer, seller] = await Promise.all([
                this.prisma.user.findUnique({ where: { id: winnerId }, select: { email: true, firstName: true } }),
                listing.sellerId ? this.prisma.user.findUnique({ where: { id: listing.sellerId }, select: { email: true, firstName: true } }) : null,
            ]);
            // Winner email respects their "You're winning"/Email toggles — same
            // AUCTION_WON type as the notification above (mobile-production-
            // readiness-plan.md F23 follow-up). The seller's "auction ended"
            // email has no dedicated toggle in NotificationSettingsScreen.tsx,
            // so it stays ungated like before.
            if (buyer?.email && await this.notificationsService.shouldSendEmail(winnerId, 'AUCTION_WON')) {
                this.emailService.sendAuctionWonEmail(buyer.email, buyer.firstName || 'there', vehicle || listing.title, winningAmount, auction.id).catch(console.error);
            }
            if (seller?.email) {
                this.emailService.sendAuctionEndedSellerEmail(seller.email, seller.firstName || 'there', vehicle || listing.title, winningAmount, auction.id).catch(console.error);
            }
        } else {
            // No winner — give the seller a clear next step instead of simply
            // telling them to re-auction. Keep network size out of all
            // customer-facing communication; the useful message is the next
            // selling route, not the current dealer count.
            if (listing.sellerId) {
                const seller = await this.prisma.user.findUnique({
                    where: { id: listing.sellerId },
                    select: { email: true, firstName: true },
                });

                const linkedRetailListingId = (listing as any).linkedListingId as string | null;
                const retailAlreadyLive = Boolean(linkedRetailListingId);
                const retailUrl = retailAlreadyLive
                    ? '/dashboard/seller/listings'
                    : `/sell?editId=${auction.listingId}&sellMode=retail`;

                const recommendation = retailAlreadyLive
                    ? `Your auction for ${vehicle || listing.title} has ended without a sale. The vehicle was presented across CarMazium’s verified dealer network, but it did not receive enough interest to complete a sale at the reserve price. Your Retail Listing is already live, so it can continue reaching CarMazium’s wider retail audience and give the vehicle another strong opportunity to sell.`
                    : `Your auction for ${vehicle || listing.title} has ended without a sale. The vehicle was presented across CarMazium’s verified dealer network, but it did not receive enough interest to complete a sale at the reserve price. We recommend moving it to a Retail Listing. This opens the vehicle to CarMazium’s much wider retail audience, increasing its visibility and giving it a stronger chance of finding the right buyer. Your vehicle details are already saved, and a CarMazium Retail Listing costs just £1 until sold.`;

                await this.notificationsService.create({
                    userId: listing.sellerId,
                    type: 'AUCTION_ENDED_NO_SALE',
                    title: retailAlreadyLive
                        ? 'Auction ended — your Retail Listing stays live'
                        : 'Auction ended — give your car a wider audience',
                    message: recommendation,
                    entityType: 'AUCTION',
                    entityId: auction.id,
                    actionType: retailAlreadyLive ? 'VIEW_RETAIL' : 'LIST_RETAIL',
                    link: retailUrl,
                    data: {
                        auctionId: auction.id,
                        listingId: auction.listingId,
                        linkedRetailListingId,
                        retailAlreadyLive,
                        retailUrl,
                        vehicleTitle: vehicle || listing.title,
                    },
                });

                // Send the same recommendation into the seller's official
                // CarMazium support conversation. Auction ID is used as the
                // idempotency key, so a retry cannot create a duplicate message.
                try {
                    const supportRoom: any = await this.chatService.findOrCreateSupportRoom(listing.sellerId);
                    const supportSenderId =
                        supportRoom.initiatorId === listing.sellerId
                            ? supportRoom.participantId
                            : supportRoom.initiatorId;

                    if (supportSenderId) {
                        await this.chatService.sendMessage(
                            supportRoom.id,
                            supportSenderId,
                            {
                                content: recommendation + (retailAlreadyLive
                                    ? ' Open your seller dashboard to manage the Retail Listing.'
                                    : ' You can move it to Retail directly from your seller dashboard using “List in Retail”.'),
                                clientMessageId: auction.id,
                            },
                        );
                    }
                } catch (error: any) {
                    this.logger.error(
                        `Auction ${auction.id}: failed to send unsold-auction support message — ${error?.message}`,
                    );
                }

                if (seller?.email) {
                    this.emailService.sendAuctionReserveNotMetEmail(
                        seller.email,
                        seller.firstName || 'there',
                        vehicle || listing.title,
                        auction.id,
                        auction.listingId,
                        retailAlreadyLive,
                    ).catch(console.error);
                }
            }
        }
    }

    // ── Buy It Now Lifecycle ─────────────────────────────────────────────────

    /**
     * Private helper: ends an auction with a winner — creates Sale record, marks listing SOLD,
     * upserts SellerProfile, broadcasts auction:ended, sends notifications.
     * Called by confirmBuyItNow(), acceptBid(), and closeAuction() to avoid duplication.
     */
    private async endAuctionWithWinner(
        auctionId: string,
        winnerId: string,
        amount: number,
        sellerId: string,
        linkedListingId: string | null = null,
    ): Promise<void> {
        await this.prisma.$transaction([
            this.prisma.auction.update({
                where: { id: auctionId },
                data: {
                    status: 'ENDED',
                    winnerId,
                    winningBidAmount: amount,
                    wonAt: new Date(),
                    buyItNowPendingBuyerId: null,
                    buyItNowPendingAt: null,
                },
            }),
            this.prisma.listing.update({
                where: { id: (await this.prisma.auction.findUnique({ where: { id: auctionId }, select: { listingId: true } }))!.listingId },
                data: { status: 'SOLD' },
            }),
            ...(linkedListingId ? [
                this.prisma.listing.update({
                    where: { id: linkedListingId },
                    data: { status: 'SOLD' },
                }),
            ] : []),
            this.prisma.sale.create({
                data: {
                    listingId: (await this.prisma.auction.findUnique({ where: { id: auctionId }, select: { listingId: true } }))!.listingId,
                    sellerId,
                    buyerId: winnerId,
                    soldPrice: amount,
                },
            }),
            this.prisma.sellerProfile.upsert({
                where: { userId: sellerId },
                create: { userId: sellerId, totalSales: 1 },
                update: { totalSales: { increment: 1 } },
            }),
        ]);

        const endPayload: AuctionEndPayload = { auctionId, winnerId, winningBidAmount: amount, reserveMet: true };
        this.auctionGateway.broadcastAuctionEnd(auctionId, endPayload);
    }

    /**
     * Buyer triggers a Buy It Now request. Sets pending state, notifies seller, broadcasts to viewers.
     */
    async triggerBuyItNow(auctionId: string, buyerId: string): Promise<void> {
        buyerId = await this.resolveBuyerBusinessId(buyerId, 'PLACE_BID');
        const auction = await this.findOne(auctionId);

        if (auction.status !== 'ACTIVE') {
            throw new BadRequestException('Auction is not ACTIVE');
        }
        if (!auction.buyItNowPrice) {
            throw new BadRequestException('No Buy It Now price set on this auction');
        }

        // Check reserve not already met by existing top bid
        const topBid = await this.prisma.bid.findFirst({
            where: { listingId: auction.listingId, deletedAt: null, cancelledAt: null, archivedAt: null },
            orderBy: { amount: 'desc' },
        });
        if (topBid && Number(topBid.amount) >= Number(auction.reservePrice)) {
            throw new BadRequestException('Reserve is met — Buy It Now is no longer available');
        }

        // Allow re-trigger by any buyer (replaces existing pending)
        await this.prisma.auction.update({
            where: { id: auctionId },
            data: { buyItNowPendingBuyerId: buyerId, buyItNowPendingAt: new Date() },
        });

        // Notify seller
        await this.notificationsService.create({
            userId: auction.listing.sellerId,
            type: 'AUCTION_ENDED',
            title: 'Buy It Now request received',
            message: `A buyer wants to buy your ${auction.listing.make} ${auction.listing.model} for £${Number(auction.buyItNowPrice).toLocaleString()}.`,
            entityType: 'AUCTION',
            entityId: auctionId,
            link: `/auctions/live/${auctionId}`,
        });

        // Broadcast BIN pending state to all viewers
        this.auctionGateway.broadcastBinPending(auctionId, buyerId);
    }

    /**
     * Seller confirms the Buy It Now request — ends the auction with the pending buyer as winner.
     */
    async confirmBuyItNow(auctionId: string, sellerId: string): Promise<void> {
        const businessSellerId = await this.resolveSellerBusinessId(sellerId, 'MANAGE_INVENTORY');
        const auction = await this.findOne(auctionId);

        if (auction.listing.sellerId !== businessSellerId) {
            throw new ForbiddenException('You do not own this auction');
        }
        if (!auction.buyItNowPendingBuyerId) {
            throw new BadRequestException('No Buy It Now request is pending on this auction');
        }

        const pendingBuyerId = auction.buyItNowPendingBuyerId;
        const binPrice = Number(auction.buyItNowPrice);
        const linkedListingId = (auction.listing as any).linkedListingId as string | null;

        // Run the full winner-close transaction
        await this.prisma.$transaction([
            this.prisma.auction.update({
                where: { id: auctionId },
                data: {
                    status: 'ENDED',
                    winnerId: pendingBuyerId,
                    winningBidAmount: binPrice,
                    wonAt: new Date(),
                    buyItNowPendingBuyerId: null,
                    buyItNowPendingAt: null,
                },
            }),
            this.prisma.listing.update({
                where: { id: auction.listingId },
                data: { status: 'SOLD' },
            }),
            ...(linkedListingId ? [
                this.prisma.listing.update({
                    where: { id: linkedListingId },
                    data: { status: 'SOLD' },
                }),
            ] : []),
            this.prisma.sale.create({
                data: {
                    listingId: auction.listingId,
                    sellerId: businessSellerId,
                    buyerId: pendingBuyerId,
                    soldPrice: binPrice,
                },
            }),
            this.prisma.sellerProfile.upsert({
                where: { userId: businessSellerId },
                create: { userId: businessSellerId, totalSales: 1 },
                update: { totalSales: { increment: 1 } },
            }),
        ]);

        const endPayload: AuctionEndPayload = {
            auctionId,
            winnerId: pendingBuyerId,
            winningBidAmount: binPrice,
            reserveMet: true,
        };
        this.auctionGateway.broadcastAuctionEnd(auctionId, endPayload);
        await this.notifyAuctionEnd({ ...auction, id: auctionId }, pendingBuyerId, binPrice, true);
    }

    /**
     * Seller declines the Buy It Now request — clears pending state, notifies buyer, auction resumes.
     */
    async declineBuyItNow(auctionId: string, sellerId: string): Promise<void> {
        const businessSellerId = await this.resolveSellerBusinessId(sellerId, 'MANAGE_INVENTORY');
        const auction = await this.findOne(auctionId);

        if (auction.listing.sellerId !== businessSellerId) {
            throw new ForbiddenException('You do not own this auction');
        }

        const pendingBuyerId = auction.buyItNowPendingBuyerId;

        await this.prisma.auction.update({
            where: { id: auctionId },
            data: { buyItNowPendingBuyerId: null, buyItNowPendingAt: null },
        });

        // Notify buyer their BIN request was declined
        if (pendingBuyerId) {
            await this.notificationsService.create({
                userId: pendingBuyerId,
                type: 'AUCTION_ENDED',
                title: 'Buy It Now request declined',
                message: `The seller declined your Buy It Now request on ${auction.listing.make} ${auction.listing.model}. You can continue bidding.`,
                entityType: 'AUCTION',
                entityId: auctionId,
                link: `/auctions/live/${auctionId}`,
            });
        }
    }

    /**
     * Lazily clears expired BIN pending state. Called at the top of findOne() and findBySlug()
     * return paths. Fire-and-forget DB update if 24h has elapsed.
     */
    private clearExpiredBin(auction: any): any {
        if (
            auction.buyItNowPendingAt &&
            new Date(auction.buyItNowPendingAt).getTime() + 24 * 60 * 60 * 1000 < Date.now()
        ) {
            // Fire-and-forget — do not block the response
            this.prisma.auction.update({
                where: { id: auction.id },
                data: { buyItNowPendingBuyerId: null, buyItNowPendingAt: null },
            }).catch(() => { /* non-blocking */ });

            return { ...auction, buyItNowPendingBuyerId: null, buyItNowPendingAt: null };
        }
        return auction;
    }
}
