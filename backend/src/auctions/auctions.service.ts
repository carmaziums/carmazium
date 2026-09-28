import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
    forwardRef,
    Inject,
    Logger,
    Optional,
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
import {
    AUCTION_DURATION_MS,
    BUY_IT_NOW_BELOW_RESERVE_MESSAGE,
    buyItNowViolatesReserve,
    calculateBuyItNowResponseDeadline,
    calculateFirstOfferFloor,
    calculatePlatformOpeningBid,
} from './auction-pricing';
import { getListingSubmissionReadiness } from '../listings/listing-readiness';
import { PaymentsService } from '../payments/payments.service';
import { FreeListingGrantsService } from '../free-listings/free-listing-grants.service';
import { isAdminGrantedFreePurchaseTransaction } from '../free-listings/free-purchase-grant.constants';
import {
    assertDealerPermission,
    DealerPermission,
    hasDealerPermission,
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
        @Optional()
        private readonly freeListingGrantsService?: FreeListingGrantsService,
    ) { }

    private auctionRunKey(auction: { id: string; startTime?: Date | string | null }): string {
        const raw = auction?.startTime;
        const parsed = raw ? new Date(raw) : null;
        const runStart = parsed && Number.isFinite(parsed.getTime())
            ? parsed.toISOString()
            : 'unknown';
        return `${auction.id}:${runStart}`;
    }

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

    /**
     * Generic auction/buyer responses must never expose handover evidence.
     *
     * Handover documents can contain signatures, names and addresses. Only the
     * seller/dealership inventory-management view and the admin review queue
     * may receive a short-lived signed URL. Every other auction response keeps
     * lifecycle metadata such as handoverSubmittedAt but strips both the
     * private storage key and any legacy public proof URL.
     */
    private redactHandoverEvidence<T extends Record<string, any>>(auction: T): T {
        const safe: Record<string, any> = {
            ...auction,
            handoverProofUrl: null,
            handoverProofIsPrivate: Boolean(auction.handoverProofPath),
        };
        delete safe.handoverProofPath;
        return safe as T;
    }

    private isStructurallyValidHandoverProof(auction: any): boolean {
        const privatePath = typeof auction?.handoverProofPath === 'string'
            ? auction.handoverProofPath.trim()
            : '';
        const privatePathValid = Boolean(
            privatePath
            && privatePath.startsWith(`${auction.id}/`)
            && !privatePath.includes('..'),
        );

        const legacyUrl = typeof auction?.handoverProofUrl === 'string'
            ? auction.handoverProofUrl.trim()
            : '';
        let legacyUrlValid = false;
        if (legacyUrl) {
            const marker = '/storage/v1/object/public/listings/';
            const at = legacyUrl.indexOf(marker);
            if (at !== -1) {
                const key = decodeURIComponent(legacyUrl.slice(at + marker.length).split('?')[0] || '');
                legacyUrlValid = key.startsWith('handover/') || key.includes('/handover/');
            }
        }

        // Historic migrated rows intentionally keep both the legacy URL and the
        // private path until public cleanup is complete. Either structurally
        // valid representation is sufficient; readers still prefer the private
        // path and never expose that key.
        return privatePathValid || legacyUrlValid;
    }

    /**
     * Authoritative backend gate for the seller-handover / £100 bonus lifecycle.
     *
     * This intentionally validates the buyer-fee transaction itself instead of
     * trusting buyerFeePaid alone: an old/corrupt boolean must never unlock a
     * seller payout. A normal £125 payment and an admin-granted £0 purchase
     * waiver are both valid, auditable fee states. Cancellation/refusal state
     * is checked here too so every caller uses the same business rule.
     */
    async assertHandoverBusinessRules(
        auctionId: string,
        options: {
            expectedSellerId?: string;
            requireProof?: boolean;
            requireUnapproved?: boolean;
            requireApproved?: boolean;
        } = {},
    ): Promise<any> {
        const auction: any = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            include: {
                listing: {
                    select: {
                        id: true,
                        sellerId: true,
                        title: true,
                        deletedAt: true,
                        seller: { select: { id: true, deletedAt: true } },
                    },
                },
                winner: { select: { id: true, deletedAt: true } },
            },
        });

        if (!auction || auction.deletedAt || !auction.listing || auction.listing.deletedAt) {
            throw new NotFoundException('Auction not found');
        }
        if (
            options.expectedSellerId
            && auction.listing.sellerId !== options.expectedSellerId
        ) {
            throw new ForbiddenException('You do not own this auction');
        }
        if (!auction.listing.seller || auction.listing.seller.deletedAt) {
            throw new BadRequestException('This auction no longer has a valid seller account');
        }
        if (auction.status !== 'ENDED') {
            throw new BadRequestException('Handover is only available for a valid ended auction');
        }
        if (
            !auction.winnerId
            || !auction.winner
            || auction.winner.deletedAt
            || auction.winner.id !== auction.winnerId
        ) {
            throw new BadRequestException('This auction does not have a valid winner');
        }
        if (auction.winnerId === auction.listing.sellerId) {
            throw new BadRequestException('Seller and auction winner cannot be the same account');
        }
        if (!auction.buyerFeePaid || !auction.buyerFeeTransactionId) {
            throw new BadRequestException(
                'The auction buyer fee must be paid or covered by an active admin grant before handover',
            );
        }

        const feeTransaction: any = await this.prisma.transaction.findUnique({
            where: { id: auction.buyerFeeTransactionId },
        });
        const isPaidBuyerFee = Number(feeTransaction?.amount) === 125;
        const isAdminWaiver = isAdminGrantedFreePurchaseTransaction(feeTransaction);
        const validFeeTransaction = Boolean(
            feeTransaction
            && !feeTransaction.deletedAt
            && feeTransaction.status === 'COMPLETED'
            && feeTransaction.type === 'COMMISSION'
            && feeTransaction.listingId === auction.listingId
            && feeTransaction.userId === auction.winnerId
            && (isPaidBuyerFee || isAdminWaiver),
        );
        if (!validFeeTransaction) {
            throw new BadRequestException(
                'The auction buyer fee payment or admin-waiver record is invalid or incomplete',
            );
        }

        if (auction.buyerRefusedAt) {
            throw new BadRequestException('This purchase was refused after inspection and cannot proceed to handover');
        }

        const cancellation = await this.prisma.saleCancellationRequest.findFirst({
            where: {
                auctionId,
                status: {
                    in: ['PENDING_COUNTERPARTY', 'PENDING_ADMIN', 'APPROVED'] as any,
                },
            },
            select: { id: true, status: true },
        });
        if (cancellation) {
            throw new BadRequestException(
                cancellation.status === 'APPROVED'
                    ? 'This auction sale has been cancelled'
                    : 'This auction sale has a cancellation request in progress',
            );
        }

        if (options.requireProof) {
            if (!auction.handoverSubmittedAt || !this.isStructurallyValidHandoverProof(auction)) {
                throw new BadRequestException('A valid handover proof must be submitted before approval or payout');
            }
        }

        if (options.requireUnapproved) {
            if (
                auction.sellerBonusReleased
                || auction.sellerBonusReleasedAt
                || auction.stripePayoutTransferId
                || auction.manualPayoutConfirmedAt
            ) {
                throw new BadRequestException('This handover has already been completed or entered payout');
            }
        }

        if (options.requireApproved) {
            if (!auction.sellerBonusReleased || !auction.sellerBonusReleasedAt) {
                throw new BadRequestException('This handover has not been validly approved');
            }
        }

        return auction;
    }

    async assertHandoverSubmissionEligibility(auctionId: string, userId: string): Promise<any> {
        const sellerId = await this.resolveSellerBusinessId(userId, 'MANAGE_INVENTORY');
        const auction = await this.assertHandoverBusinessRules(auctionId, {
            expectedSellerId: sellerId,
            requireUnapproved: true,
        });
        if (auction.handoverProofUrl || auction.handoverProofPath || auction.handoverSubmittedAt) {
            throw new BadRequestException('Handover proof has already been submitted');
        }
        return auction;
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

        if (buyItNowViolatesReserve(
            createAuctionDto.reservePrice,
            createAuctionDto.buyItNowPrice,
        )) {
            throw new BadRequestException(BUY_IT_NOW_BELOW_RESERVE_MESSAGE);
        }

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
        const data = await this.prisma.auction.findMany({
            // listing.status filter is defense-in-depth — the activation cron
            // already only flips SCHEDULED -> ACTIVE for approved listings.
            // Status alone is not enough: if lifecycle finalisation is
            // delayed for any reason, an expired row must never be advertised
            // as live. The canonical deadline is an independent read boundary.
            where: {
                status: 'ACTIVE',
                endTime: { gt: new Date() },
                deletedAt: null,
                listing: { status: 'ACTIVE', deletedAt: null },
            },
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
        return data.map((auction: any) => this.redactHandoverEvidence(auction));
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
        return {
            data: data.map((auction: any) => this.redactHandoverEvidence(auction)),
            total,
        };
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

        return this.redactHandoverEvidence(this.clearExpiredBin(auction));
    }

    async findMyAuctions(userId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
        // VIEW_INVENTORY is enough to inspect dealership auctions, but handover
        // evidence can contain signatures, names and addresses. Only roles that
        // may manage inventory can receive the signed proof URL or submit a new
        // proof. Read-only dealership staff still receive handoverSubmittedAt so
        // their UI can show the correct lifecycle state without exposing proof.
        const actor = await resolveDealerActor(this.prisma, userId);
        let sellerId = userId;
        let canManageHandover = true;
        if (actor) {
            assertDealerPermission(
                actor,
                'VIEW_INVENTORY',
                'Your dealership role does not allow auction inventory access.',
            );
            sellerId = actor.ownerUserId;
            canManageHandover = hasDealerPermission(actor, 'MANAGE_INVENTORY');
        }

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

        if (canManageHandover) {
            return { data: await this.handoverDocuments.hydrateMany(data), total };
        }

        const redacted = data.map((auction: any) => {
            const safe = {
                ...auction,
                handoverProofUrl: null,
                handoverProofIsPrivate: Boolean(auction.handoverProofPath),
            };
            delete safe.handoverProofPath;
            return safe;
        });
        return { data: redacted, total };
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

        return {
            data: gated.map((auction: any) => this.redactHandoverEvidence(auction)),
            total,
        };
    }

    async update(id: string, updateAuctionDto: UpdateAuctionDto, userId: string): Promise<Auction> {
        const sellerId = await this.resolveSellerBusinessId(userId, 'MANAGE_INVENTORY');
        const lookup = await this.prisma.auction.findUnique({
            where: { id },
            select: { listingId: true, deletedAt: true },
        });
        if (!lookup || lookup.deletedAt) {
            throw new NotFoundException('Auction not found');
        }

        return this.prisma.$transaction(async (tx) => {
            // Scheduled pricing edits share the same per-listing lock as bidding,
            // BIN, reserve correction and finalisation. This prevents two valid
            // partial edits (for example reserve-only and BIN-only) racing into
            // an invalid final pair.
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lookup.listingId}, 0))`;

            const auction = await tx.auction.findUnique({
                where: { id },
                include: {
                    listing: {
                        select: {
                            id: true,
                            sellerId: true,
                            price: true,
                        },
                    },
                },
            });
            if (!auction || auction.deletedAt) {
                throw new NotFoundException('Auction not found');
            }
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
            const nextReservePrice = updateAuctionDto.reservePrice !== undefined
                ? updateAuctionDto.reservePrice
                : Number(auction.reservePrice);
            const nextBuyItNowPrice = updateAuctionDto.buyItNowPrice !== undefined
                ? updateAuctionDto.buyItNowPrice
                : auction.buyItNowPrice == null
                    ? null
                    : Number(auction.buyItNowPrice);

            if (buyItNowViolatesReserve(nextReservePrice, nextBuyItNowPrice)) {
                throw new BadRequestException(BUY_IT_NOW_BELOW_RESERVE_MESSAGE);
            }

            return tx.auction.update({
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
                            status: true,
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
            if (auction.listing.status !== 'ACTIVE') {
                throw new BadRequestException('This auction vehicle is no longer active');
            }
            if (Date.now() >= auction.endTime.getTime()) {
                throw new BadRequestException(
                    'This auction has ended. The offer can no longer be accepted while the result is being finalised',
                );
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
            auction_run_key: this.auctionRunKey(accepted.auction),
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
            auction_run_key: this.auctionRunKey(accepted.auction),
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
     * Admin-only editor for a SCHEDULED auction.
     *
     * The admin listing editor used to update the Auction row directly, which
     * meant a reserve-only edit and BIN-only edit could validate against stale
     * state and race each other. Keep the canonical pricing pair under the same
     * per-listing advisory lock used by seller edits and live auction mutations.
     */
    async adminUpdateScheduledAuction(
        auctionId: string,
        updates: {
            reservePrice?: number;
            startingBid?: number;
            minIncrement?: number;
            buyItNowPrice?: number | null;
            startTime?: Date | string;
        },
    ): Promise<Auction> {
        const hasReserve = updates.reservePrice !== undefined;
        const hasStartingBid = updates.startingBid !== undefined;
        const hasMinIncrement = updates.minIncrement !== undefined;
        const hasBuyItNow = updates.buyItNowPrice !== undefined;
        const hasStartTime = updates.startTime !== undefined;

        if (hasReserve && (!Number.isFinite(updates.reservePrice) || Number(updates.reservePrice) <= 0)) {
            throw new BadRequestException('Reserve price must be greater than £0');
        }
        if (hasStartingBid && (!Number.isFinite(updates.startingBid) || Number(updates.startingBid) <= 0)) {
            throw new BadRequestException('Starting bid must be greater than £0');
        }
        if (hasMinIncrement && (!Number.isFinite(updates.minIncrement) || Number(updates.minIncrement) <= 0)) {
            throw new BadRequestException('Minimum increment must be greater than £0');
        }
        if (
            hasBuyItNow
            && updates.buyItNowPrice !== null
            && (!Number.isFinite(updates.buyItNowPrice) || Number(updates.buyItNowPrice) <= 0)
        ) {
            throw new BadRequestException('Buy It Now price must be greater than £0 when enabled');
        }

        const nextStartTime = hasStartTime
            ? (updates.startTime instanceof Date ? updates.startTime : new Date(updates.startTime as string))
            : null;

        if (
            nextStartTime
            && (
                Number.isNaN(nextStartTime.getTime())
                || nextStartTime.getTime() < Date.now() - 60 * 1000
            )
        ) {
            throw new BadRequestException('Start time cannot be in the past');
        }

        type AtomicScheduledUpdateRow = {
            id: string;
            decision_code: 'OK' | 'NOT_FOUND' | 'INVALID_STATUS' | 'START_IN_PAST' | 'ABOVE_BIN';
            updated_count: number;
        };

        /*
         * IMPORTANT: keep scheduled auction edits off Prisma interactive
         * transactions. Production uses a pooled connection and the old
         * interactive transaction could fail before the UPDATE reached
         * PostgreSQL, surfacing as a generic 500 in the admin editor.
         *
         * One SQL statement owns the advisory lock, reads canonical state,
         * validates the resultant reserve/BIN pair, and performs the update.
         */
        const rows = await this.prisma.$queryRaw<AtomicScheduledUpdateRow[]>`
            WITH target AS MATERIALIZED (
                SELECT
                    a.id,
                    a."listingId",
                    a.status::text AS auction_status,
                    a."deletedAt" AS deleted_at,
                    a."reservePrice" AS current_reserve,
                    a."startingBid" AS current_starting_bid,
                    a."minIncrement" AS current_min_increment,
                    a."buyItNowPrice" AS current_bin,
                    a."startTime" AS current_start_time
                FROM "auctions" a
                WHERE a.id = ${auctionId}
            ),
            lock_row AS MATERIALIZED (
                SELECT pg_advisory_xact_lock(hashtextextended(t."listingId", 0)) AS locked
                FROM target t
            ),
            snapshot AS MATERIALIZED (
                SELECT
                    t.*,
                    CASE
                        WHEN ${hasReserve}::boolean THEN ${updates.reservePrice ?? null}::numeric
                        ELSE t.current_reserve
                    END AS next_reserve,
                    CASE
                        WHEN ${hasStartingBid}::boolean THEN ${updates.startingBid ?? null}::numeric
                        ELSE t.current_starting_bid
                    END AS next_starting_bid,
                    CASE
                        WHEN ${hasMinIncrement}::boolean THEN ${updates.minIncrement ?? null}::numeric
                        ELSE t.current_min_increment
                    END AS next_min_increment,
                    CASE
                        WHEN ${hasBuyItNow}::boolean THEN ${updates.buyItNowPrice ?? null}::numeric
                        ELSE t.current_bin
                    END AS next_bin,
                    CASE
                        WHEN ${hasStartTime}::boolean THEN ${nextStartTime}::timestamptz
                        ELSE t.current_start_time
                    END AS next_start_time
                FROM target t
                CROSS JOIN lock_row
            ),
            decision AS MATERIALIZED (
                SELECT
                    s.*,
                    CASE
                        WHEN s.deleted_at IS NOT NULL THEN 'NOT_FOUND'
                        WHEN s.auction_status <> 'SCHEDULED' THEN 'INVALID_STATUS'
                        WHEN ${hasStartTime}::boolean
                             AND s.next_start_time < NOW() - INTERVAL '1 minute' THEN 'START_IN_PAST'
                        WHEN s.next_bin IS NOT NULL AND s.next_bin < s.next_reserve THEN 'ABOVE_BIN'
                        ELSE 'OK'
                    END AS decision_code
                FROM snapshot s
            ),
            updated AS (
                UPDATE "auctions" a
                SET
                    "reservePrice" = d.next_reserve,
                    "startingBid" = d.next_starting_bid,
                    "minIncrement" = d.next_min_increment,
                    "buyItNowPrice" = d.next_bin,
                    "startTime" = d.next_start_time,
                    "endTime" = CASE
                        WHEN ${hasStartTime}::boolean
                            THEN d.next_start_time + INTERVAL '24 hours'
                        ELSE a."endTime"
                    END,
                    "updatedAt" = NOW()
                FROM decision d
                WHERE a.id = d.id
                  AND d.decision_code = 'OK'
                RETURNING a.id
            )
            SELECT
                d.id,
                d.decision_code,
                (SELECT COUNT(*)::int FROM updated) AS updated_count
            FROM decision d
        `;

        const row = rows[0];
        if (!row) {
            throw new NotFoundException('Auction not found');
        }

        switch (row.decision_code) {
            case 'NOT_FOUND':
                throw new NotFoundException('Auction not found');
            case 'INVALID_STATUS':
                throw new BadRequestException('Only SCHEDULED auctions can be edited in the admin schedule editor');
            case 'START_IN_PAST':
                throw new BadRequestException('Start time cannot be in the past');
            case 'ABOVE_BIN':
                throw new BadRequestException(BUY_IT_NOW_BELOW_RESERVE_MESSAGE);
            case 'OK':
                break;
        }

        if (Number(row.updated_count) !== 1) {
            throw new ConflictException(
                'The scheduled auction changed while the admin edit was being applied. Refresh and try again.',
            );
        }

        const updated = await this.prisma.auction.findUnique({ where: { id: auctionId } });
        if (!updated || updated.deletedAt) {
            throw new NotFoundException('Auction not found');
        }
        return updated;
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

        type AtomicReserveCorrectionRow = {
            id: string;
            listingId: string;
            auction_status: string;
            old_reserve: unknown;
            starting_bid: unknown;
            min_increment: unknown;
            buy_it_now_price: unknown | null;
            start_time: Date | string;
            end_time: Date | string;
            deleted_at: Date | string | null;
            listing_title: string;
            seller_id: string | null;
            listing_status: string;
            top_bid: unknown | null;
            active_bid_count: number;
            decision_code:
                | 'OK'
                | 'NOT_FOUND'
                | 'INVALID_STATUS'
                | 'LISTING_INACTIVE'
                | 'ENDED'
                | 'ABOVE_BIN'
                | 'RESERVE_ALREADY_MET';
            updated_auction: Record<string, unknown> | null;
        };

        /*
         * Keep the reserve correction atomic without Prisma's interactive
         * transaction connection. Production showed the underlying PostgreSQL
         * lock/read/update sequence is healthy, while the interactive Prisma
         * transaction path could fail before the UPDATE reached Postgres.
         *
         * This single statement:
         *  1. resolves the auction/listing;
         *  2. takes the SAME per-listing advisory xact lock used by bidding;
         *  3. snapshots the active top bid/count only after the lock is held;
         *  4. applies every existing business-rule guard;
         *  5. updates the reserve (and clears pending BIN when reserve becomes
         *     met) before the statement-level transaction releases the lock.
         */
        const rows = await this.prisma.$queryRaw<AtomicReserveCorrectionRow[]>`
            WITH target AS MATERIALIZED (
                SELECT
                    a.id,
                    a."listingId",
                    a.status::text AS auction_status,
                    a."reservePrice" AS old_reserve,
                    a."startingBid" AS starting_bid,
                    a."minIncrement" AS min_increment,
                    a."buyItNowPrice" AS buy_it_now_price,
                    a."startTime" AS start_time,
                    a."endTime" AS end_time,
                    a."deletedAt" AS deleted_at,
                    l.title AS listing_title,
                    l."sellerId" AS seller_id,
                    l.status::text AS listing_status
                FROM "auctions" a
                JOIN "listings" l ON l.id = a."listingId"
                WHERE a.id = ${auctionId}
            ),
            lock_row AS MATERIALIZED (
                SELECT pg_advisory_xact_lock(hashtextextended(t."listingId", 0)) AS locked
                FROM target t
            ),
            snapshot AS MATERIALIZED (
                SELECT
                    t.*,
                    (
                        SELECT MAX(b.amount)
                        FROM "bids" b
                        WHERE b."listingId" = t."listingId"
                          AND b."deletedAt" IS NULL
                          AND b."cancelledAt" IS NULL
                          AND b."archivedAt" IS NULL
                    ) AS top_bid,
                    (
                        SELECT COUNT(*)::int
                        FROM "bids" b
                        WHERE b."listingId" = t."listingId"
                          AND b."deletedAt" IS NULL
                          AND b."cancelledAt" IS NULL
                          AND b."archivedAt" IS NULL
                    ) AS active_bid_count
                FROM target t
                CROSS JOIN lock_row
            ),
            decision AS MATERIALIZED (
                SELECT
                    s.*,
                    CASE
                        WHEN s.deleted_at IS NOT NULL THEN 'NOT_FOUND'
                        WHEN s.auction_status NOT IN ('SCHEDULED', 'ACTIVE') THEN 'INVALID_STATUS'
                        WHEN s.auction_status = 'ACTIVE' AND s.listing_status <> 'ACTIVE' THEN 'LISTING_INACTIVE'
                        WHEN s.auction_status = 'ACTIVE' AND NOW() >= s.end_time THEN 'ENDED'
                        WHEN s.buy_it_now_price IS NOT NULL
                             AND ${reservePrice}::numeric > s.buy_it_now_price THEN 'ABOVE_BIN'
                        WHEN s.auction_status = 'ACTIVE'
                             AND s.top_bid IS NOT NULL
                             AND s.top_bid >= s.old_reserve
                             AND s.top_bid < ${reservePrice}::numeric THEN 'RESERVE_ALREADY_MET'
                        ELSE 'OK'
                    END AS decision_code
                FROM snapshot s
            ),
            updated AS (
                UPDATE "auctions" a
                SET
                    "reservePrice" = ${reservePrice}::numeric,
                    "buyItNowPendingBuyerId" = CASE
                        WHEN d.top_bid IS NOT NULL AND d.top_bid >= ${reservePrice}::numeric
                            THEN NULL
                        ELSE a."buyItNowPendingBuyerId"
                    END,
                    "buyItNowPendingAt" = CASE
                        WHEN d.top_bid IS NOT NULL AND d.top_bid >= ${reservePrice}::numeric
                            THEN NULL
                        ELSE a."buyItNowPendingAt"
                    END,
                    "updatedAt" = NOW()
                FROM decision d
                WHERE a.id = d.id
                  AND d.decision_code = 'OK'
                RETURNING to_jsonb(a) AS updated_auction
            )
            SELECT
                d.*,
                (SELECT updated_auction FROM updated LIMIT 1) AS updated_auction
            FROM decision d
        `;

        const row = rows[0];
        if (!row) {
            throw new NotFoundException('Auction not found');
        }

        switch (row.decision_code) {
            case 'NOT_FOUND':
                throw new NotFoundException('Auction not found');
            case 'INVALID_STATUS':
                throw new BadRequestException('Only SCHEDULED or ACTIVE auctions can have their reserve corrected');
            case 'LISTING_INACTIVE':
                throw new BadRequestException('This auction vehicle is no longer active');
            case 'ENDED':
                throw new BadRequestException(
                    'This auction has ended. Its reserve can no longer be changed while the result is being finalised',
                );
            case 'ABOVE_BIN':
                throw new BadRequestException(BUY_IT_NOW_BELOW_RESERVE_MESSAGE);
            case 'RESERVE_ALREADY_MET':
                throw new BadRequestException(
                    'The reserve has already been met. It cannot be raised above the current highest bid.',
                );
            case 'OK':
                break;
        }

        if (!row.updated_auction) {
            throw new ConflictException(
                'The auction changed while the reserve correction was being applied. Refresh and try again.',
            );
        }

        const oldReserve = Number(row.old_reserve);
        const startingBid = Number(row.starting_bid);
        const minIncrement = Number(row.min_increment);
        const topBidAmount = row.top_bid == null ? null : Number(row.top_bid);
        const activeBidCount = Number(row.active_bid_count || 0);
        const reserveWillBeMet = topBidAmount !== null && topBidAmount >= reservePrice;
        const firstOfferFloor = topBidAmount === null
            ? calculateFirstOfferFloor(startingBid, reservePrice)
            : null;
        const updated = row.updated_auction as unknown as Auction;
        const correction = {
            updated,
            auctionRunKey: this.auctionRunKey({
                id: auctionId,
                startTime: (row.updated_auction as any).startTime ?? row.start_time,
            }),
            listingId: row.listingId,
            listingTitle: row.listing_title,
            sellerId: row.seller_id,
            startingBid,
            minIncrement,
            oldReserve,
            topBidAmount,
            activeBidCount,
            reserveWillBeMet,
            firstOfferFloor,
        };

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
            auction_run_key: correction.auctionRunKey,
            listing_id: correction.listingId,
            old_reserve: correction.oldReserve,
            new_reserve: reservePrice,
            starting_bid: correction.startingBid,
            top_bid_amount: correction.topBidAmount,
            active_bid_count: correction.activeBidCount,
            reserve_met_after: correction.reserveWillBeMet,
            first_offer_floor_after: correction.firstOfferFloor,
            reason: reason?.trim() || null,
        });

        try {
            this.auctionGateway.broadcastPriceUpdated(auctionId, reservePrice);
        } catch (error) {
            this.logger.warn(
                `Reserve corrected for auction ${auctionId}, but live price broadcast failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        return correction.updated;
    }

    /**
     * Admin override: ends a live auction immediately, assigning a specific
     * dealer as winner regardless of whether they ever bid on it. Winning
     * amount is always the Buy It Now price if one was set, otherwise the
     * reserve price — never the current top bid, since the assigned dealer
     * may not have placed one. The dealer still goes through the normal
     * £125 buyer-fee flow afterward; admin assignment does not mark that fee
     * paid, so the chosen dealer follows the same payment gate as any winner.
     */
    async adminAssignWinner(auctionId: string, dealerId: string): Promise<void> {
        const lookup = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            select: { listingId: true, deletedAt: true },
        });
        if (!lookup || lookup.deletedAt) {
            throw new NotFoundException('Auction not found');
        }

        const assigned = await this.prisma.$transaction(async (tx) => {
            // Admin assignment must serialize with bidding, reserve/BIN changes,
            // seller acceptance, BIN confirmation and lifecycle close. The old
            // flow calculated the winning price from a pre-lock snapshot, so a
            // concurrent reserve correction could commit first and the admin
            // assignment could still sell at the stale price.
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lookup.listingId}, 0))`;

            const auction = await tx.auction.findUnique({
                where: { id: auctionId },
                include: {
                    listing: {
                        select: {
                            id: true,
                            sellerId: true,
                            status: true,
                            linkedListingId: true,
                            year: true,
                            make: true,
                            model: true,
                            title: true,
                        },
                    },
                },
            });
            if (!auction || auction.deletedAt) {
                throw new NotFoundException('Auction not found');
            }
            if (auction.status !== 'ACTIVE') {
                throw new BadRequestException('Only ACTIVE (live) auctions can have a winner assigned');
            }
            if (auction.listing.status !== 'ACTIVE') {
                throw new BadRequestException('This auction vehicle is no longer active');
            }
            if (Date.now() >= auction.endTime.getTime()) {
                throw new BadRequestException(
                    'This auction has ended and is being finalised. A winner can no longer be assigned from the live-auction flow',
                );
            }

            // Dealer eligibility is re-read inside the same transaction after
            // the auction lock. This prevents the final assignment from relying
            // on the admin page's earlier dealer snapshot.
            const dealer = await tx.user.findUnique({
                where: { id: dealerId },
                include: { dealerProfile: { select: { isVerified: true, deletedAt: true } } },
            });
            if (!dealer || dealer.deletedAt) {
                throw new NotFoundException('Dealer not found');
            }
            if (
                dealer.role !== 'DEALER'
                || !dealer.dealerProfile
                || dealer.dealerProfile.deletedAt
                || !dealer.dealerProfile.isVerified
            ) {
                throw new BadRequestException('Only verified dealer accounts can be assigned as an auction winner');
            }

            const sellerId = auction.listing.sellerId;
            if (!sellerId) {
                throw new BadRequestException('This listing has no seller on record');
            }
            if (sellerId === dealerId) {
                throw new BadRequestException('Cannot assign the listing\'s own seller as the winning buyer');
            }

            // The business rule is unchanged: admin assignment uses the current
            // BIN price when enabled, otherwise the current reserve. Crucially,
            // "current" now means the authoritative value re-read after this
            // transaction owns the same per-listing lock as all other auction
            // mutations.
            const amount = auction.buyItNowPrice != null
                ? Number(auction.buyItNowPrice)
                : Number(auction.reservePrice);
            if (!Number.isFinite(amount) || amount <= 0) {
                throw new BadRequestException('Winning amount must be greater than £0');
            }

            const activeBidCount = await tx.bid.count({
                where: {
                    listingId: auction.listingId,
                    deletedAt: null,
                    cancelledAt: null,
                    archivedAt: null,
                },
            });

            const wonAt = new Date();
            await tx.auction.update({
                where: { id: auctionId },
                data: {
                    status: 'ENDED',
                    winnerId: dealerId,
                    winningBidAmount: amount,
                    wonAt,
                    buyItNowPendingBuyerId: null,
                    buyItNowPendingAt: null,
                },
            });
            await tx.listing.update({
                where: { id: auction.listingId },
                data: { status: 'SOLD' },
            });
            if (auction.listing.linkedListingId) {
                await tx.listing.update({
                    where: { id: auction.listing.linkedListingId },
                    data: { status: 'SOLD' },
                });
            }
            await tx.sale.create({
                data: {
                    listingId: auction.listingId,
                    sellerId,
                    buyerId: dealerId,
                    soldPrice: amount,
                },
            });
            await tx.sellerProfile.upsert({
                where: { userId: sellerId },
                create: { userId: sellerId, totalSales: 1 },
                update: { totalSales: { increment: 1 } },
            });

            return {
                auction,
                amount,
                activeBidCount,
            };
        });

        const endPayload: AuctionEndPayload = {
            auctionId,
            winnerId: dealerId,
            winningBidAmount: assigned.amount,
            reserveMet: true,
        };
        this.auctionGateway.broadcastAuctionEnd(auctionId, endPayload);

        this.trackAuctionEvent('auction_outcome', {
            auction_id: auctionId,
            auction_run_key: this.auctionRunKey(assigned.auction),
            listing_id: assigned.auction.listingId,
            outcome: 'ADMIN_ASSIGNED_SALE',
            winner_id: dealerId,
            winning_amount: assigned.amount,
            reserve_price: Number(assigned.auction.reservePrice),
            starting_bid: Number(assigned.auction.startingBid),
            had_real_bids: assigned.activeBidCount > 0,
        });
        await this.notifyAuctionEnd(
            assigned.auction,
            dealerId,
            assigned.amount,
            true,
        );
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

            this.trackAuctionEvent('auction_outcome', {
                auction_id: auction.id,
                auction_run_key: this.auctionRunKey(auction),
                listing_id: listing.id,
                outcome: 'WIN_REVERTED_UNPAID',
                former_winner_id: winnerId,
                reserve_price: Number(auction.reservePrice),
                starting_bid: Number(auction.startingBid),
                linked_retail_restored: Boolean(linkedRetailId),
            });

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
            const priorFeeTransaction = auction.buyerFeeTransactionId
                ? await this.prisma.transaction.findUnique({
                      where: { id: auction.buyerFeeTransactionId },
                      select: { amount: true, description: true },
                  })
                : null;
            return {
                refused: true,
                refundedAmount: isAdminGrantedFreePurchaseTransaction(priorFeeTransaction) ? 0 : 125,
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

        let refundedAmount = 0;
        try {
            const refundResult = await this.paymentsService.issueFullRefundForAuctionInspection(auction.id);
            // Production returns the exact refunded amount (125 for a paid fee,
            // 0 for an admin-waived fee). Keep compatibility with older test
            // doubles/implementations that returned void for the normal paid
            // path without ever converting an explicit waived 0 into £125.
            refundedAmount = typeof refundResult === 'number' ? refundResult : 125;
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

        this.trackAuctionEvent('auction_outcome', {
            auction_id: auction.id,
            auction_run_key: this.auctionRunKey(auction),
            listing_id: auction.listing.id,
            outcome: 'BUYER_REFUSED_AFTER_INSPECTION',
            former_winner_id: buyerId,
            reserve_price: Number(auction.reservePrice),
            starting_bid: Number(auction.startingBid),
            inspection_job_id: inspection.id,
            linked_retail_restored: Boolean(linkedRetailId),
        });

        await this.notificationsService.create({
            userId: buyerId,
            type: 'SYSTEM',
            title: 'Vehicle refused after inspection',
            message: refundedAmount > 0
                ? `Your refusal of "${auction.listing.title}" was accepted because the linked inspection recorded faults. Your £125 buyer fee has been refunded.`
                : `Your refusal of "${auction.listing.title}" was accepted because the linked inspection recorded faults. No buyer-fee refund was needed because your Free Purchase Grant covered the fee.`,
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

        return { refused: true, refundedAmount, inspectionJobId: inspection.id };
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
        const auction = await this.assertHandoverSubmissionEligibility(auctionId, userId);
        const sellerId = auction.listing.sellerId;

        const proofPath = typeof proof.proofPath === 'string' ? proof.proofPath.trim() : '';
        const proofUrl = typeof proof.proofUrl === 'string' ? proof.proofUrl.trim() : '';
        if (Boolean(proofPath) === Boolean(proofUrl)) {
            throw new BadRequestException('Submit exactly one handover proof');
        }
        if (proofPath && (!proofPath.startsWith(`${auctionId}/`) || proofPath.includes('..'))) {
            throw new BadRequestException('Invalid private handover proof path');
        }
        if (proofUrl) {
            const marker = '/storage/v1/object/public/listings/';
            const at = proofUrl.indexOf(marker);
            const key = at === -1
                ? ''
                : decodeURIComponent(proofUrl.slice(at + marker.length).split('?')[0] || '');
            if (!(key.startsWith('handover/') || key.includes('/handover/'))) {
                throw new BadRequestException('Invalid legacy handover proof URL');
            }
        }

        const updated = await this.prisma.auction.update({
            where: {
                id: auctionId,
                status: 'ENDED',
                winnerId: auction.winnerId,
                buyerFeePaid: true,
                buyerFeeTransactionId: auction.buyerFeeTransactionId,
                buyerRefusedAt: null,
                sellerBonusReleased: false,
                handoverSubmittedAt: null,
            },
            data: {
                // Exactly one of these is set. A private upload leaves the
                // legacy column null so nothing public is ever recorded for it.
                handoverProofUrl: proofPath ? null : proofUrl,
                handoverProofPath: proofPath || null,
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
        const sellerEarlyClose = options?.sellerEarlyClose === true;
        const requestedSellerId = options?.sellerId ?? null;

        type AtomicAuctionCloseRow = {
            auction_id: string;
            listing_id: string;
            seller_id: string | null;
            reserve_price: unknown;
            starting_bid: unknown;
            start_time: Date | string;
            end_time: Date | string;
            top_bid_id: string | null;
            top_bidder_id: string | null;
            top_bid_amount: unknown | null;
            reserve_met: boolean;
            linked_listing_id: string | null;
            decision_code:
                | 'OK'
                | 'NOT_FOUND'
                | 'NOT_ACTIVE'
                | 'LISTING_INACTIVE'
                | 'NOT_OWNER'
                | 'ENDED'
                | 'NOT_DUE'
                | 'RESERVE_MET';
            winner_id: string | null;
            winning_amount: unknown | null;
            sale_completed: boolean;
            outcome_type:
                | 'RESERVE_MET_SALE'
                | 'SELLER_EARLY_CLOSE_UNSOLD'
                | 'BELOW_RESERVE_UNSOLD'
                | 'NO_BIDS_UNSOLD'
                | null;
            updated_count: number;
        };

        /*
         * Timed auction finalisation is deliberately a single PostgreSQL
         * statement. The former Prisma interactive transaction could fail on
         * the pooled production connection before any write reached Postgres,
         * leaving auctions stuck ACTIVE after endTime.
         *
         * This statement shares the exact advisory lock used by bidding,
         * cancellation and reserve correction, so a last-second bid/anti-snipe
         * extension is serialised against closing. It atomically updates the
         * Auction, Listing, linked retail listing, Sale and SellerProfile.
         */
        const rows = await this.prisma.$queryRaw<AtomicAuctionCloseRow[]>`
            WITH target AS MATERIALIZED (
                SELECT
                    a.id AS auction_id,
                    a."listingId" AS listing_id,
                    a.status::text AS auction_status,
                    a."deletedAt" AS auction_deleted_at,
                    a."reservePrice" AS reserve_price,
                    a."startingBid" AS starting_bid,
                    a."startTime" AS start_time,
                    a."endTime" AS end_time,
                    l.status::text AS listing_status,
                    l."deletedAt" AS listing_deleted_at,
                    l."sellerId" AS seller_id,
                    l."linkedListingId" AS linked_listing_id
                FROM "auctions" a
                JOIN "listings" l ON l.id = a."listingId"
                WHERE a.id = ${auctionId}
            ),
            lock_row AS MATERIALIZED (
                SELECT pg_advisory_xact_lock(hashtextextended(t.listing_id, 0)) AS locked
                FROM target t
            ),
            snapshot AS MATERIALIZED (
                SELECT
                    t.*,
                    top_bid.id AS top_bid_id,
                    top_bid."bidderId" AS top_bidder_id,
                    top_bid.amount AS top_bid_amount,
                    (
                        top_bid.id IS NOT NULL
                        AND top_bid.amount >= t.reserve_price
                    ) AS reserve_met
                FROM target t
                CROSS JOIN lock_row
                LEFT JOIN LATERAL (
                    SELECT b.id, b."bidderId", b.amount
                    FROM "bids" b
                    WHERE b."listingId" = t.listing_id
                      AND b."deletedAt" IS NULL
                      AND b."cancelledAt" IS NULL
                      AND b."archivedAt" IS NULL
                    ORDER BY b.amount DESC, b."timestamp" DESC
                    LIMIT 1
                ) top_bid ON TRUE
            ),
            decision AS MATERIALIZED (
                SELECT
                    s.*,
                    CASE
                        WHEN s.auction_deleted_at IS NOT NULL OR s.listing_deleted_at IS NOT NULL THEN 'NOT_FOUND'
                        WHEN s.auction_status <> 'ACTIVE' THEN 'NOT_ACTIVE'
                        WHEN s.listing_status <> 'ACTIVE' THEN 'LISTING_INACTIVE'
                        WHEN ${sellerEarlyClose}::boolean
                             AND (s.seller_id IS NULL OR s.seller_id <> ${requestedSellerId}) THEN 'NOT_OWNER'
                        WHEN ${sellerEarlyClose}::boolean
                             AND NOW() >= s.end_time THEN 'ENDED'
                        WHEN NOT ${sellerEarlyClose}::boolean
                             AND NOW() < s.end_time THEN 'NOT_DUE'
                        WHEN ${sellerEarlyClose}::boolean
                             AND s.reserve_met THEN 'RESERVE_MET'
                        ELSE 'OK'
                    END AS decision_code
                FROM snapshot s
            ),
            outcome AS MATERIALIZED (
                SELECT
                    d.*,
                    (
                        d.decision_code = 'OK'
                        AND NOT ${sellerEarlyClose}::boolean
                        AND d.reserve_met
                    ) AS sale_completed,
                    CASE
                        WHEN d.decision_code <> 'OK' THEN NULL
                        WHEN NOT ${sellerEarlyClose}::boolean AND d.reserve_met THEN d.top_bidder_id
                        ELSE NULL
                    END AS winner_id,
                    CASE
                        WHEN d.decision_code = 'OK'
                             AND NOT ${sellerEarlyClose}::boolean
                             AND d.reserve_met THEN d.top_bid_amount
                        ELSE NULL
                    END AS winning_amount,
                    CASE
                        WHEN d.decision_code <> 'OK' THEN NULL
                        WHEN NOT ${sellerEarlyClose}::boolean AND d.reserve_met
                            THEN 'RESERVE_MET_SALE'
                        WHEN ${sellerEarlyClose}::boolean
                            THEN 'SELLER_EARLY_CLOSE_UNSOLD'
                        WHEN d.top_bid_id IS NOT NULL
                            THEN 'BELOW_RESERVE_UNSOLD'
                        ELSE 'NO_BIDS_UNSOLD'
                    END AS outcome_type
                FROM decision d
            ),
            auction_updated AS (
                UPDATE "auctions" a
                SET
                    status = 'ENDED',
                    "winnerId" = o.winner_id,
                    "winningBidAmount" = o.winning_amount,
                    "wonAt" = CASE WHEN o.sale_completed THEN NOW() ELSE NULL END,
                    "buyItNowPendingBuyerId" = NULL,
                    "buyItNowPendingAt" = NULL,
                    "updatedAt" = NOW()
                FROM outcome o
                WHERE a.id = o.auction_id
                  AND o.decision_code = 'OK'
                RETURNING a.id
            ),
            listing_updated AS (
                UPDATE "listings" l
                SET
                    status = CASE WHEN o.sale_completed THEN 'SOLD'::listing_status ELSE 'DRAFT'::listing_status END,
                    type = CASE
                        WHEN o.sale_completed THEN l.type
                        WHEN o.linked_listing_id IS NOT NULL THEN 'AUCTION'::listing_type
                        ELSE 'CLASSIFIED'::listing_type
                    END,
                    "linkedListingId" = CASE
                        WHEN o.sale_completed OR o.linked_listing_id IS NOT NULL THEN l."linkedListingId"
                        ELSE NULL
                    END,
                    "updatedAt" = NOW()
                FROM outcome o
                WHERE l.id = o.listing_id
                  AND o.decision_code = 'OK'
                RETURNING l.id
            ),
            linked_listing_updated AS (
                UPDATE "listings" l
                SET
                    status = 'SOLD'::listing_status,
                    "updatedAt" = NOW()
                FROM outcome o
                WHERE o.decision_code = 'OK'
                  AND o.sale_completed
                  AND o.linked_listing_id IS NOT NULL
                  AND l.id = o.linked_listing_id
                RETURNING l.id
            ),
            sale_created AS (
                INSERT INTO "sales" (
                    id,
                    "listingId",
                    "sellerId",
                    "buyerId",
                    "soldPrice",
                    "updatedAt"
                )
                SELECT
                    gen_random_uuid()::text,
                    o.listing_id,
                    o.seller_id,
                    o.winner_id,
                    o.winning_amount,
                    NOW()
                FROM outcome o
                WHERE o.decision_code = 'OK'
                  AND o.sale_completed
                  AND o.seller_id IS NOT NULL
                  AND o.winner_id IS NOT NULL
                  AND o.winning_amount IS NOT NULL
                ON CONFLICT ("listingId") DO NOTHING
                RETURNING id
            ),
            seller_profile_updated AS (
                INSERT INTO "seller_profiles" (
                    id,
                    "userId",
                    "totalSales",
                    "updatedAt"
                )
                SELECT
                    gen_random_uuid()::text,
                    o.seller_id,
                    1,
                    NOW()
                FROM outcome o
                WHERE o.decision_code = 'OK'
                  AND o.sale_completed
                  AND o.seller_id IS NOT NULL
                ON CONFLICT ("userId") DO UPDATE
                SET
                    "totalSales" = "seller_profiles"."totalSales" + 1,
                    "updatedAt" = NOW()
                RETURNING id
            )
            SELECT
                o.auction_id,
                o.listing_id,
                o.seller_id,
                o.reserve_price,
                o.starting_bid,
                o.start_time,
                o.end_time,
                o.top_bid_id,
                o.top_bidder_id,
                o.top_bid_amount,
                o.reserve_met,
                o.linked_listing_id,
                o.decision_code,
                o.winner_id,
                o.winning_amount,
                o.sale_completed,
                o.outcome_type,
                (SELECT COUNT(*)::int FROM auction_updated) AS updated_count
            FROM outcome o
        `;

        const row = rows[0];
        if (!row) return;

        switch (row.decision_code) {
            case 'NOT_FOUND':
            case 'NOT_ACTIVE':
            case 'NOT_DUE':
                return;
            case 'LISTING_INACTIVE':
                if (sellerEarlyClose) {
                    throw new BadRequestException('This auction vehicle is no longer active');
                }
                return;
            case 'NOT_OWNER':
                throw new ForbiddenException('You do not own this auction');
            case 'ENDED':
                throw new BadRequestException(
                    'This auction has ended and is being finalised. It can no longer be closed early',
                );
            case 'RESERVE_MET':
                throw new BadRequestException(
                    'The reserve has been met. The auction must continue normally until it ends.',
                );
            case 'OK':
                break;
        }

        if (Number(row.updated_count) !== 1 || !row.outcome_type) {
            throw new ConflictException(
                'The auction changed while it was being finalised. Refresh and try again.',
            );
        }

        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            include: { listing: true },
        });
        if (!auction) return;

        const winningAmount = row.winning_amount == null ? null : Number(row.winning_amount);
        const highestBidAmount = row.top_bid_amount == null ? null : Number(row.top_bid_amount);
        const saleCompleted = Boolean(row.sale_completed);

        this.trackAuctionEvent('auction_outcome', {
            auction_id: auctionId,
            auction_run_key: this.auctionRunKey(auction),
            listing_id: auction.listingId,
            outcome: row.outcome_type,
            winner_id: row.winner_id,
            winning_amount: winningAmount,
            highest_bid_amount: highestBidAmount,
            reserve_price: Number(row.reserve_price),
            starting_bid: Number(row.starting_bid),
            had_real_bids: highestBidAmount !== null,
            seller_early_close: sellerEarlyClose,
        });

        const endPayload: AuctionEndPayload = {
            auctionId,
            winnerId: row.winner_id,
            winningBidAmount: winningAmount,
            reserveMet: saleCompleted,
        };
        this.auctionGateway.broadcastAuctionEnd(auctionId, endPayload);
        await this.notifyAuctionEnd(
            auction,
            row.winner_id,
            winningAmount,
            saleCompleted,
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
            // An admin Free Purchase Grant is applied at the moment the auction
            // becomes a completed win. That keeps web and mobile on the existing
            // buyerFeePaid lifecycle: no Stripe checkout is created, but seller
            // contact/chat and the handover flow unlock exactly as they do after
            // a normal £125 fee payment.
            let buyerFeeWaived = false;
            if (this.freeListingGrantsService) {
                try {
                    buyerFeeWaived = await this.freeListingGrantsService
                        .applyPurchaseGrantToAuctionIfEligible(auction.id, winnerId);
                } catch (error: any) {
                    this.logger.error(
                        `Could not apply free purchase grant for auction ${auction.id}: ${error?.message || error}`,
                    );
                }
            }

            // Notify winner — persisted + push delivered via notificationsService.create()
            await this.notificationsService.create({
                userId: winnerId,
                type: 'AUCTION_WON',
                title: 'You won the auction!',
                message: buyerFeeWaived
                    ? `You won the auction for ${vehicle} with a bid of £${winningAmount.toLocaleString()}. Your Free Purchase Grant covered the £125 CarMazium buyer fee, so seller contact details and auction chat are unlocked.`
                    : `You won the auction for ${vehicle} with a bid of £${winningAmount.toLocaleString()}. Pay the £125 CarMazium buyer fee to unlock the seller's contact details and auction chat.`,
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
                    message: buyerFeeWaived
                        ? `Your auction for ${vehicle} has ended. Winning bid: £${winningAmount.toLocaleString()}. CarMazium covered the winning dealer's buyer fee under an admin grant, so seller contact and auction chat are already unlocked. Your £100 seller bonus remains eligible after approved handover.`
                        : `Your auction for ${vehicle} has ended. Winning bid: £${winningAmount.toLocaleString()}. The winning dealer must pay the £125 CarMazium buyer fee before seller contact and auction chat are unlocked.`,
                    entityType: 'AUCTION',
                    entityId: auction.id,
                    link: `/dashboard/seller/auctions`,
                });
            }

            // Without a grant, auction chat remains fee-gated until Stripe
            // confirms the normal £125 buyer fee. A granted purchase already
            // has buyerFeePaid=true via the £0 audit transaction above.

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
                this.emailService.sendAuctionWonEmail(
                    buyer.email,
                    buyer.firstName || 'there',
                    vehicle || listing.title,
                    winningAmount,
                    auction.id,
                    buyerFeeWaived,
                ).catch(console.error);
            }
            if (seller?.email) {
                this.emailService.sendAuctionEndedSellerEmail(
                    seller.email,
                    seller.firstName || 'there',
                    vehicle || listing.title,
                    winningAmount,
                    auction.id,
                    buyerFeeWaived,
                ).catch(console.error);
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
     * Buyer triggers a Buy It Now request. Sets pending state, notifies seller, broadcasts to viewers.
     */
    async triggerBuyItNow(
        auctionId: string,
        buyerId: string,
    ): Promise<{ created: boolean; pendingAt: string; responseDeadline: string }> {
        // Buy It Now is an auction purchase commitment and must obey the exact
        // same verified-dealer / dealership-permission boundary as bidding.
        const user = await this.prisma.user.findUnique({
            where: { id: buyerId },
            select: { role: true },
        });
        if (user?.role !== 'DEALER') {
            throw new ForbiddenException('Only verified dealers can use Buy It Now on auctions.');
        }

        const dealerActor = await resolveDealerActor(this.prisma, buyerId);
        if (!dealerActor?.isVerified) {
            throw new ForbiddenException('Only verified dealers can use Buy It Now on auctions.');
        }
        assertDealerPermission(
            dealerActor,
            'PLACE_BID',
            'Your dealership role does not allow auction purchase commitments.',
        );
        const businessBuyerId = dealerActor.ownerUserId;

        const lookup = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            select: { listingId: true, deletedAt: true },
        });
        if (!lookup || lookup.deletedAt) {
            throw new NotFoundException('Auction not found');
        }

        const requested = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lookup.listingId}, 0))`;

            const auction = await tx.auction.findUnique({
                where: { id: auctionId },
                include: {
                    listing: {
                        select: {
                            id: true,
                            sellerId: true,
                            status: true,
                            make: true,
                            model: true,
                        },
                    },
                },
            });
            if (!auction || auction.deletedAt) {
                throw new NotFoundException('Auction not found');
            }
            if (auction.status !== 'ACTIVE') {
                throw new BadRequestException('Auction is not ACTIVE');
            }
            if (auction.listing.status !== 'ACTIVE') {
                throw new BadRequestException('This auction vehicle is no longer active');
            }
            if (Date.now() >= auction.endTime.getTime()) {
                throw new BadRequestException('This auction has ended and is no longer accepting Buy It Now requests');
            }
            if (!auction.buyItNowPrice) {
                throw new BadRequestException('No Buy It Now price set on this auction');
            }
            if (auction.listing.sellerId === businessBuyerId) {
                throw new BadRequestException('You cannot buy your own auction');
            }

            const topBid = await tx.bid.findFirst({
                where: {
                    listingId: auction.listingId,
                    deletedAt: null,
                    cancelledAt: null,
                    archivedAt: null,
                },
                orderBy: { amount: 'desc' },
            });
            if (topBid && Number(topBid.amount) >= Number(auction.reservePrice)) {
                throw new BadRequestException('Reserve is met — Buy It Now is no longer available');
            }

            // The pending BIN slot belongs to one dealership at a time.
            // This check deliberately happens AFTER acquiring the same
            // per-listing advisory lock used by bids / BIN confirm / decline,
            // so two buyers cannot both observe an empty slot and overwrite
            // each other.
            const now = Date.now();
            const existingPendingAt = auction.buyItNowPendingAt;
            const existingPendingBuyerId = auction.buyItNowPendingBuyerId;
            const existingResponseDeadline = existingPendingAt
                ? calculateBuyItNowResponseDeadline(existingPendingAt, auction.endTime)
                : null;
            const existingPendingIsUnexpired = Boolean(
                existingPendingBuyerId
                && existingPendingAt
                && existingResponseDeadline
                && existingResponseDeadline.getTime() > now,
            );

            if (existingPendingIsUnexpired) {
                if (existingPendingBuyerId === businessBuyerId) {
                    // Same dealership retry (including another authorised staff
                    // user acting for the same dealer owner): idempotent no-op.
                    // Do not reset the response clock and do not send duplicate
                    // seller notifications / websocket events.
                    return {
                        auction,
                        pendingAt: existingPendingAt!,
                        responseDeadline: existingResponseDeadline!,
                        created: false,
                    };
                }

                throw new ConflictException(
                    'Another dealership already has a Buy It Now request awaiting the seller response.',
                );
            }

            const pendingAt = new Date();
            const responseDeadline = calculateBuyItNowResponseDeadline(
                pendingAt,
                auction.endTime,
            );
            await tx.auction.update({
                where: { id: auctionId },
                data: {
                    buyItNowPendingBuyerId: businessBuyerId,
                    buyItNowPendingAt: pendingAt,
                },
            });

            return {
                auction,
                pendingAt,
                responseDeadline,
                created: true,
            };
        });

        if (!requested.created) {
            return {
                created: false,
                pendingAt: requested.pendingAt.toISOString(),
                responseDeadline: requested.responseDeadline.toISOString(),
            };
        }

        if (requested.auction.listing.sellerId) {
            const deadlineLabel = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/London',
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(requested.responseDeadline);

            await this.notificationsService.create({
                userId: requested.auction.listing.sellerId,
                type: 'AUCTION_ENDED',
                title: 'Buy It Now request received',
                message: `A buyer wants to buy your ${requested.auction.listing.make} ${requested.auction.listing.model} for £${Number(requested.auction.buyItNowPrice).toLocaleString()}. Respond by ${deadlineLabel}; the request expires at the earlier of 24 hours or auction close.`,
                entityType: 'AUCTION',
                entityId: auctionId,
                link: `/auctions/live/${auctionId}`,
                data: {
                    responseDeadline: requested.responseDeadline.toISOString(),
                },
            });
        }

        this.auctionGateway.broadcastBinPending(
            auctionId,
            businessBuyerId,
            requested.responseDeadline.toISOString(),
        );

        return {
            created: requested.created,
            pendingAt: requested.pendingAt.toISOString(),
            responseDeadline: requested.responseDeadline.toISOString(),
        };
    }

    /**
     * Seller confirms the Buy It Now request — ends the auction with the pending buyer as winner.
     */
    async confirmBuyItNow(auctionId: string, sellerId: string): Promise<void> {
        const businessSellerId = await this.resolveSellerBusinessId(sellerId, 'MANAGE_INVENTORY');

        const lookup = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            select: { listingId: true, deletedAt: true },
        });
        if (!lookup || lookup.deletedAt) {
            throw new NotFoundException('Auction not found');
        }

        const confirmed = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lookup.listingId}, 0))`;

            const auction = await tx.auction.findUnique({
                where: { id: auctionId },
                include: {
                    listing: {
                        select: {
                            id: true,
                            sellerId: true,
                            status: true,
                            linkedListingId: true,
                            make: true,
                            model: true,
                            title: true,
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
                throw new BadRequestException('Auction is not ACTIVE');
            }
            if (auction.listing.status !== 'ACTIVE') {
                throw new BadRequestException('This auction vehicle is no longer active');
            }
            if (!auction.buyItNowPendingBuyerId || !auction.buyItNowPendingAt) {
                throw new BadRequestException('No Buy It Now request is pending on this auction');
            }
            const responseDeadline = calculateBuyItNowResponseDeadline(
                auction.buyItNowPendingAt,
                auction.endTime,
            );
            if (responseDeadline.getTime() <= Date.now()) {
                throw new BadRequestException('The Buy It Now request has expired');
            }
            if (!auction.buyItNowPrice) {
                throw new BadRequestException('No Buy It Now price set on this auction');
            }

            // A bid that reached reserve wins the race over a stale BIN confirm.
            // Both paths share this advisory lock, so this check is authoritative.
            const [topBid, activeBidCount] = await Promise.all([
                tx.bid.findFirst({
                    where: {
                        listingId: auction.listingId,
                        deletedAt: null,
                        cancelledAt: null,
                        archivedAt: null,
                    },
                    orderBy: { amount: 'desc' },
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
            if (topBid && Number(topBid.amount) >= Number(auction.reservePrice)) {
                throw new BadRequestException('Reserve is met — Buy It Now can no longer be confirmed');
            }

            const pendingBuyerId = auction.buyItNowPendingBuyerId;
            const binPrice = Number(auction.buyItNowPrice);
            const wonAt = new Date();

            await tx.auction.update({
                where: { id: auctionId },
                data: {
                    status: 'ENDED',
                    winnerId: pendingBuyerId,
                    winningBidAmount: binPrice,
                    wonAt,
                    buyItNowPendingBuyerId: null,
                    buyItNowPendingAt: null,
                },
            });
            await tx.listing.update({
                where: { id: auction.listingId },
                data: { status: 'SOLD' },
            });
            if (auction.listing.linkedListingId) {
                await tx.listing.update({
                    where: { id: auction.listing.linkedListingId },
                    data: { status: 'SOLD' },
                });
            }
            await tx.sale.create({
                data: {
                    listingId: auction.listingId,
                    sellerId: businessSellerId,
                    buyerId: pendingBuyerId,
                    soldPrice: binPrice,
                },
            });
            await tx.sellerProfile.upsert({
                where: { userId: businessSellerId },
                create: { userId: businessSellerId, totalSales: 1 },
                update: { totalSales: { increment: 1 } },
            });

            return {
                auction,
                pendingBuyerId,
                binPrice,
                activeBidCount,
            };
        });

        this.trackAuctionEvent('auction_outcome', {
            auction_id: auctionId,
            auction_run_key: this.auctionRunKey(confirmed.auction),
            listing_id: confirmed.auction.listingId,
            outcome: 'BUY_IT_NOW_SALE',
            winner_id: confirmed.pendingBuyerId,
            winning_amount: confirmed.binPrice,
            reserve_price: Number(confirmed.auction.reservePrice),
            starting_bid: Number(confirmed.auction.startingBid),
            had_real_bids: confirmed.activeBidCount > 0,
        }, businessSellerId);

        const endPayload: AuctionEndPayload = {
            auctionId,
            winnerId: confirmed.pendingBuyerId,
            winningBidAmount: confirmed.binPrice,
            reserveMet: true,
        };
        this.auctionGateway.broadcastAuctionEnd(auctionId, endPayload);
        await this.notifyAuctionEnd(
            { ...confirmed.auction, id: auctionId },
            confirmed.pendingBuyerId,
            confirmed.binPrice,
            true,
        );
    }

    /**
     * Seller declines the Buy It Now request — clears pending state, notifies buyer, auction resumes.
     */
    async declineBuyItNow(auctionId: string, sellerId: string): Promise<void> {
        const businessSellerId = await this.resolveSellerBusinessId(sellerId, 'MANAGE_INVENTORY');

        const lookup = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            select: { listingId: true, deletedAt: true },
        });
        if (!lookup || lookup.deletedAt) {
            throw new NotFoundException('Auction not found');
        }

        const declined = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lookup.listingId}, 0))`;

            const auction = await tx.auction.findUnique({
                where: { id: auctionId },
                include: {
                    listing: {
                        select: {
                            sellerId: true,
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
                throw new BadRequestException('Auction is not ACTIVE');
            }

            const pendingBuyerId = auction.buyItNowPendingBuyerId;
            if (!pendingBuyerId) {
                throw new BadRequestException('No Buy It Now request is pending on this auction');
            }

            await tx.auction.update({
                where: { id: auctionId },
                data: { buyItNowPendingBuyerId: null, buyItNowPendingAt: null },
            });

            return { auction, pendingBuyerId };
        });

        await this.notificationsService.create({
            userId: declined.pendingBuyerId,
            type: 'AUCTION_ENDED',
            title: 'Buy It Now request declined',
            message: `The seller declined your Buy It Now request on ${declined.auction.listing.make} ${declined.auction.listing.model}. You can continue bidding.`,
            entityType: 'AUCTION',
            entityId: auctionId,
            link: `/auctions/live/${auctionId}`,
        });
    }

    /**
     * Lazily clears expired BIN pending state on read. The canonical deadline is
     * server-owned: the earlier of request + 24 hours or auction endTime.
     * Fire-and-forget DB cleanup keeps the response fast while returning the
     * canonical cleared state immediately.
     */
    private clearExpiredBin(auction: any): any {
        if (!auction.buyItNowPendingAt || !auction.buyItNowPendingBuyerId) {
            return {
                ...auction,
                buyItNowResponseDeadline: null,
            };
        }

        const responseDeadline = calculateBuyItNowResponseDeadline(
            auction.buyItNowPendingAt,
            auction.endTime,
        );

        if (responseDeadline.getTime() <= Date.now()) {
            // Fire-and-forget — do not block the response. The returned payload
            // is already canonical for the client, while the DB cleanup makes
            // the same state durable for later requests.
            this.prisma.auction.update({
                where: { id: auction.id },
                data: { buyItNowPendingBuyerId: null, buyItNowPendingAt: null },
            }).catch(() => { /* non-blocking */ });

            return {
                ...auction,
                buyItNowPendingBuyerId: null,
                buyItNowPendingAt: null,
                buyItNowResponseDeadline: null,
            };
        }

        return {
            ...auction,
            buyItNowResponseDeadline: responseDeadline.toISOString(),
        };
    }
}
