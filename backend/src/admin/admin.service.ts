import { Injectable, Logger, NotFoundException, BadRequestException, BadGatewayException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { UserRole } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
import { AdminUpdateListingDto } from './dto/admin-update-listing.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { SellersService } from '../sellers/sellers.service';
import { AuctionsService } from '../auctions/auctions.service';
import { HandoverDocumentsService } from '../auctions/handover-documents.service';
import { buildListingActivationData } from '../listings/listing-activation';
import { getListingSubmissionReadiness } from '../listings/listing-readiness';
import { sellerBonusEmailState, SellerBonusEmailState } from './seller-bonus-email-state';
import { classifyHistoricalAuction } from './auction-history-reconciliation';
import {
    AUCTION_DURATION_MS,
    BUY_IT_NOW_BELOW_RESERVE_MESSAGE,
    buyItNowViolatesReserve,
    calculatePlatformOpeningBid,
} from '../auctions/auction-pricing';

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly paymentsService: PaymentsService,
        private readonly emailService: EmailService,
        private readonly notificationsGateway: NotificationsGateway,
        private readonly notificationsService: NotificationsService,
        private readonly sellersService: SellersService,
        private readonly auctionsService: AuctionsService,
        private readonly handoverDocuments: HandoverDocumentsService,
    ) { }

    async getAllUsers(page = 1, limit = 20, search?: string) {
        const skip = (page - 1) * limit;
        const where = search
            ? {
                  OR: [
                      { email: { contains: search, mode: 'insensitive' as const } },
                      { firstName: { contains: search, mode: 'insensitive' as const } },
                      { lastName: { contains: search, mode: 'insensitive' as const } },
                  ],
              }
            : undefined;

        const [data, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isEmailVerified: true,
                    createdAt: true,
                    deletedAt: true,
                    lockoutUntil: true,
                    dealerProfile: { select: { isVerified: true, companyName: true } },
                    _count: { select: { listings: true } },
                    phone: true,
                    stripeConnectOnboardingComplete: true,
                    bankAccountName: true,
                    bankSortCode: true,
                    bankAccountNumber: true,
                    payoutPreference: true,
                },
            }),
            this.prisma.user.count({ where }),
        ]);
        return { data, total };
    }

    /**
     * Full profile for the admin "view details" panel — everything the list
     * endpoints deliberately keep lightweight: phone, dealer profile + full
     * KYC record (including document URLs, which otherwise become
     * unreachable the moment a KYC is approved and drops out of
     * getPendingKyc), seller profile, and recent activity.
     */
    async getUserDetail(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                profileImage: true,
                isEmailVerified: true,
                isPhoneVerified: true,
                isAddressVerified: true,
                addressVerifiedAt: true,
                location: true,
                postcode: true,
                notifyOnSale: true,
                showPublicProfile: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                lockoutUntil: true,
                loginAttempts: true,
                stripeCustomerId: true,
                stripeConnectAccountId: true,
                stripeConnectOnboardingComplete: true,
                bankAccountName: true,
                bankSortCode: true,
                bankAccountNumber: true,
                payoutPreference: true,
                dealerProfile: {
                    include: { kyc: true },
                },
                sellerProfile: true,
                _count: {
                    select: {
                        listings: true,
                        transactions: true,
                        wonAuctions: true,
                        salesAsSeller: true,
                        purchasesAsBuyer: true,
                    },
                },
            },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const [recentListings, recentTransactions] = await Promise.all([
            this.prisma.listing.findMany({
                where: { sellerId: id, deletedAt: null },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, title: true, slug: true, status: true, price: true, createdAt: true },
            }),
            this.prisma.transaction.findMany({
                where: { userId: id, deletedAt: null },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: { id: true, type: true, status: true, amount: true, stripePaymentId: true, description: true, createdAt: true },
            }),
        ]);

        // `User.loginAttempts` is a legacy failed-password streak used by the
        // backend login endpoint. The live site authenticates through Supabase,
        // so showing that value as total "Login Attempts" made every active
        // account appear to have zero. Read the authoritative Supabase Auth
        // audit history instead. This is read-only and requires no schema change.
        type AuthActivityRow = {
            successfulLogins: number;
            firstLoginAt: Date | null;
            lastLoginAt: Date | null;
            lastSignInAt: Date | null;
            emailConfirmedAt: Date | null;
            phoneConfirmedAt: Date | null;
            providers: unknown;
            primaryProvider: string | null;
            isSsoUser: boolean | null;
        };

        let authActivity: Record<string, unknown> = { source: 'UNAVAILABLE' };
        try {
            const rows = await this.prisma.$queryRaw<AuthActivityRow[]>`
                SELECT
                    (
                        SELECT COUNT(*)::int
                        FROM auth.audit_log_entries ale
                        WHERE ale.payload->>'action' = 'login'
                          AND (
                              ale.payload->>'actor_id' = au.id::text
                              OR lower(coalesce(ale.payload->>'actor_username', '')) = lower(au.email)
                          )
                    ) AS "successfulLogins",
                    (
                        SELECT MIN(ale.created_at)
                        FROM auth.audit_log_entries ale
                        WHERE ale.payload->>'action' = 'login'
                          AND (
                              ale.payload->>'actor_id' = au.id::text
                              OR lower(coalesce(ale.payload->>'actor_username', '')) = lower(au.email)
                          )
                    ) AS "firstLoginAt",
                    (
                        SELECT MAX(ale.created_at)
                        FROM auth.audit_log_entries ale
                        WHERE ale.payload->>'action' = 'login'
                          AND (
                              ale.payload->>'actor_id' = au.id::text
                              OR lower(coalesce(ale.payload->>'actor_username', '')) = lower(au.email)
                          )
                    ) AS "lastLoginAt",
                    au.last_sign_in_at AS "lastSignInAt",
                    au.email_confirmed_at AS "emailConfirmedAt",
                    au.phone_confirmed_at AS "phoneConfirmedAt",
                    coalesce(au.raw_app_meta_data->'providers', '[]'::jsonb) AS providers,
                    au.raw_app_meta_data->>'provider' AS "primaryProvider",
                    au.is_sso_user AS "isSsoUser"
                FROM auth.users au
                WHERE lower(au.email) = lower(${user.email})
                LIMIT 1
            `;

            const row = rows[0];
            if (row) {
                const listedProviders = Array.isArray(row.providers)
                    ? row.providers.map((provider) => String(provider))
                    : [];
                const providers = Array.from(new Set([
                    ...listedProviders,
                    ...(row.primaryProvider ? [row.primaryProvider] : []),
                ]));

                authActivity = {
                    source: 'SUPABASE',
                    successfulLogins: row.successfulLogins ?? 0,
                    firstLoginAt: row.firstLoginAt,
                    lastLoginAt: row.lastLoginAt,
                    lastSignInAt: row.lastSignInAt,
                    emailConfirmedAt: row.emailConfirmedAt,
                    phoneConfirmedAt: row.phoneConfirmedAt,
                    providers,
                    isSsoUser: !!row.isSsoUser,
                };
            } else {
                authActivity = { source: 'LOCAL' };
            }
        } catch {
            // Account detail must remain usable even if the deployment's DB
            // role cannot read Supabase's auth schema. The UI will explicitly
            // show authentication activity as unavailable instead of lying with 0.
            authActivity = { source: 'UNAVAILABLE' };
        }

        return { ...user, authActivity, recentListings, recentTransactions };
    }

    async updateUserRole(userId: string, role: UserRole) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { role },
        });
    }

    async banUser(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        if (user.role === 'ADMIN') throw new BadRequestException('Cannot ban another admin');
        return this.prisma.user.update({
            where: { id: userId },
            data: { deletedAt: new Date() },
        });
    }

    async unbanUser(userId: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { deletedAt: null },
        });
    }

    async lockUser(userId: string) {
        const lockUntil = new Date(Date.now() + AUCTION_DURATION_MS);
        return this.prisma.user.update({
            where: { id: userId },
            data: { lockoutUntil: lockUntil },
        });
    }

    async unlockUser(userId: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { lockoutUntil: null, loginAttempts: 0 },
        });
    }

    async verifyUser(userId: string, isVerified: boolean) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { dealerProfile: true } });

        if (user?.role === 'DEALER' && user.dealerProfile) {
            await this.prisma.dealerProfile.update({
                where: { userId },
                data: { isVerified },
            });
        }

        return this.prisma.user.update({
            where: { id: userId },
            data: { isEmailVerified: isVerified },
        });
    }

    /**
     * `sellerRole` narrows to listings created by accounts of that role. The
     * admin dashboard uses it for the "CarMazium" filter — admins can list
     * directly now, and their vehicles would otherwise be buried among every
     * seller's.
     *
     * The same `where` is applied to the count as well as the rows. Filtering
     * only the rows would leave the total describing a different set, and the
     * pager would offer pages that come back empty.
     */
    async getAllListings(page = 1, limit = 20, sellerRole?: string, status?: string) {
        const skip = (page - 1) * limit;
        const where = {
            ...(sellerRole ? { seller: { role: sellerRole as any } } : {}),
            ...(status === 'DRAFT' ? { status: 'DRAFT' as const } : {}),
        };
        const [data, total] = await Promise.all([
            this.prisma.listing.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    seller: {
                        select: {
                            id: true, email: true, firstName: true, lastName: true, phone: true, role: true,
                            dealerProfile: { select: { companyName: true, isVerified: true } },
                        },
                    },
                    auction: {
                        select: {
                            id: true,
                            status: true,
                            reservePrice: true,
                            deletedAt: true,
                        },
                    },
                },
            }),
            this.prisma.listing.count({ where }),
        ]);
        return { data, total };
    }


    /**
     * Staff-only, one-click recovery of a customer-requested DRAFT into a fresh
     * 24-hour auction. A repeat request cannot duplicate a run: the same
     * listing advisory lock guards both state validation and the DB transition.
     *
     * Previous seller reserve is preserved when available. A retail-only
     * draft's own listed price becomes its conservative initial reserve; staff
     * should act only after the seller has requested the relist.
     */
    async relistDraftAsAuction(id: string, adminId: string) {
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))::text`;

            const listing = await tx.listing.findUnique({
                where: { id },
                include: {
                    auction: true,
                    seller: { select: { id: true, deletedAt: true } },
                },
            });
            if (!listing || listing.deletedAt) {
                throw new NotFoundException('Listing not found');
            }
            if (listing.status !== 'DRAFT') {
                throw new BadRequestException('Only DRAFT listings can use one-click auction relisting.');
            }
            if (!listing.sellerId || !listing.seller || listing.seller.deletedAt) {
                throw new BadRequestException('A valid seller account is required before relisting.');
            }

            const missing = getListingSubmissionReadiness(listing).missingFields;
            if (missing.length) {
                throw new BadRequestException(
                    'Complete the seller draft before relisting. Missing: ' + missing.join(', ') + '.',
                );
            }
            // An AUCTION draft may be paired with a genuine active retail
            // source. Changing the type of a linked retail source itself would
            // corrupt that reciprocal relationship, so reject it instead.
            if (listing.type === 'CLASSIFIED' && listing.linkedListingId) {
                throw new BadRequestException(
                    'This retail draft is linked to another auction. Resolve that link before relisting.',
                );
            }

            const current = listing.auction;
            if (current && (
                current.deletedAt
                || !['SCHEDULED', 'ENDED', 'CANCELLED'].includes(current.status)
                || current.winnerId || current.wonAt
                || current.provisionalOfferBidId
                || current.stripePayoutTransferId || current.manualPayoutConfirmedAt
                || current.sellerBonusReleasedAt || current.sellerFundsConfirmedAt
                || current.buyerRefusedAt || current.handoverRejectedAt
                || current.buyerFeePaid || current.buyerFeeTransactionId
                || current.handoverSubmittedAt || current.handoverProofPath
                || current.handoverProofUrl || current.sellerBonusReleased
                || current.buyItNowPendingBuyerId
            )) {
                throw new BadRequestException(
                    'This auction has an unresolved or completed sale, provisional offer, or handover. Use the controlled sale workflow before relisting.',
                );
            }

            const [sale, acceptedOffer, unarchivedBids, otherListings] = await Promise.all([
                tx.sale.findFirst({ where: { listingId: id }, select: { id: true } }),
                tx.offer.findFirst({ where: { listingId: id, status: 'ACCEPTED' }, select: { id: true } }),
                tx.bid.count({
                    where: {
                        listingId: id,
                        deletedAt: null,
                        cancelledAt: null,
                        archivedAt: null,
                    },
                }),
                tx.listing.findMany({
                    where: {
                        sellerId: listing.sellerId,
                        id: { not: id },
                        deletedAt: null,
                        status: { in: ['ACTIVE', 'PENDING_REVIEW'] },
                    },
                    select: {
                        id: true, type: true, vrm: true, status: true,
                        linkedListingId: true,
                    },
                }),
            ]);
            if (sale || acceptedOffer) {
                throw new BadRequestException(
                    'This vehicle has sale or accepted-offer history that must be resolved before relisting.',
                );
            }
            if (current?.status === 'SCHEDULED' && unarchivedBids) {
                throw new BadRequestException(
                    'Existing scheduled auction contains active bids. Resolve it before relisting.',
                );
            }

            const normaliseVrm = (vrm?: string | null) =>
                (vrm ?? '').replace(/\s/g, '').toUpperCase();
            const vrm = normaliseVrm(listing.vrm);
            const matchingSiblings = otherListings.filter(other =>
                vrm && normaliseVrm(other.vrm) === vrm,
            );
            // An older no-sale auction may have been turned into a CLASSIFIED
            // draft while its retail sibling stayed live. The canonical seller
            // re-auction path heals precisely one unlinked retail counterpart.
            // Apply the same narrow recovery here without letting an arbitrary
            // retail draft silently create an additional unlinked live vehicle.
            const legacyRetailSource = listing.type === 'CLASSIFIED'
                && !listing.linkedListingId
                && current && ['ENDED', 'CANCELLED'].includes(current.status)
                && matchingSiblings.length === 1
                && matchingSiblings[0].type === 'CLASSIFIED'
                && matchingSiblings[0].status === 'ACTIVE'
                && !matchingSiblings[0].linkedListingId
                ? matchingSiblings[0] : null;
            const sibling = matchingSiblings.find(other =>
                other.id !== legacyRetailSource?.id
                && !(
                    listing.type === 'AUCTION'
                    && listing.linkedListingId === other.id
                    && other.linkedListingId === listing.id
                    && other.type === 'CLASSIFIED'
                    && other.status === 'ACTIVE'
                ),
            );
            if (sibling) {
                throw new BadRequestException(
                    'Another active or pending listing for this seller and registration exists. Resolve it or use the linked-auction journey.',
                );
            }
            if (listing.linkedListingId && !otherListings.some(other =>
                other.id === listing.linkedListingId
                && other.linkedListingId === listing.id
                && other.type === 'CLASSIFIED'
                && other.status === 'ACTIVE'
            )) {
                throw new BadRequestException(
                    'Linked retail listing is no longer active and correctly paired. Repair the link before relisting.',
                );
            }

            if (legacyRetailSource) {
                const claimed = await tx.listing.updateMany({
                    where: {
                        id: legacyRetailSource.id,
                        sellerId: listing.sellerId,
                        type: 'CLASSIFIED',
                        status: 'ACTIVE',
                        linkedListingId: null,
                        deletedAt: null,
                    },
                    data: { linkedListingId: id },
                });
                if (claimed.count !== 1) {
                    throw new BadRequestException(
                        'The matching retail listing changed. Refresh before relisting.',
                    );
                }
            }

            const marketValue = Number(listing.price);
            const previousReserve = Number(current?.reservePrice);
            if (!Number.isFinite(marketValue) || marketValue <= 0) {
                throw new BadRequestException('The draft needs a valid listed price before relisting.');
            }
            const reserveSource = current && Number.isFinite(previousReserve) && previousReserve > 0
                ? 'PREVIOUS_RESERVE' : 'DRAFT_LISTED_PRICE';
            const reservePrice = reserveSource === 'PREVIOUS_RESERVE'
                ? previousReserve : marketValue;
            const previousBin = current?.buyItNowPrice == null
                ? null : Number(current.buyItNowPrice);
            const buyItNowPrice = previousBin != null
                && Number.isFinite(previousBin)
                && previousBin >= reservePrice
                ? previousBin : null;
            const previousIncrement = Number(current?.minIncrement);
            const minIncrement = Number.isFinite(previousIncrement) && previousIncrement > 0
                ? previousIncrement : 100;
            const startTime = new Date();
            const endTime = new Date(startTime.getTime() + AUCTION_DURATION_MS);
            const archivedAt = startTime;

            // Old bid amounts remain available as history but cannot enter the
            // new run or affect its opening/minimum bids.
            await tx.bid.updateMany({
                where: { listingId: id, archivedAt: null },
                data: { archivedAt },
            });
            const auctionData = {
                startTime,
                endTime,
                reservePrice,
                startingBid: calculatePlatformOpeningBid(marketValue),
                minIncrement,
                buyItNowPrice,
                status: 'SCHEDULED' as const,
                winnerId: null,
                winningBidAmount: null,
                wonAt: null,
                provisionalOfferBidId: null,
                provisionalOfferedAt: null,
                buyerFeeReminder24SentAt: null,
                buyerFeeReminder6SentAt: null,
                buyerFeePaid: false,
                buyerFeeTransactionId: null,
                sellerFundsConfirmedAt: null,
                sellerFundsConfirmedById: null,
                sellerFundsConfirmationRequired: true,
                handoverProofUrl: null,
                handoverProofPath: null,
                handoverSubmittedAt: null,
                handoverRejectedAt: null,
                handoverRejectionReason: null,
                sellerBonusReleased: false,
                sellerBonusReleasedAt: null,
                sellerBonusPayoutNoticeSentAt: null,
                buyItNowPendingBuyerId: null,
                buyItNowPendingAt: null,
            };
            const auction = current
                ? await tx.auction.update({
                    where: { id: current.id },
                    data: auctionData,
                })
                : await tx.auction.create({
                    data: { listingId: id, ...auctionData },
                });

            await tx.listing.update({
                where: { id },
                data: {
                    ...buildListingActivationData('FREE'),
                    type: 'AUCTION',
                    badgeTier: 'FREE',
                    ...(legacyRetailSource
                        ? { linkedListingId: legacyRetailSource.id }
                        : {}),
                },
            });
            // The actor (not the seller) is deliberately recorded: this is a
            // privileged admin intervention rather than an ordinary seller action.
            await tx.analyticsEvent.create({
                data: {
                    type: 'admin_draft_auction_relist',
                    userId: adminId,
                    payload: {
                        listingId: id,
                        auctionId: auction.id,
                        previousListingType: listing.type,
                        reserveSource,
                        reservePrice,
                    },
                },
            });
            return {
                auctionId: auction.id,
                listingId: id,
                sellerId: listing.sellerId,
                title: listing.title,
                reservePrice,
                reserveSource,
            };
        }, { timeout: 15000 });

        // Non-critical delivery failures must not undo the committed auction.
        const notification = await this.notificationsService.create({
            userId: result.sellerId,
            type: 'SYSTEM',
            title: 'Your vehicle has been relisted in auction',
            message: 'CarMazium relisted "' + result.title
                + '" at your request. Your auction reserve is £'
                + result.reservePrice.toLocaleString('en-GB')
                + '. Review your live auction in your dashboard.',
            link: '/dashboard/seller/auctions',
            entityType: 'AUCTION',
            entityId: result.auctionId,
        }).catch(error => {
            this.logger.error('Could not notify seller about admin auction relisting', error);
            return null;
        });
        if (notification) {
            this.notificationsGateway.sendNotification(result.sellerId, notification);
        }
        return {
            listingId: result.listingId,
            auctionId: result.auctionId,
            reservePrice: result.reservePrice,
            reserveSource: result.reserveSource,
            status: 'SCHEDULED',
        };
    }

    async deleteListing(id: string) {
        const listing = await this.prisma.listing.findUnique({
            where: { id },
            include: {
                auction: {
                    select: {
                        id: true,
                        status: true,
                        deletedAt: true,
                    },
                },
            },
        });
        if (!listing) {
            throw new NotFoundException('Listing not found');
        }

        const deletedAt = new Date();
        return this.prisma.$transaction(async (tx) => {
            // Admin force-delete is allowed to stop an open auction, but the
            // Auction row must transition with the Listing row. Otherwise an
            // invisible ACTIVE/SCHEDULED auction can keep accepting lifecycle
            // work after its parent has disappeared.
            if (
                listing.auction
                && !listing.auction.deletedAt
                && ['SCHEDULED', 'ACTIVE'].includes(listing.auction.status)
            ) {
                await tx.auction.update({
                    where: { id: listing.auction.id },
                    data: {
                        status: 'CANCELLED',
                        deletedAt,
                        buyItNowPendingBuyerId: null,
                        buyItNowPendingAt: null,
                    },
                });
                await tx.bid.updateMany({
                    where: {
                        listingId: id,
                        deletedAt: null,
                        cancelledAt: null,
                        archivedAt: null,
                    },
                    data: { archivedAt: deletedAt },
                });
            }

            if (listing.linkedListingId) {
                await tx.listing.updateMany({
                    where: {
                        id: listing.linkedListingId,
                        linkedListingId: id,
                    },
                    data: { linkedListingId: null },
                });
            }

            return tx.listing.update({
                where: { id },
                data: {
                    deletedAt,
                    linkedListingId: null,
                },
            });
        });
    }

    // ── Listing Review ───────────────────────────────────────────────────────

    /**
     * Only listings awaiting an admin decision belong in the review queue.
     * Rejected vehicles remain in All Listings and the seller's dashboard, and
     * return here only when the seller explicitly resubmits them for review.
     */
    async getPendingListingReviews() {
        return this.prisma.listing.findMany({
            where: { status: 'PENDING_REVIEW', deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: {
                seller: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
                // AUCTION-type listings carry their schedule (reserve/starting bid/
                // BIN/start time) on this related row, not on Listing itself — the
                // pending-review UI needs it to actually review an auction.
                auction: true,
                // Drives the "HPI outstanding" indicator. Informational only —
                // a pending report no longer blocks approval, it just tells the
                // reviewer this listing will go live owing its seller a report.
                // pdfUploadedAt distinguishes a report completed by uploading the
                // supplied PDF from one keyed into the form — the two are edited
                // through different modals, so the UI has to know which it is.
                hpiReport: { select: { status: true, isClear: true, preparedAt: true, pdfUploadedAt: true } },
            },
        });
    }

    /** Full single-listing detail (any status), for the admin edit modal. */
    async getListingById(id: string) {
        const listing = await this.prisma.listing.findUnique({
            where: { id },
            include: {
                seller: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
                auction: true,
            },
        });
        if (!listing) {
            throw new NotFoundException('Listing not found');
        }
        return listing;
    }

    /**
     * Lets an admin correct a listing's own fields (typos, wrong spec, etc.) —
     * whether it's still awaiting review or already live (ACTIVE), including
     * listings tied to a live auction. Blocked only for SOLD, since editing
     * vehicle details on a completed sale would corrupt the transaction record.
     */
    async updateListing(id: string, dto: AdminUpdateListingDto) {
        const listing = await this.prisma.listing.findUnique({ where: { id }, include: { auction: true } });
        if (!listing) {
            throw new NotFoundException('Listing not found');
        }
        if (listing.status === 'SOLD') {
            throw new BadRequestException('Cannot edit a listing that has already been sold');
        }

        const data: Record<string, unknown> = {};
        // Core
        if (dto.title !== undefined) data.title = dto.title;
        if (dto.price !== undefined) data.price = dto.price;
        if (dto.priceMin !== undefined) data.priceMin = dto.priceMin;
        if (dto.priceMax !== undefined) data.priceMax = dto.priceMax;
        if (dto.description !== undefined) data.description = dto.description;
        // Vehicle identity
        if (dto.make !== undefined) data.make = dto.make;
        if (dto.model !== undefined) data.model = dto.model;
        if (dto.variant !== undefined) data.variant = dto.variant;
        if (dto.year !== undefined) data.year = dto.year;
        if (dto.mileage !== undefined) data.mileage = dto.mileage;
        if (dto.vrm !== undefined) data.vrm = dto.vrm;
        if (dto.vin !== undefined) data.vin = dto.vin;
        // Mechanical / body
        if (dto.fuelType !== undefined) data.fuelType = dto.fuelType;
        if (dto.transmission !== undefined) data.transmission = dto.transmission;
        if (dto.bodyType !== undefined) data.bodyType = dto.bodyType;
        if (dto.condition !== undefined) data.condition = dto.condition;
        if (dto.color !== undefined) data.color = dto.color;
        if (dto.doors !== undefined) data.doors = dto.doors;
        if (dto.seats !== undefined) data.seats = dto.seats;
        if (dto.driveType !== undefined) data.driveType = dto.driveType;
        if (dto.engineSize !== undefined) data.engineSize = dto.engineSize;
        if (dto.bhp !== undefined) data.bhp = dto.bhp;
        if (dto.torqueNm !== undefined) data.torqueNm = dto.torqueNm;
        if (dto.topSpeedMph !== undefined) data.topSpeedMph = dto.topSpeedMph;
        if (dto.zeroTo60Mph !== undefined) data.zeroTo60Mph = dto.zeroTo60Mph;
        if (dto.combinedMpg !== undefined) data.combinedMpg = dto.combinedMpg;
        if (dto.extraUrbanMpg !== undefined) data.extraUrbanMpg = dto.extraUrbanMpg;
        if (dto.ulezCompliant !== undefined) data.ulezCompliant = dto.ulezCompliant;
        if (dto.euroStandard !== undefined) data.euroStandard = dto.euroStandard;
        if (dto.co2Emissions !== undefined) data.co2Emissions = dto.co2Emissions;
        // History / ownership
        if (dto.numberOfKeys !== undefined) data.numberOfKeys = dto.numberOfKeys;
        if (dto.serviceHistory !== undefined) data.serviceHistory = dto.serviceHistory;
        if (dto.owners !== undefined) data.owners = dto.owners;
        if (dto.stolenRecovered !== undefined) data.stolenRecovered = dto.stolenRecovered;
        if (dto.hasOutstandingFinance !== undefined) data.hasOutstandingFinance = dto.hasOutstandingFinance;
        if (dto.isLegalRegisteredKeeper !== undefined) data.isLegalRegisteredKeeper = dto.isLegalRegisteredKeeper;
        if (dto.writeOffCategory !== undefined) {
            // Same auction-only rule as the seller-facing update — a Cat A/B
            // write-off can't be corrected onto a CLASSIFIED listing.
            if ((dto.writeOffCategory === 'CAT_A' || dto.writeOffCategory === 'CAT_B') && listing.type === 'CLASSIFIED') {
                throw new BadRequestException('Cat A and Cat B write-offs cannot be listed for retail sale. Switch to an Auction listing to proceed.');
            }
            data.writeOffCategory = dto.writeOffCategory;
        }
        if (dto.isDepartedSale !== undefined) data.isDepartedSale = dto.isDepartedSale;
        if (dto.departedRelationship !== undefined) data.departedRelationship = dto.departedRelationship;
        if (dto.notOwnerRelationship !== undefined) data.notOwnerRelationship = dto.notOwnerRelationship;
        // DVLA-derived
        if (dto.motStatus !== undefined) data.motStatus = dto.motStatus;
        if (dto.taxStatus !== undefined) data.taxStatus = dto.taxStatus;
        if (dto.motExpiryDate !== undefined) data.motExpiryDate = dto.motExpiryDate;
        if (dto.taxDueDate !== undefined) data.taxDueDate = dto.taxDueDate;
        if (dto.markedForExport !== undefined) data.markedForExport = dto.markedForExport;
        if (dto.monthOfFirstRegistration !== undefined) data.monthOfFirstRegistration = dto.monthOfFirstRegistration;
        if (dto.wheelplan !== undefined) data.wheelplan = dto.wheelplan;
        if (dto.typeApproval !== undefined) data.typeApproval = dto.typeApproval;
        // Listing meta
        if (dto.location !== undefined) data.location = dto.location;
        if (dto.vehicleType !== undefined) data.vehicleType = dto.vehicleType;
        if (dto.isImported !== undefined) data.isImported = dto.isImported;
        if (dto.bannerLabel !== undefined) data.bannerLabel = dto.bannerLabel;
        if (dto.features !== undefined) data.features = dto.features;
        // Delivery
        if (dto.deliveryAvailable !== undefined) data.deliveryAvailable = dto.deliveryAvailable;
        if (dto.deliveryPricePerMile !== undefined) data.deliveryPricePerMile = dto.deliveryPricePerMile;
        if (dto.deliveryMaxMiles !== undefined) data.deliveryMaxMiles = dto.deliveryMaxMiles;
        // Media
        if (dto.images !== undefined) data.images = dto.images;
        if (dto.videoUrls !== undefined) data.videoUrls = dto.videoUrls;
        // Type / badge tier
        if (dto.listingType !== undefined) data.type = dto.listingType;
        if (dto.badgeTier !== undefined) data.badgeTier = dto.badgeTier;

        const hasAuctionFields = [dto.reservePrice, dto.startingBid, dto.minIncrement, dto.buyItNowPrice, dto.startTime]
            .some(v => v !== undefined);

        // Once bidding is live, only the reserve can be corrected. Rewriting
        // start time, opening bid, increment or BIN after the auction starts
        // would change the rules underneath existing bidders.
        if (hasAuctionFields && listing.auction?.status === 'ACTIVE') {
            const unsafeLiveFields = [dto.startingBid, dto.minIncrement, dto.buyItNowPrice, dto.startTime]
                .some(v => v !== undefined);
            if (unsafeLiveFields) {
                throw new BadRequestException(
                    'For a live auction, only the reserve price can be corrected. Opening bid, increment, Buy It Now and timing are locked.',
                );
            }
        }

        // Fail obvious SCHEDULED reserve/BIN conflicts before writing any
        // ordinary Listing fields from the same admin request. The locked
        // auction-domain method below repeats this check against canonical
        // state after acquiring the advisory lock, which remains authoritative
        // for concurrent edits.
        if (hasAuctionFields && listing.auction?.status === 'SCHEDULED') {
            const proposedReserve = dto.reservePrice !== undefined
                ? dto.reservePrice
                : Number(listing.auction.reservePrice);
            const proposedBin = dto.buyItNowPrice !== undefined
                ? dto.buyItNowPrice
                : listing.auction.buyItNowPrice == null
                    ? null
                    : Number(listing.auction.buyItNowPrice);

            if (buyItNowViolatesReserve(proposedReserve, proposedBin)) {
                throw new BadRequestException(BUY_IT_NOW_BELOW_RESERVE_MESSAGE);
            }
        }

        // A reserve-only live-auction correction produces no Listing-row
        // mutations. Skip the no-op Prisma update instead of sending data: {},
        // which can fail at runtime before the dedicated auction correction
        // path gets a chance to run.
        const updated = Object.keys(data).length > 0
            ? await this.prisma.listing.update({ where: { id }, data })
            : listing;

        // Auction schedule lives on the related Auction row. Before the auction
        // starts, admins retain the full schedule editor. Once ACTIVE, route the
        // reserve through the dedicated correction path so bid-integrity checks,
        // seller notification and the live socket refresh all happen.
        if (hasAuctionFields && listing.auction && listing.auction.status === 'SCHEDULED') {
            await this.auctionsService.adminUpdateScheduledAuction(
                listing.auction.id,
                {
                    ...(dto.reservePrice !== undefined && { reservePrice: dto.reservePrice }),
                    ...(dto.startingBid !== undefined && { startingBid: dto.startingBid }),
                    ...(dto.minIncrement !== undefined && { minIncrement: dto.minIncrement }),
                    ...(dto.buyItNowPrice !== undefined && { buyItNowPrice: dto.buyItNowPrice }),
                    ...(dto.startTime !== undefined && { startTime: dto.startTime }),
                },
            );
        } else if (
            dto.reservePrice !== undefined
            && listing.auction
            && listing.auction.status === 'ACTIVE'
        ) {
            await this.auctionsService.adminCorrectReservePrice(
                listing.auction.id,
                dto.reservePrice,
                'Corrected by CarMazium admin from the listing editor.',
            );
        }

        return updated;
    }

    /**
     * A pending HPI report deliberately does NOT block approval.
     *
     * It used to: a listing whose seller had paid for a report was held back
     * until staff produced it, which stalled sellers behind our own turnaround.
     * Now the listing goes live showing "report being prepared" and the report
     * is attached later from the admin HPI queue. Nothing here needs to know
     * about it — the report has its own lifecycle.
     */
    async approveListing(id: string) {
        const listing = await this.prisma.listing.findUnique({
            where: { id },
            include: {
                auction: true,
                hpiReport: { select: { id: true } },
                linkedListing: {
                    select: {
                        id: true,
                        sellerId: true,
                        type: true,
                        status: true,
                        linkedListingId: true,
                        deletedAt: true,
                        hpiReport: { select: { id: true } },
                    },
                },
            },
        });
        if (!listing || listing.deletedAt) {
            throw new NotFoundException('Listing not found');
        }
        if (listing.status !== 'PENDING_REVIEW') {
            throw new BadRequestException('Only listings awaiting review can be approved');
        }

        const readiness = getListingSubmissionReadiness(listing, {
            hasRequiredHpi: Boolean(
                listing.hpiReport
                || (
                    listing.type === 'AUCTION'
                    && listing.linkedListingId
                    && listing.linkedListing?.hpiReport
                )
            ),
        });
        if (readiness.missingFields.length > 0) {
            throw new BadRequestException(
                `Listing is incomplete and cannot be approved. Missing: ${readiness.missingFields.join(', ')}.`,
            );
        }
        if (readiness.missingHpi) {
            throw new BadRequestException(
                'This listing requires a CarMazium vehicle history (HPI) report request before approval.',
            );
        }

        // AUCTION listings are not valid without their Auction row. Keeping this
        // check at approval is defense-in-depth for legacy/orphan records and any
        // future client that fails halfway through auction setup.
        if (listing.type === 'AUCTION') {
            if (!listing.auction || listing.auction.deletedAt) {
                throw new BadRequestException(
                    'Auction setup is incomplete. This listing has no active auction schedule and cannot be approved.',
                );
            }
            if (listing.auction.status !== 'SCHEDULED') {
                throw new BadRequestException(
                    `Auction must be scheduled before approval. Current auction status: ${listing.auction.status}.`,
                );
            }

            // Linked auctions must still have a valid, reciprocal ACTIVE retail
            // source when the admin approves them. The source can change while
            // this clone waits in review (sold/withdrawn/deleted/unlinked), and
            // approving after that would put the same vehicle into an invalid
            // auction state.
            if (listing.linkedListingId) {
                const source = listing.linkedListing;
                if (
                    !source
                    || source.deletedAt
                    || source.type !== 'CLASSIFIED'
                    || source.status !== 'ACTIVE'
                    || source.sellerId !== listing.sellerId
                    || source.linkedListingId !== listing.id
                ) {
                    throw new BadRequestException(
                        'The linked retail listing is no longer active and correctly paired with this auction. Resolve the retail listing before approval.',
                    );
                }
            }

        }

        // Revenue guard: a customer retail listing must have a completed listing-fee
        // transaction before admin approval can make it live. Admin-granted free
        // listings are represented by a completed £0 LISTING_FEE transaction, so
        // legitimate waivers continue to work. Admin-owned listings are exempt.
        if (listing.type === 'CLASSIFIED' && listing.sellerId) {
            const [sellerAccount, completedFee] = await Promise.all([
                this.prisma.user.findUnique({
                    where: { id: listing.sellerId },
                    select: { role: true },
                }),
                this.prisma.transaction.findFirst({
                    where: {
                        listingId: id,
                        type: 'LISTING_FEE',
                        status: 'COMPLETED',
                    },
                    select: { id: true },
                }),
            ]);

            if (sellerAccount?.role !== 'ADMIN' && !completedFee) {
                throw new BadRequestException(
                    'Retail listing fee has not been paid. The listing cannot be approved yet.',
                );
            }
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            // Auction approval and listing activation must commit as one lifecycle
            // transition. Claim the Auction row first to use the same lock order
            // as seller cancellation/deletion paths and avoid approval races.
            if (listing.type === 'AUCTION' && listing.auction) {
                const now = new Date();
                const resetWindow = listing.auction.startTime <= now;
                const auctionClaim = await tx.auction.updateMany({
                    where: {
                        id: listing.auction.id,
                        status: 'SCHEDULED',
                        deletedAt: null,
                    },
                    data: {
                        // Writing the same status acts as a compare-and-set claim.
                        status: 'SCHEDULED',
                        ...(resetWindow
                            ? {
                                startTime: now,
                                endTime: new Date(now.getTime() + AUCTION_DURATION_MS),
                            }
                            : {}),
                    },
                });
                if (auctionClaim.count !== 1) {
                    throw new BadRequestException(
                        'The auction changed while this listing was being approved. Refresh the review and try again.',
                    );
                }
            }

            const listingClaim = await tx.listing.updateMany({
                where: {
                    id,
                    status: 'PENDING_REVIEW',
                    deletedAt: null,
                },
                data: { status: 'PENDING_REVIEW' },
            });
            if (listingClaim.count !== 1) {
                throw new BadRequestException(
                    'The listing changed while it was being approved. Refresh the review and try again.',
                );
            }

            return tx.listing.update({
                where: { id },
                data: buildListingActivationData(listing.badgeTier),
            });
        });

        // Operational funnel telemetry: admin approval is the exact moment a
        // listing becomes live. Keep this server-side so it is not lost when a
        // seller closes the browser and do not include personal identifiers.
        this.prisma.analyticsEvent.create({
            data: {
                type: 'listing_approved',
                userId: listing.sellerId ?? null,
                payload: {
                    listing_id: listing.id,
                    listing_type: listing.type === 'AUCTION' ? 'auction' : 'retail',
                    badge_tier: listing.badgeTier,
                },
            },
        }).catch(() => null);

        if (listing.sellerId) {
            await this.sellersService.incrementListings(listing.sellerId);

            const seller = await this.prisma.user.findUnique({
                where: { id: listing.sellerId },
                select: { email: true, firstName: true },
            });
            if (seller?.email) {
                await this.emailService
                    .sendListingApprovedAlert(seller.email, seller.firstName || 'there', listing.title, listing.slug)
                    .catch(console.error);
            }

            const notification = await this.notificationsService.create({
                userId: listing.sellerId,
                type: 'LISTING_APPROVED',
                title: 'Your Listing is Live!',
                message: `"${listing.title}" has been approved and is now visible to buyers.`,
                link: `/buy-cars/${listing.slug}`,
                entityType: 'Listing',
                entityId: listing.id,
                actionType: 'APPROVED',
            }).catch(() => null);
            if (notification) {
                this.notificationsGateway.sendNotification(listing.sellerId, notification);
            }
        }

        return updated;
    }

    async rejectListing(id: string, dto: RejectListingDto) {
        const listing = await this.prisma.listing.findUnique({ where: { id }, include: { auction: true } });
        if (!listing || listing.deletedAt) {
            throw new NotFoundException('Listing not found');
        }
        if (listing.status !== 'PENDING_REVIEW') {
            throw new BadRequestException('Only listings awaiting review can be rejected');
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            const next = await tx.listing.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    rejectionReason: dto.reason,
                    reviewedAt: new Date(),
                },
            });

            // Rejection and scheduled-auction cancellation are one state change.
            // A failure in either write rolls the whole review decision back.
            if (listing.auction && listing.auction.status === 'SCHEDULED' && !listing.auction.deletedAt) {
                await tx.auction.update({
                    where: { id: listing.auction.id },
                    data: {
                        status: 'CANCELLED',
                        buyItNowPendingBuyerId: null,
                        buyItNowPendingAt: null,
                    },
                });
            }

            return next;
        });

        // Record the review outcome without copying the free-text rejection
        // reason into analytics. The reason remains on the listing itself.
        this.prisma.analyticsEvent.create({
            data: {
                type: 'listing_rejected',
                userId: listing.sellerId ?? null,
                payload: {
                    listing_id: listing.id,
                    listing_type: listing.type === 'AUCTION' ? 'auction' : 'retail',
                    badge_tier: listing.badgeTier,
                },
            },
        }).catch(() => null);

        if (listing.sellerId) {
            const seller = await this.prisma.user.findUnique({
                where: { id: listing.sellerId },
                select: { email: true, firstName: true },
            });
            if (seller?.email) {
                await this.emailService
                    .sendListingRejectedAlert(seller.email, seller.firstName || 'there', listing.title, dto.reason)
                    .catch(console.error);
            }

            const notification = await this.notificationsService.create({
                userId: listing.sellerId,
                type: 'LISTING_REJECTED',
                title: 'Listing Needs Attention',
                message: `"${listing.title}" was not approved: ${dto.reason}`,
                link: '/dashboard/seller/listings',
                entityType: 'Listing',
                entityId: listing.id,
                actionType: 'REJECTED',
            }).catch(() => null);
            if (notification) {
                this.notificationsGateway.sendNotification(listing.sellerId, notification);
            }
        }

        return updated;
    }

    /**
     * ACTIVE auctions always sort ahead of everything else (so live auctions
     * needing attention aren't buried under older-but-more-recently-created
     * scheduled/ended ones), then newest-first within each bucket.
     */
    /**
     * Admin-only READ-ONLY historical reconciliation. The pre-6-August winner
     * records MUST NOT gain wonAt: that would activate today's 72h unpaid-win
     * expiry against genuine historic sales. Flag anomalies for evidence-led
     * human reconciliation; never reinstate a pending/failed charge, refund or
     * manual seller payout automatically.
     */
    async getHistoricalAuctionReconciliation() {
        const rows = await this.prisma.auction.findMany({
            where: {
                deletedAt: null,
                OR: [
                    { winnerId: { not: null }, wonAt: null },
                    { sellerBonusReleased: true, buyerFeePaid: false },
                    { handoverSubmittedAt: { not: null }, buyerFeePaid: false },
                ],
            },
            select: {
                id: true, listingId: true, createdAt: true, status: true,
                winnerId: true, wonAt: true, winningBidAmount: true,
                buyerFeePaid: true, buyerFeeTransactionId: true,
                handoverSubmittedAt: true, sellerBonusReleased: true,
                manualPayoutConfirmedAt: true, stripePayoutTransferId: true,
                listing: {
                    select: {
                        title: true,
                        sale: { select: { buyerId: true, soldPrice: true } },
                        transactions: {
                            where: { type: 'COMMISSION', deletedAt: null },
                            select: {
                                id: true, userId: true, type: true, status: true,
                                amount: true, description: true, stripePaymentId: true,
                            },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        const classified = rows.map(row => ({
            row, assessment: classifyHistoricalAuction({
                ...row, status: row.status,
                listing: {
                    title: row.listing.title,
                    sale: row.listing.sale,
                    transactions: row.listing.transactions,
                },
            }),
        }));
        const cases = classified.filter(item => item.assessment.requiresManualReview)
            .map(({ row, assessment }) => ({
                auctionId: row.id,
                listingId: row.listingId,
                vehicleTitle: row.listing.title,
                auctionDate: row.createdAt,
                status: row.status,
                hasWinner: Boolean(row.winnerId),
                hasWonAt: Boolean(row.wonAt),
                legacyWinProtected: assessment.legacyWinProtected,
                saleMatchesWinningRecord: assessment.saleMatchesWinningRecord,
                buyerFeePaid: row.buyerFeePaid,
                hasBuyerFeeTransactionLink: Boolean(row.buyerFeeTransactionId),
                handoverSubmitted: Boolean(row.handoverSubmittedAt),
                sellerBonusApproved: row.sellerBonusReleased,
                manualSellerPayoutRecorded: Boolean(row.manualPayoutConfirmedAt),
                stripeSellerTransferRecorded: Boolean(
                    row.stripePayoutTransferId && row.stripePayoutTransferId.startsWith('tr_'),
                ),
                reasons: assessment.reviewReasons,
                transactions: assessment.transactionEvidence,
            }));
        return {
            generatedAt: new Date().toISOString(),
            readOnly: true,
            historicalWonAtPolicy: 'Preserve matched pre-2026-08-06 winners without wonAt; never trigger retroactive 72-hour expiry.',
            protectedLegacyWinCount: classified.filter(x => x.assessment.legacyWinProtected).length,
            legacyWinMismatchCount: classified.filter(x => x.assessment.legacyWinNoTimestamp &&
                !x.assessment.legacyWinProtected).length,
            postFeatureMissingWinCount: classified.filter(x =>
                x.row.winnerId && !x.row.wonAt && !x.assessment.legacyWinNoTimestamp).length,
            manualReviewCount: cases.length,
            cases,
        };
    }

    async getAllAuctions(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const include = {
            listing: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    images: true,
                    make: true,
                    model: true,
                    year: true,
                    status: true,
                    seller: {
                        select: {
                            id: true, email: true, firstName: true, lastName: true, phone: true,
                            dealerProfile: { select: { companyName: true, isVerified: true } },
                        },
                    },
                    bids: {
                        where: { deletedAt: null, cancelledAt: null, archivedAt: null },
                        orderBy: { amount: 'desc' as const },
                        take: 1,
                        select: { amount: true },
                    },
                    _count: {
                        select: {
                            bids: { where: { deletedAt: null, cancelledAt: null, archivedAt: null } },
                        },
                    },
                },
            },
            winner: {
                select: {
                    id: true, firstName: true, lastName: true, email: true, phone: true,
                    dealerProfile: { select: { companyName: true, isVerified: true } },
                },
            },
        };

        const [activeCount, total] = await Promise.all([
            this.prisma.auction.count({ where: { status: 'ACTIVE' } }),
            this.prisma.auction.count(),
        ]);

        const data: any[] = [];
        if (skip < activeCount) {
            data.push(...await this.prisma.auction.findMany({
                where: { status: 'ACTIVE' },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include,
            }));
        }
        if (data.length < limit) {
            data.push(...await this.prisma.auction.findMany({
                where: { status: { not: 'ACTIVE' } },
                skip: Math.max(0, skip - activeCount),
                take: limit - data.length,
                orderBy: { createdAt: 'desc' },
                include,
            }));
        }

        return { data, total };
    }

    /**
     * Correct a seller's mistaken reserve while preserving all existing bids.
     * The auction service owns the safety checks and real-time broadcast.
     */
    async correctAuctionPrice(auctionId: string, reservePrice: number, reason?: string) {
        return this.auctionsService.adminCorrectReservePrice(auctionId, reservePrice, reason);
    }

    /** Lightweight list of every dealer, for the "assign winner" dropdown. */
    async getAllDealersForAssignment() {
        return this.prisma.user.findMany({
            where: {
                role: 'DEALER',
                deletedAt: null,
                dealerProfile: {
                    is: {
                        isVerified: true,
                        deletedAt: null,
                    },
                },
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                dealerProfile: { select: { companyName: true, isVerified: true } },
            },
            orderBy: { firstName: 'asc' },
        });
    }

    /**
     * Admin override: force-ends a live auction, assigning a chosen dealer as
     * winner regardless of whether they ever bid. See AuctionsService.adminAssignWinner
     * for the money-flow rules (BIN/reserve price, normal £125 buyer fee still applies).
     */
    async assignAuctionWinner(auctionId: string, dealerId: string) {
        await this.auctionsService.adminAssignWinner(auctionId, dealerId);
    }

    async getPendingHandovers() {
        const rows = await this.prisma.auction.findMany({
            where: {
                deletedAt: null,
                status: 'ENDED',
                sellerBonusReleased: false,
                OR: [
                    { handoverProofPath: { not: null } },
                    { handoverProofUrl: { not: null } },
                ],
            },
            orderBy: { handoverSubmittedAt: 'asc' },
            include: {
                listing: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        images: true,
                        make: true,
                        model: true,
                        year: true,
                        seller: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                stripeConnectOnboardingComplete: true,
                                bankAccountName: true,
                                bankSortCode: true,
                                bankAccountNumber: true,
                                payoutPreference: true,
                            },
                        },
                    },
                },
                winner: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
        // Private proof keys become short-lived signed URLs for review; the
        // key itself never leaves the server.
        return this.handoverDocuments.hydrateMany(rows as any[]);
    }

    /**
     * Persist (not just push) a "manual payout needed" alert to every admin —
     * a live-only gateway push is lost forever if no admin happens to be
     * connected at that exact second, with zero trace anywhere afterward.
     */
    private async notifyAdminsPayoutNeedsAction(auctionId: string, title: string, message: string) {
        const admins = await this.prisma.user.findMany({
            where: { role: 'ADMIN', deletedAt: null },
            select: { id: true },
        });
        await Promise.all(
            admins.map((admin) =>
                this.notificationsService.create({
                    userId: admin.id,
                    type: 'SYSTEM',
                    title,
                    message,
                    entityType: 'AUCTION',
                    entityId: auctionId,
                    link: '/dashboard/admin/handovers',
                }).catch(() => {}),
            ),
        );
    }

    private sellerPayoutClaimToken(auctionId: string): string {
        return `claim:seller-bonus:${auctionId}`;
    }

    private sellerPayoutIdempotencyKey(auctionId: string): string {
        return `auction-seller-bonus-${auctionId}`;
    }

    /**
     * Claim and settle the £100 seller bonus through Stripe.
     *
     * The claim lives in stripePayoutTransferId until the real transfer id is
     * persisted. A retry reuses the same Stripe idempotency key, so even if
     * Stripe accepted the transfer but the DB finalization failed, retrying
     * cannot create a second £100 transfer.
     */
    private async settleSellerBonusViaStripe(
        auctionId: string,
        stripeConnectAccountId: string,
    ): Promise<string> {
        const claimToken = this.sellerPayoutClaimToken(auctionId);

        // Never let a stale sellerBonusReleased flag become authority for money
        // movement. Re-check the full ended-auction / winner / £125 fee /
        // proof / refusal / cancellation invariant immediately before claiming
        // the Stripe payout.
        await this.auctionsService.assertHandoverBusinessRules(auctionId, {
            requireProof: true,
            requireApproved: true,
        });

        const claimed = await this.prisma.auction.updateMany({
            where: {
                id: auctionId,
                deletedAt: null,
                status: 'ENDED',
                winnerId: { not: null },
                buyerFeePaid: true,
                buyerFeeTransactionId: { not: null },
                buyerRefusedAt: null,
                handoverSubmittedAt: { not: null },
                sellerBonusReleased: true,
                sellerBonusReleasedAt: { not: null },
                manualPayoutConfirmedAt: null,
                AND: [
                    {
                        OR: [
                            { handoverProofPath: { not: null } },
                            { handoverProofUrl: { not: null } },
                        ],
                    },
                    {
                        OR: [
                            { stripePayoutTransferId: null },
                            { stripePayoutTransferId: claimToken },
                        ],
                    },
                ],
            },
            data: { stripePayoutTransferId: claimToken },
        });

        if (claimed.count !== 1) {
            const current = await this.prisma.auction.findUnique({
                where: { id: auctionId },
                select: {
                    stripePayoutTransferId: true,
                    manualPayoutConfirmedAt: true,
                },
            });
            if (current?.manualPayoutConfirmedAt) {
                throw new ConflictException('Seller bonus has already been paid manually.');
            }
            if (
                current?.stripePayoutTransferId
                && current.stripePayoutTransferId !== claimToken
            ) {
                return current.stripePayoutTransferId;
            }
            throw new ConflictException('Seller bonus payout is already being settled.');
        }

        let transferId: string;
        try {
            transferId = await this.paymentsService.issueSellerPayout(
                stripeConnectAccountId,
                10000,
                this.sellerPayoutIdempotencyKey(auctionId),
            );
        } catch (error) {
            // Stripe rejected the transfer, so release the claim for a clean
            // retry. If Stripe succeeded and our later DB finalization fails,
            // this catch is not entered and the claim deliberately remains.
            await this.prisma.auction.updateMany({
                where: {
                    id: auctionId,
                    stripePayoutTransferId: claimToken,
                    manualPayoutConfirmedAt: null,
                },
                data: { stripePayoutTransferId: null },
            });
            throw error;
        }

        const finalized = await this.prisma.auction.updateMany({
            where: {
                id: auctionId,
                sellerBonusReleased: true,
                stripePayoutTransferId: claimToken,
                manualPayoutConfirmedAt: null,
            },
            data: {
                stripePayoutTransferId: transferId,
                stripePayoutError: null,
            },
        });

        if (finalized.count !== 1) {
            const current = await this.prisma.auction.findUnique({
                where: { id: auctionId },
                select: {
                    stripePayoutTransferId: true,
                    manualPayoutConfirmedAt: true,
                },
            });
            if (current?.stripePayoutTransferId === transferId) {
                return transferId;
            }
            throw new ConflictException(
                'Stripe accepted the seller payout but its local finalization needs retry.',
            );
        }

        return transferId;
    }

    async approveHandover(auctionId: string) {
        await this.auctionsService.assertHandoverBusinessRules(auctionId, {
            requireProof: true,
            requireUnapproved: true,
        });

        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            include: { listing: { select: { sellerId: true, title: true } } },
        });
        if (!auction) throw new NotFoundException('Auction not found');

        // Atomic approval claim. The eligibility predicate is repeated in the
        // write so a refusal/cancellation/fee/proof change between validation
        // and this update cannot flip the auction into a payout-ready state.
        const releasedAt = new Date();
        const approved = await this.prisma.auction.updateMany({
            where: {
                id: auctionId,
                deletedAt: null,
                status: 'ENDED',
                winnerId: auction.winnerId,
                buyerFeePaid: true,
                buyerFeeTransactionId: auction.buyerFeeTransactionId,
                buyerRefusedAt: null,
                // Match the exact evidence this admin reviewed. A rejected
                // proof followed by a replacement cannot be approved using a
                // stale review tab from before the replacement.
                handoverSubmittedAt: auction.handoverSubmittedAt,
                handoverProofPath: auction.handoverProofPath,
                handoverProofUrl: auction.handoverProofUrl,
                sellerBonusReleased: false,
                sellerBonusReleasedAt: null,
                stripePayoutTransferId: null,
                manualPayoutConfirmedAt: null,
                OR: [
                    { handoverProofPath: { not: null } },
                    { handoverProofUrl: { not: null } },
                ],
            },
            data: {
                sellerBonusReleased: true,
                sellerBonusReleasedAt: releasedAt,
            },
        });

        if (approved.count !== 1) {
            const current = await this.prisma.auction.findUnique({ where: { id: auctionId } });
            if (current?.sellerBonusReleased) {
                // Another admin won the approval claim. No second payout path.
                return current;
            }
            throw new ConflictException(
                'Handover eligibility changed while it was being approved. Refresh and review the auction again.',
            );
        }

        const sellerId = auction.listing?.sellerId;
        if (sellerId) {
            const seller = await this.prisma.user.findUnique({
                where: { id: sellerId },
                select: {
                    email: true,
                    firstName: true,
                    stripeConnectAccountId: true,
                    stripeConnectOnboardingComplete: true,
                },
            });

            let payoutSucceeded = false;
            let stripeTransferId: string | null = null;
            let payoutReason: 'not_connected' | 'transfer_failed' | 'test_mode' | null = null;
            const stripeInTestMode = this.paymentsService.isStripeInTestMode();

            if (stripeInTestMode) {
                payoutReason = 'test_mode';
                await this.prisma.auction.update({
                    where: { id: auctionId },
                    data: { stripePayoutError: 'Skipped: Stripe is in test mode, live-mode Connect accounts cannot receive a transfer.' },
                });
                await this.notifyAdminsPayoutNeedsAction(
                    auctionId,
                    'Manual payout needed (sandbox mode)',
                    `Auto-transfer of £100 to seller for "${auction.listing.title}" was skipped because Stripe is currently in test mode. Please pay manually when live mode is restored.`,
                );
            } else if (seller?.stripeConnectAccountId && seller?.stripeConnectOnboardingComplete) {
                try {
                    stripeTransferId = await this.settleSellerBonusViaStripe(
                        auctionId,
                        seller.stripeConnectAccountId,
                    );
                    payoutSucceeded = true;
                } catch (err: any) {
                    const errMsg = err?.message || 'Unknown Stripe error';
                    console.error(`[Admin] Stripe payout settlement failed for auction ${auctionId}:`, errMsg);
                    payoutReason = 'transfer_failed';
                    await this.prisma.auction.update({
                        where: { id: auctionId },
                        data: { stripePayoutError: errMsg },
                    });
                    await this.notifyAdminsPayoutNeedsAction(
                        auctionId,
                        'Payout needs retry — manual action required',
                        `The £100 seller payout for "${auction.listing.title}" could not be finalized: ${errMsg}. Use Retry via Stripe first; retries use the same Stripe idempotency key. Do not pay manually until the Stripe transfer state is verified.`,
                    );
                }
            } else {
                payoutReason = 'not_connected';
                await this.prisma.auction.update({
                    where: { id: auctionId },
                    data: { stripePayoutError: 'Seller has not connected a Stripe payout method.' },
                });
                await this.notifyAdminsPayoutNeedsAction(
                    auctionId,
                    'Manual payout needed — seller not connected',
                    `Seller for "${auction.listing.title}" has no Stripe payout method connected. £100 still needs to be paid manually.`,
                );
            }

            this.notificationsGateway.sendNotification(sellerId, {
                type: 'HANDOVER_APPROVED',
                title: 'Handover verified',
                message: payoutSucceeded
                    ? `Your handover proof for "${auction.listing.title}" has been approved. Your £100 transfer is recorded with Stripe; bank settlement may take longer.`
                    : payoutReason === 'not_connected'
                        ? `Your handover proof for "${auction.listing.title}" has been approved. Connect your bank account in Settings to receive your £100 bonus.`
                        : `Your handover proof for "${auction.listing.title}" has been approved. Your £100 bonus is pending payout review; our team will resolve it safely.`,
                entityType: 'AUCTION',
                entityId: auctionId,
                link: '/dashboard/seller/auctions',
            });

            if (seller?.email) {
                // Never infer payment from sellerBonusReleased alone: approval
                // is a separate state. A real transfer ID means Stripe accepted
                // the transfer, NOT that funds have reached the seller's bank.
                const emailStage = sellerBonusEmailState({
                    sellerBonusReleased: true,
                    stripePayoutTransferId: stripeTransferId,
                }, payoutReason);
                this.emailService.sendHandoverApprovedEmail(
                    seller.email,
                    seller.firstName || 'there',
                    auction.listing.title,
                    emailStage,
                ).catch((error: any) => this.logger.error(
                    `Handover email failed for auction ${auctionId}: ${error?.message || error}`,
                ));
            }
        }

        return this.prisma.auction.findUnique({ where: { id: auctionId } });
    }

    /**
     * List approved handovers whose £100 seller bonus still hasn't actually
     * reached the seller — i.e. sellerBonusReleased is true (admin approved
     * it) but neither a Stripe transfer nor a manual bank payment has been
     * confirmed. Without this, an approved-but-unpaid auction had no
     * persistent home anywhere in the system once it left the pending queue.
     */
    async getPendingPayouts() {
        const rows = await this.prisma.auction.findMany({
            where: {
                deletedAt: null,
                status: 'ENDED',
                winnerId: { not: null },
                buyerFeePaid: true,
                buyerFeeTransactionId: { not: null },
                buyerRefusedAt: null,
                handoverSubmittedAt: { not: null },
                sellerBonusReleased: true,
                sellerBonusReleasedAt: { not: null },
                manualPayoutConfirmedAt: null,
                AND: [
                    {
                        OR: [
                            { handoverProofPath: { not: null } },
                            { handoverProofUrl: { not: null } },
                        ],
                    },
                    {
                        OR: [
                            { stripePayoutTransferId: null },
                            { stripePayoutTransferId: { startsWith: 'claim:seller-bonus:' } },
                        ],
                    },
                ],
            },
            orderBy: { sellerBonusReleasedAt: 'asc' },
            include: {
                listing: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        images: true,
                        make: true,
                        model: true,
                        year: true,
                        seller: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                stripeConnectAccountId: true,
                                stripeConnectOnboardingComplete: true,
                                bankAccountName: true,
                                bankSortCode: true,
                                bankAccountNumber: true,
                                payoutPreference: true,
                            },
                        },
                    },
                },
                winner: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });

        // The queue must never be a weaker source of truth than the payout
        // operation itself. Historical rows can carry sellerBonusReleased=true
        // from pre-hardening workflows even though they are now cancelled or
        // lack a valid £125 fee transaction. Re-run the authoritative rule for
        // every small admin-queue candidate so pending/approved cancellations,
        // malformed fee records and other legacy inconsistencies are hidden
        // rather than presented as money that should still be paid.
        const eligible: typeof rows = [];
        for (const row of rows) {
            try {
                await this.auctionsService.assertHandoverBusinessRules(row.id, {
                    requireProof: true,
                    requireApproved: true,
                });
                eligible.push(row);
            } catch (error) {
                this.logger.warn(
                    `Excluded auction ${row.id} from pending seller payouts because its current lifecycle is no longer payout-eligible: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
        return eligible;
    }

    /**
     * A previously pending bonus has now acquired a real Stripe transfer ID,
     * or an admin has confirmed payment outside Stripe. Claim ONE follow-up
     * notice per auction, safely across concurrent admin retries/workers.
     * The notice is not part of the money movement transaction: email outages
     * must never cause an already-completed £100 transfer to be repeated.
     */
    private async notifySellerPayoutRecordedOnce(auctionId: string): Promise<void> {
        try {
            const row = await this.prisma.auction.findUnique({
                where: { id: auctionId },
                select: {
                    id: true, status: true, deletedAt: true, winnerId: true,
                    buyerFeePaid: true, buyerFeeTransactionId: true,
                    buyerRefusedAt: true, handoverSubmittedAt: true,
                    sellerBonusReleased: true, sellerBonusReleasedAt: true,
                    stripePayoutTransferId: true, manualPayoutConfirmedAt: true,
                    sellerBonusPayoutNoticeSentAt: true,
                    listing: { select: { title: true, sellerId: true } },
                },
            });
            if (!row || row.sellerBonusPayoutNoticeSentAt || !row.sellerBonusReleased ||
                !row.sellerBonusReleasedAt || !row.listing?.sellerId ||
                row.status !== 'ENDED' || row.deletedAt || row.buyerRefusedAt) return;
            const stage: SellerBonusEmailState = sellerBonusEmailState(row);
            if (stage !== 'STRIPE_TRANSFER_RECORDED' &&
                stage !== 'MANUAL_PAYMENT_RECORDED') return;
            await this.auctionsService.assertHandoverBusinessRules(auctionId, {
                requireProof: true, requireApproved: true,
            });
            const claimTime = new Date();
            const claimed = await this.prisma.auction.updateMany({
                where: {
                    id: auctionId, deletedAt: null, status: 'ENDED',
                    winnerId: row.winnerId, buyerFeePaid: true,
                    buyerFeeTransactionId: row.buyerFeeTransactionId,
                    buyerRefusedAt: null, handoverSubmittedAt: row.handoverSubmittedAt,
                    sellerBonusReleased: true, sellerBonusReleasedAt: row.sellerBonusReleasedAt,
                    stripePayoutTransferId: row.stripePayoutTransferId,
                    manualPayoutConfirmedAt: row.manualPayoutConfirmedAt,
                    sellerBonusPayoutNoticeSentAt: null,
                },
                data: { sellerBonusPayoutNoticeSentAt: claimTime },
            });
            if (claimed.count !== 1) return;
            const seller = await this.prisma.user.findUnique({
                where: { id: row.listing.sellerId },
                select: { email: true, firstName: true },
            });
            const message = stage === 'MANUAL_PAYMENT_RECORDED'
                ? 'Your £100 seller bonus has been marked paid manually. Check your bank payment.'
                : 'Your £100 seller bonus transfer has been recorded by Stripe. Bank settlement may take longer.';
            await this.notificationsService.create({
                userId: row.listing.sellerId,
                type: 'HANDOVER_PAYOUT_RECORDED',
                title: '£100 seller bonus payment update',
                message,
                entityType: 'AUCTION',
                entityId: auctionId,
                link: '/dashboard/seller/auctions',
                data: { payoutStage: stage },
            }).catch((err: any) => this.logger.error(
                `Failed payout update notification for auction ${auctionId}: ${err?.message || err}`,
            ));
            if (seller?.email) {
                const result = await this.emailService.sendHandoverApprovedEmail(
                    seller.email,
                    seller.firstName || 'there',
                    row.listing.title,
                    stage,
                );
                if (!result) this.logger.warn(
                    `Payout-stage email could not be delivered for auction ${auctionId}; no duplicate automatic send was attempted.`,
                );
            }
        } catch (error: any) {
            this.logger.error(
                `Failed seller payout-stage notification for auction ${auctionId}: ${error?.message || error}`,
            );
        }
    }

    /**
     * Remind an unpaid seller to complete Stripe Connect payout onboarding.
     *
     * The admin never receives or forwards Stripe's one-time onboarding URL.
     * Instead the seller is sent back to their authenticated CarMazium payout
     * settings, where the existing seller-owned flow creates/reopens the Stripe
     * Express onboarding session securely.
     */
    async sendStripePayoutSetupReminder(auctionId: string) {
        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            include: {
                listing: {
                    select: {
                        title: true,
                        seller: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                stripeConnectOnboardingComplete: true,
                                stripeConnectAccountId: true,
                            },
                        },
                    },
                },
            },
        });

        if (!auction) throw new NotFoundException('Auction not found');
        if (!auction.sellerBonusReleased) {
            throw new BadRequestException('This handover has not been approved yet.');
        }
        if (auction.stripePayoutTransferId || auction.manualPayoutConfirmedAt) {
            throw new BadRequestException('This seller bonus has already been paid.');
        }

        await this.auctionsService.assertHandoverBusinessRules(auctionId, {
            requireProof: true,
            requireApproved: true,
        });

        const seller = auction.listing?.seller;
        if (!seller) throw new NotFoundException('Seller not found');
        if (seller.stripeConnectAccountId && seller.stripeConnectOnboardingComplete) {
            throw new BadRequestException('Seller already has Stripe payouts connected. Use "Retry via Stripe" instead.');
        }

        const settingsLink = '/dashboard/seller/settings#payouts';
        await this.notificationsService.create({
            userId: seller.id,
            type: 'SYSTEM',
            title: 'Complete your payout setup',
            message: `Your £100 CarMazium seller bonus for "${auction.listing.title}" is waiting. Connect your bank account in Payout Settings so we can release it.`,
            entityType: 'AUCTION',
            entityId: auctionId,
            link: settingsLink,
            data: { action: 'stripe_payout_setup_required' },
        });

        let emailSent = false;
        if (seller.email) {
            try {
                await this.emailService.sendStripePayoutSetupReminderEmail(
                    seller.email,
                    seller.firstName || 'there',
                    auction.listing.title,
                );
                emailSent = true;
            } catch (err: any) {
                console.error(`[Admin] Failed to email Stripe payout setup reminder for auction ${auctionId}:`, err?.message || err);
            }
        }

        return {
            sent: true,
            emailSent,
            sellerId: seller.id,
            sellerEmail: seller.email,
            settingsLink,
        };
    }

    /**
     * Re-attempt the Stripe transfer for an approved handover that's still
     * owed — e.g. the seller has since connected Stripe, or a transient
     * Stripe error has cleared. Idempotent: no-ops if already paid.
     */
    async retryPayout(auctionId: string) {
        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            include: { listing: { select: { sellerId: true, title: true } } },
        });
        if (!auction) throw new NotFoundException('Auction not found');
        if (!auction.sellerBonusReleased) {
            throw new BadRequestException('This handover has not been approved yet.');
        }

        const claimToken = this.sellerPayoutClaimToken(auctionId);
        if (auction.manualPayoutConfirmedAt) {
            return auction;
        }
        if (
            auction.stripePayoutTransferId
            && auction.stripePayoutTransferId !== claimToken
        ) {
            return auction;
        }

        await this.auctionsService.assertHandoverBusinessRules(auctionId, {
            requireProof: true,
            requireApproved: true,
        });

        const sellerId = auction.listing?.sellerId;
        const seller = sellerId
            ? await this.prisma.user.findUnique({
                where: { id: sellerId },
                select: { stripeConnectAccountId: true, stripeConnectOnboardingComplete: true },
            })
            : null;

        if (this.paymentsService.isStripeInTestMode()) {
            throw new BadRequestException('Cannot retry via Stripe while in test mode — use "Mark Paid Manually" instead.');
        }
        if (!seller?.stripeConnectAccountId || !seller?.stripeConnectOnboardingComplete) {
            throw new BadRequestException('Seller still has no connected Stripe payout method.');
        }

        try {
            await this.settleSellerBonusViaStripe(
                auctionId,
                seller.stripeConnectAccountId,
            );
        } catch (err: any) {
            const stripeMessage = err?.message || 'Unknown Stripe error';
            console.error(`[Admin] Stripe payout retry failed for auction ${auctionId}:`, stripeMessage);

            const safeMessage = 'Stripe payout could not be completed. The seller bonus remains unpaid. Verify the seller\'s Stripe payout setup and try again.';
            await this.prisma.auction.update({
                where: { id: auctionId },
                data: { stripePayoutError: safeMessage },
            });

            throw new BadGatewayException(safeMessage);
        }

        // Trigger a single follow-up only after Stripe transfer settlement is
        // durably recorded. Re-running this retry cannot duplicate notices.
        const result = await this.prisma.auction.findUnique({ where: { id: auctionId } });
        await this.notifySellerPayoutRecordedOnce(auctionId);
        return result;
    }

    /**
     * Admin confirms they've paid the seller's £100 bonus manually (bank
     * transfer outside Stripe) — the only way an approved-but-unpaid auction
     * could ever be marked resolved before this existed.
     */
    async markPayoutPaidManually(auctionId: string) {
        const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
        if (!auction) throw new NotFoundException('Auction not found');
        if (!auction.sellerBonusReleased) {
            throw new BadRequestException('This handover has not been approved yet.');
        }

        await this.auctionsService.assertHandoverBusinessRules(auctionId, {
            requireProof: true,
            requireApproved: true,
        });

        if (auction.manualPayoutConfirmedAt) return auction;
        const claimToken = this.sellerPayoutClaimToken(auctionId);
        if (
            auction.stripePayoutTransferId
            && auction.stripePayoutTransferId !== claimToken
        ) {
            return auction; // Stripe already paid it.
        }

        const paidAt = new Date();
        const marked = await this.prisma.auction.updateMany({
            where: {
                id: auctionId,
                deletedAt: null,
                status: 'ENDED',
                winnerId: { not: null },
                buyerFeePaid: true,
                buyerFeeTransactionId: { not: null },
                buyerRefusedAt: null,
                handoverSubmittedAt: { not: null },
                sellerBonusReleased: true,
                sellerBonusReleasedAt: { not: null },
                stripePayoutTransferId: null,
                manualPayoutConfirmedAt: null,
                OR: [
                    { handoverProofPath: { not: null } },
                    { handoverProofUrl: { not: null } },
                ],
            },
            data: {
                manualPayoutConfirmedAt: paidAt,
                stripePayoutError: null,
            },
        });

        if (marked.count === 1) {
            // This branch alone recorded a new manual payment. Concurrent
            // retries cannot send the same paid notice twice.
            await this.notifySellerPayoutRecordedOnce(auctionId);
            return this.prisma.auction.findUnique({ where: { id: auctionId } });
        }

        const current = await this.prisma.auction.findUnique({ where: { id: auctionId } });
        if (!current) throw new NotFoundException('Auction not found');
        if (current.manualPayoutConfirmedAt) return current;
        if (
            current.stripePayoutTransferId
            && current.stripePayoutTransferId !== claimToken
        ) {
            return current;
        }
        if (current.stripePayoutTransferId === claimToken) {
            throw new ConflictException(
                'Stripe payout is in progress or awaiting an idempotent retry. Verify/retry Stripe before marking this payout manually.',
            );
        }
        throw new ConflictException('Seller bonus payout state changed. Refresh and try again.');
    }

    /**
     * Reject the handover DOCUMENT for correction, not the vehicle sale.
     * A missing/unclear photo is never grounds to refund the auction buyer fee.
     * Inspection refusal and approved sale cancellation have separate flows.
     */
    async denyHandover(auctionId: string, reason: string) {
        const feedback = typeof reason === 'string' ? reason.trim() : '';
        if (feedback.length < 10 || feedback.length > 500) {
            throw new BadRequestException('Enter a handover proof rejection reason of 10–500 characters');
        }

        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            include: { listing: { select: { sellerId: true, title: true } } },
        });
        if (!auction || auction.deletedAt) throw new NotFoundException('Auction not found');
        if (
            auction.sellerBonusReleased || auction.sellerBonusReleasedAt
            || auction.stripePayoutTransferId || auction.manualPayoutConfirmedAt
        ) {
            throw new ConflictException('This handover has already been approved or entered payout');
        }
        if (!auction.handoverProofPath && !auction.handoverProofUrl) {
            // A second click after successful rejection must not send duplicate
            // notifications or change buyer money.
            if (auction.handoverRejectedAt) return auction;
            throw new BadRequestException('No submitted handover proof is available to reject');
        }
        if (auction.status !== 'ENDED' || !auction.winnerId || !auction.handoverSubmittedAt) {
            throw new BadRequestException('Only an ended auction with a winner and submitted proof can be reviewed');
        }

        // Claim the exact proof currently under review before deleting objects.
        // A simultaneous approval or replacement proof cannot be wiped by an
        // admin holding an outdated page. No refund or transaction update.
        const rejectedAt = new Date();
        const claimed = await this.prisma.auction.updateMany({
            where: {
                id: auctionId,
                deletedAt: null,
                status: 'ENDED',
                winnerId: auction.winnerId,
                buyerRefusedAt: null,
                handoverSubmittedAt: auction.handoverSubmittedAt,
                handoverProofPath: auction.handoverProofPath,
                handoverProofUrl: auction.handoverProofUrl,
                sellerBonusReleased: false,
                sellerBonusReleasedAt: null,
                stripePayoutTransferId: null,
                manualPayoutConfirmedAt: null,
            },
            data: {
                handoverProofUrl: null,
                handoverProofPath: null,
                handoverSubmittedAt: null,
                handoverRejectedAt: rejectedAt,
                handoverRejectionReason: feedback,
            },
        });
        if (claimed.count !== 1) {
            throw new ConflictException('Handover state changed during review. Refresh before taking action.');
        }

        // Never delete evidence before the DB claim succeeds. The helper
        // handles private and legacy storage and deliberately tolerates outages
        // so seller resubmission is not blocked by stale object cleanup.
        await this.handoverDocuments.deleteProof(
            auction.handoverProofPath,
            auction.handoverProofUrl,
        );

        const sellerId = auction.listing?.sellerId;
        if (sellerId) {
            await this.notificationsService.create({
                userId: sellerId,
                type: 'HANDOVER_DENIED',
                title: 'Handover proof needs correction',
                message: `Your proof for "${auction.listing.title}" needs correction: ${feedback}. Your buyer fee and sale are unchanged. Upload corrected evidence for review.`,
                entityType: 'AUCTION',
                entityId: auctionId,
                link: '/dashboard/seller/auctions',
            }).catch((err: any) => {
                this.logger.warn(`Unable to deliver handover correction notification: ${err?.message || err}`);
            });

            const seller = await this.prisma.user.findUnique({
                where: { id: sellerId }, select: { email: true, firstName: true },
            });
            if (seller?.email) {
                this.emailService.sendHandoverDeniedEmail(
                    seller.email, seller.firstName || 'there', auction.listing.title, feedback,
                ).catch((err: any) => this.logger.warn(
                    `Unable to email handover correction notice: ${err?.message || err}`,
                ));
            }
        }

        return this.prisma.auction.findUnique({ where: { id: auctionId } });
    }

    async getAllTransactions(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.transaction.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true, email: true, firstName: true, lastName: true, phone: true,
                            dealerProfile: { select: { companyName: true, isVerified: true } },
                        },
                    },
                    // hpiReport rides along so an HPI_REPORT / HPI_REPORT_EMAIL row
                    // in the ledger can show whether that payment has actually
                    // been fulfilled, and let an admin attach the report right
                    // there rather than going looking for the listing.
                    listing: {
                        select: {
                            id: true, title: true, slug: true, make: true, model: true, year: true,
                            hpiReport: { select: { status: true, isClear: true, pdfUploadedAt: true, preparedAt: true } },
                        },
                    },
                },
            }),
            this.prisma.transaction.count(),
        ]);
        return { data, total };
    }

    // £25 of the £125 auction buyer fee is CarMazium's own cut — the other
    // £100 is a seller bonus paid out via Stripe Connect transfer
    // (issueSellerPayout). Mirrors AUCTION_PLATFORM_FEE in payments.service.ts.
    private readonly AUCTION_PLATFORM_FEE_CUT = 25;

    /**
     * "Revenue" here means money CarMazium actually retains, not gross Stripe
     * throughput. LISTING_FEE, HPI_REPORT (seller's report request),
     * HPI_REPORT_EMAIL (buyer's paid emailed copy) and KYC_VERIFICATION are all kept in full.
     * COMMISSION (the £125 auction buyer fee) is counted per-transaction at
     * the fixed £25 platform cut, not by summing `amount` — the stored
     * amount is the full £125, £100 of which is seller pass-through. DEPOSIT
     * and FULL_PAYMENT are buyer funds for the vehicle itself — refundable or
     * a pass-through to the seller — and are excluded entirely; there's
     * currently no seller-payout mechanism for FULL_PAYMENT by design (retail
     * sales settle outside the fee flow), so none of that money is ever
     * CarMazium's to count. BOOST payments don't create Transaction rows at
     * all yet (see FeaturedBoostService) and so aren't reflected here either.
     */
    private async computeRealRevenue(dateRange?: { gte: Date; lte: Date }): Promise<number> {
        const createdAt = dateRange ? { createdAt: dateRange } : {};
        const [feeAgg, commissionCount] = await Promise.all([
            this.prisma.transaction.aggregate({
                where: { status: 'COMPLETED', deletedAt: null, type: { in: ['LISTING_FEE', 'HPI_REPORT', 'HPI_REPORT_EMAIL', 'KYC_VERIFICATION'] }, ...createdAt },
                _sum: { amount: true },
            }),
            this.prisma.transaction.count({
                where: { status: 'COMPLETED', deletedAt: null, type: 'COMMISSION', ...createdAt },
            }),
        ]);
        return Math.round(
            (Number(feeAgg._sum?.amount ?? 0) + commissionCount * this.AUCTION_PLATFORM_FEE_CUT) * 100,
        ) / 100;
    }

    async getPlatformStats() {
        const now = new Date();
        const [users, listings, activeListings, soldListings, auctions, activeAuctions, endedAuctions, bids, totalRevenue] = await Promise.all([
            this.prisma.user.count({ where: { deletedAt: null } }),
            // Inventory totals exclude soft-deleted rows.
            this.prisma.listing.count({ where: { deletedAt: null } }),
            this.prisma.listing.count({ where: { status: 'ACTIVE', deletedAt: null } }),
            // Completed sales come from the canonical Sale ledger, not inventory status.
            this.prisma.sale.count(),
            this.prisma.auction.count({ where: { deletedAt: null } }),
            this.prisma.auction.count({
                where: {
                    status: 'ACTIVE',
                    deletedAt: null,
                    endTime: { gt: now },
                    listing: { deletedAt: null, status: 'ACTIVE' },
                },
            }),
            this.prisma.auction.count({ where: { status: 'ENDED', deletedAt: null } }),
            this.prisma.bid.count({ where: { deletedAt: null } }),
            this.computeRealRevenue(),
        ]);

        return {
            totalUsers: users,
            totalListings: listings,
            activeListings,
            soldListings,
            totalAuctions: auctions,
            activeAuctions,
            endedAuctions,
            totalBids: bids,
            totalRevenue,
        };
    }

    async getAnalyticsData() {
        // Last 6 months of data
        const now = new Date();
        const months: { label: string; start: Date; end: Date }[] = [];
        for (let i = 5; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
            months.push({
                label: start.toLocaleString('default', { month: 'short', year: '2-digit' }),
                start,
                end,
            });
        }

        const data = await Promise.all(
            months.map(async ({ label, start, end }) => {
                const [newUsers, newListings, revenue] = await Promise.all([
                    this.prisma.user.count({ where: { createdAt: { gte: start, lte: end }, deletedAt: null } }),
                    this.prisma.listing.count({ where: { createdAt: { gte: start, lte: end }, deletedAt: null } }),
                    this.computeRealRevenue({ gte: start, lte: end }),
                ]);
                return {
                    month: label,
                    newUsers,
                    newListings,
                    revenue,
                };
            }),
        );

        return data;
    }

    async getPendingKyc() {
        return this.prisma.dealerKyc.findMany({
            where: {
                status: {
                    in: ['PENDING', 'REJECTED']
                },
                // Document uploads can create an unpaid draft before the dealer
                // submits the full form. Only applications with completed
                // verification payment evidence are actionable. Keep legacy
                // bank-transfer submissions visible alongside the Stripe flow.
                OR: [
                    { stripeChargedAt: { not: null } },
                    { paymentReference: { not: null } },
                    { paymentScreenshot: { not: null } },
                    { paymentScreenshotPath: { not: null } },
                ],
            },
            include: {
                dealerProfile: {
                    include: {
                        user: {
                            select: {
                                email: true,
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                }
            },
            orderBy: { submittedAt: 'desc' },
        });
    }

    /**
     * Every dealer with a KYC record, regardless of status — getPendingKyc()
     * only shows PENDING/REJECTED, so an approved dealer's submission
     * (including document URLs) becomes permanently unreachable in the admin
     * panel the moment it's approved. This is the archive that fixes that.
     */
    async getAllDealersKycArchive(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.dealerKyc.findMany({
                skip,
                take: limit,
                include: {
                    dealerProfile: {
                        include: {
                            user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
                        },
                    },
                },
                orderBy: { submittedAt: 'desc' },
            }),
            this.prisma.dealerKyc.count(),
        ]);
        return { data, total };
    }

    async reviewKyc(kycId: string, dto: ReviewKycDto) {
        const kyc = await this.prisma.dealerKyc.findUnique({
            where: { id: kycId },
            include: {
                dealerProfile: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                }
            }
        });

        if (!kyc) {
            throw new NotFoundException('KYC record not found');
        }

        const currentDocStatuses = (kyc.documentStatuses as Record<string, any>) || {};
        const updatedDocStatuses = { ...currentDocStatuses };
        const effectiveBusinessType = dto.businessType ?? kyc.businessType;

        // Process the reviews granularly
        for (const review of dto.fields) {
            updatedDocStatuses[review.field] = {
                status: review.status,
                note: review.status === 'REJECTED' ? (review.note || '') : '',
            };
        }

        // Determine if all applicable fields are approved. Sole traders do not
        // have Companies House / VAT / PSC evidence; registered companies do not
        // use the sole-trader proof-of-address requirement. Keep this backend
        // contract aligned with the admin UI's fieldsFor(...) filter.
        const commonFields = [
            'companyHouseName',
            'representativeName',
            'representativePosition',
            'directorName',
            'directorIdProof',
            'businessWebsite',
            'businessRegisteredAddress',
            'tradingAddress',
            'googleReviewsLink',
            'paymentReference',
            'paymentScreenshot',
        ];
        const allFields = effectiveBusinessType === 'SOLE_PROPRIETORSHIP'
            ? [...commonFields, 'proofOfAddress']
            : [
                ...commonFields,
                'vatNumber',
                'vatProof',
                'companyRegistrationNumber',
                'companyRegistrationProof',
                'personOfSignificantControl',
            ];

        let hasRejected = false;
        let hasPending = false;
        const rejectedFields: { field: string; note: string }[] = [];

        for (const field of allFields) {
            const fieldStatus = updatedDocStatuses[field]?.status || 'PENDING';
            if (fieldStatus === 'REJECTED') {
                hasRejected = true;
                rejectedFields.push({
                    field,
                    note: updatedDocStatuses[field]?.note || '',
                });
            } else if (fieldStatus === 'PENDING') {
                hasPending = true;
            }
        }

        let overallStatus: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
        if (hasRejected) {
            overallStatus = 'REJECTED';
        } else if (!hasPending) {
            overallStatus = 'APPROVED';
        }

        // Update the KYC record
        const updatedKyc = await this.prisma.dealerKyc.update({
            where: { id: kycId },
            data: {
                businessType: effectiveBusinessType,
                status: overallStatus,
                documentStatuses: updatedDocStatuses,
                reviewedAt: new Date(),
            },
        });

        const dealerEmail = kyc.dealerProfile.user.email;
        const dealerName = kyc.dealerProfile.companyName || kyc.dealerProfile.user.firstName || 'Dealer';

        const dealerUserId = kyc.dealerProfile.user?.id ?? null;

        if (overallStatus === 'APPROVED') {
            // Unblock dealer dashboard
            await this.prisma.dealerProfile.update({
                where: { id: kyc.dealerProfileId },
                data: {
                    isVerified: true,
                    verificationDate: new Date(),
                },
            });

            // Send approval email
            await this.emailService.sendKycApprovedDealerAlert(dealerEmail, dealerName).catch(console.error);

            // In-app notification to dealer
            if (dealerUserId) {
                const notification = await this.notificationsService.create({
                    userId: dealerUserId,
                    type: 'KYC_APPROVED',
                    title: 'KYC Verification Approved',
                    message: 'Your dealership documents have been verified. Your dealer dashboard is now fully unlocked!',
                    link: '/dashboard/dealer',
                    entityType: 'DealerKyc',
                    entityId: kyc.id,
                    actionType: 'APPROVED',
                }).catch(() => null);
                if (notification) {
                    this.notificationsGateway.sendNotification(dealerUserId, notification);
                }
            }
        } else if (overallStatus === 'REJECTED') {
            // Keep blocked
            await this.prisma.dealerProfile.update({
                where: { id: kyc.dealerProfileId },
                data: {
                    isVerified: false,
                },
            });

            // Send rejection email
            await this.emailService.sendKycRejectedDealerAlert(dealerEmail, dealerName, rejectedFields).catch(console.error);

            // In-app notification to dealer
            if (dealerUserId) {
                const fieldNames = rejectedFields.map(f => f.field.replace(/([A-Z])/g, ' $1').trim()).join(', ');
                const notification = await this.notificationsService.create({
                    userId: dealerUserId,
                    type: 'KYC_REJECTED',
                    title: 'KYC Documents Need Attention',
                    message: `Some documents require revision: ${fieldNames}. Please log in and re-upload the flagged items.`,
                    link: '/dashboard/dealer',
                    entityType: 'DealerKyc',
                    entityId: kyc.id,
                    actionType: 'REJECTED',
                }).catch(() => null);
                if (notification) {
                    this.notificationsGateway.sendNotification(dealerUserId, notification);
                }
            }
        }

        return updatedKyc;
    }
}

