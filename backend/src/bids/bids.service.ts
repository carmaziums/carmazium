import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuctionGateway } from '../auctions/auction.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { Bid } from '@prisma/client';
import {
    calculateBuyItNowResponseDeadline,
    calculateFirstOfferFloor,
} from '../auctions/auction-pricing';
import { randomUUID } from 'crypto';
import {
    assertDealerPermission,
    resolveBusinessBuyerId,
    resolveDealerActor,
} from '../dealers/dealer-access';

const BID_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
const ANTI_SNIPE_WINDOW_MS = 3 * 60 * 1000;

@Injectable()
export class BidsService {
    private readonly logger = new Logger(BidsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly auctionGateway: AuctionGateway,
        private readonly notificationsService: NotificationsService,
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
            // Analytics must never block a bid or cancellation.
        });
    }

    async create(bidderId: string, createBidDto: CreateBidDto): Promise<Bid> {
        const listing = await this.prisma.listing.findUnique({
            where: { id: createBidDto.listingId },
            include: { auction: true },
        });

        if (!listing || listing.deletedAt) {
            throw new NotFoundException('Listing not found');
        }
        if (listing.type !== 'AUCTION') {
            throw new BadRequestException('This listing is not an auction');
        }
        if (!listing.auction) {
            throw new BadRequestException('No auction has been created for this listing');
        }
        if (listing.auction.status !== 'ACTIVE') {
            throw new BadRequestException('This auction is not currently active');
        }

        // Resolve the human actor first, but always persist the canonical
        // dealership owner as bidder identity.
        const bidder = await this.prisma.user.findUnique({
            where: { id: bidderId },
            select: { role: true, firstName: true, lastName: true },
        });
        if (bidder?.role !== 'DEALER') {
            throw new ForbiddenException('Only verified dealers can place bids on auctions.');
        }

        const dealerActor = await resolveDealerActor(this.prisma, bidderId);
        if (!dealerActor?.isVerified) {
            throw new ForbiddenException('Only verified dealers can place bids on auctions.');
        }
        assertDealerPermission(
            dealerActor,
            'PLACE_BID',
            'Your dealership role does not allow auction bidding.',
        );
        const businessBidderId = dealerActor.ownerUserId;

        if (listing.sellerId === businessBidderId) {
            throw new BadRequestException('You cannot bid on your own auction');
        }

        type AtomicBidPlacementRow = {
            listing_id: string;
            listing_type: string;
            listing_status: string;
            listing_deleted_at: Date | string | null;
            seller_id: string | null;
            listing_title: string;
            listing_make: string | null;
            listing_model: string | null;
            listing_year: number | null;
            listing_vrm: string | null;
            listing_price: unknown;
            auction_id: string | null;
            auction_status: string | null;
            start_time: Date | string | null;
            end_time: Date | string | null;
            starting_bid: unknown | null;
            reserve_price: unknown | null;
            min_increment: unknown | null;
            buy_it_now_pending_buyer_id: string | null;
            highest_bid_id: string | null;
            highest_bidder_id: string | null;
            highest_bid_amount: unknown | null;
            min_allowed: unknown | null;
            pending_buyer_to_cancel: string | null;
            should_extend: boolean;
            decision_code:
                | 'OK'
                | 'NOT_FOUND'
                | 'NOT_AUCTION'
                | 'NO_AUCTION'
                | 'AUCTION_NOT_ACTIVE'
                | 'LISTING_NOT_ACTIVE'
                | 'ENDED'
                | 'OWN_AUCTION'
                | 'INVALID_PRICES'
                | 'BID_TOO_LOW';
            bid_id: string | null;
            bid_listing_id: string | null;
            bid_bidder_id: string | null;
            bid_amount: unknown | null;
            bid_timestamp: Date | string | null;
            bid_created_at: Date | string | null;
            bid_updated_at: Date | string | null;
            bid_deleted_at: Date | string | null;
            bid_cancelled_at: Date | string | null;
            bid_archived_at: Date | string | null;
            buy_it_now_pending_at: Date | string | null;
            new_end_time: Date | string | null;
        };

        /*
         * Production bid placement must not depend on Prisma keeping an
         * interactive transaction pinned through a pooled connection. The
         * critical path is therefore one PostgreSQL statement.
         *
         * The statement takes the same transaction-scoped advisory lock used
         * by reserve correction and auction finalisation, re-reads canonical
         * state only after the lock is held, calculates the first-offer/normal
         * increment rule, inserts exactly one bid, and applies BIN cancellation
         * / anti-snipe extension before the statement transaction releases.
         */
        const bidId = randomUUID();
        const rows = await this.prisma.$queryRaw<AtomicBidPlacementRow[]>`
            WITH target AS MATERIALIZED (
                SELECT
                    l.id AS listing_id,
                    l.type::text AS listing_type,
                    l.status::text AS listing_status,
                    l."deletedAt" AS listing_deleted_at,
                    l."sellerId" AS seller_id,
                    l.title AS listing_title,
                    l.make AS listing_make,
                    l.model AS listing_model,
                    l.year AS listing_year,
                    l.vrm AS listing_vrm,
                    l.price AS listing_price,
                    a.id AS auction_id,
                    a.status::text AS auction_status,
                    a."startTime" AS start_time,
                    a."endTime" AS end_time,
                    a."startingBid" AS starting_bid,
                    a."reservePrice" AS reserve_price,
                    a."minIncrement" AS min_increment,
                    a."buyItNowPendingBuyerId" AS buy_it_now_pending_buyer_id,
                    a."buyItNowPendingAt" AS buy_it_now_pending_at
                FROM "listings" l
                LEFT JOIN "auctions" a
                    ON a."listingId" = l.id
                   AND a."deletedAt" IS NULL
                WHERE l.id = ${createBidDto.listingId}
            ),
            lock_row AS MATERIALIZED (
                SELECT pg_advisory_xact_lock(hashtextextended(t.listing_id, 0)) AS locked
                FROM target t
            ),
            snapshot AS MATERIALIZED (
                SELECT
                    t.*,
                    hb.id AS highest_bid_id,
                    hb."bidderId" AS highest_bidder_id,
                    hb.amount AS highest_bid_amount
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
                ) hb ON TRUE
            ),
            pricing AS MATERIALIZED (
                SELECT
                    s.*,
                    CASE
                        WHEN s.highest_bid_amount IS NULL
                            THEN ROUND(LEAST(s.starting_bid, s.reserve_price) * 0.70, 2)
                        ELSE ROUND(s.highest_bid_amount + s.min_increment, 2)
                    END AS min_allowed,
                    CASE
                        WHEN s.buy_it_now_pending_buyer_id IS NOT NULL
                             AND ${createBidDto.amount}::numeric >= s.reserve_price
                            THEN s.buy_it_now_pending_buyer_id
                        ELSE NULL
                    END AS pending_buyer_to_cancel,
                    (
                        s.end_time IS NOT NULL
                        AND s.end_time > NOW()
                        AND s.end_time <= NOW() + INTERVAL '3 minutes'
                    ) AS should_extend
                FROM snapshot s
            ),
            decision AS MATERIALIZED (
                SELECT
                    p.*,
                    CASE
                        WHEN p.listing_deleted_at IS NOT NULL THEN 'NOT_FOUND'
                        WHEN p.listing_type <> 'AUCTION' THEN 'NOT_AUCTION'
                        WHEN p.auction_id IS NULL THEN 'NO_AUCTION'
                        WHEN p.auction_status <> 'ACTIVE' THEN 'AUCTION_NOT_ACTIVE'
                        WHEN p.listing_status <> 'ACTIVE' THEN 'LISTING_NOT_ACTIVE'
                        WHEN p.end_time IS NULL OR NOW() >= p.end_time THEN 'ENDED'
                        WHEN p.seller_id = ${businessBidderId} THEN 'OWN_AUCTION'
                        WHEN p.highest_bid_amount IS NULL
                             AND (
                                 p.starting_bid IS NULL
                                 OR p.reserve_price IS NULL
                                 OR p.starting_bid <= 0
                                 OR p.reserve_price <= 0
                             ) THEN 'INVALID_PRICES'
                        WHEN p.highest_bid_amount IS NOT NULL
                             AND (
                                 p.highest_bid_amount <= 0
                                 OR p.min_increment IS NULL
                                 OR p.min_increment <= 0
                             ) THEN 'INVALID_PRICES'
                        WHEN p.min_allowed IS NULL
                             OR ${createBidDto.amount}::numeric < p.min_allowed THEN 'BID_TOO_LOW'
                        ELSE 'OK'
                    END AS decision_code
                FROM pricing p
            ),
            inserted AS (
                INSERT INTO "bids" (
                    id,
                    "listingId",
                    "bidderId",
                    amount,
                    "timestamp",
                    "createdAt",
                    "updatedAt"
                )
                SELECT
                    ${bidId},
                    d.listing_id,
                    ${businessBidderId},
                    ${createBidDto.amount}::numeric,
                    NOW(),
                    NOW(),
                    NOW()
                FROM decision d
                WHERE d.decision_code = 'OK'
                RETURNING
                    id,
                    "listingId",
                    "bidderId",
                    amount,
                    "timestamp",
                    "createdAt",
                    "updatedAt",
                    "deletedAt",
                    "cancelledAt",
                    "archivedAt"
            ),
            auction_update AS (
                UPDATE "auctions" a
                SET
                    "buyItNowPendingBuyerId" = CASE
                        WHEN d.pending_buyer_to_cancel IS NOT NULL
                            THEN NULL
                        ELSE a."buyItNowPendingBuyerId"
                    END,
                    "buyItNowPendingAt" = CASE
                        WHEN d.pending_buyer_to_cancel IS NOT NULL
                            THEN NULL
                        ELSE a."buyItNowPendingAt"
                    END,
                    "endTime" = CASE
                        WHEN d.should_extend
                            THEN a."endTime" + INTERVAL '3 minutes'
                        ELSE a."endTime"
                    END,
                    "updatedAt" = NOW()
                FROM decision d
                WHERE a.id = d.auction_id
                  AND EXISTS (SELECT 1 FROM inserted)
                  AND (d.pending_buyer_to_cancel IS NOT NULL OR d.should_extend)
                RETURNING a."endTime" AS applied_end_time
            )
            SELECT
                d.*,
                (SELECT id FROM inserted LIMIT 1) AS bid_id,
                (SELECT "listingId" FROM inserted LIMIT 1) AS bid_listing_id,
                (SELECT "bidderId" FROM inserted LIMIT 1) AS bid_bidder_id,
                (SELECT amount FROM inserted LIMIT 1) AS bid_amount,
                (SELECT "timestamp" FROM inserted LIMIT 1) AS bid_timestamp,
                (SELECT "createdAt" FROM inserted LIMIT 1) AS bid_created_at,
                (SELECT "updatedAt" FROM inserted LIMIT 1) AS bid_updated_at,
                (SELECT "deletedAt" FROM inserted LIMIT 1) AS bid_deleted_at,
                (SELECT "cancelledAt" FROM inserted LIMIT 1) AS bid_cancelled_at,
                (SELECT "archivedAt" FROM inserted LIMIT 1) AS bid_archived_at,
                CASE
                    WHEN d.should_extend
                        THEN (SELECT applied_end_time FROM auction_update LIMIT 1)
                    ELSE NULL
                END AS new_end_time
            FROM decision d
        `;

        const row = rows[0];
        if (!row) {
            throw new NotFoundException('Listing not found');
        }

        const minAllowed = row.min_allowed == null ? 0 : Number(row.min_allowed);
        const startingBid = row.starting_bid == null ? 0 : Number(row.starting_bid);
        const reservePrice = row.reserve_price == null ? 0 : Number(row.reserve_price);
        const minIncrement = row.min_increment == null ? 0 : Number(row.min_increment);
        const highestBidAmount = row.highest_bid_amount == null ? null : Number(row.highest_bid_amount);

        switch (row.decision_code) {
            case 'NOT_FOUND':
                throw new NotFoundException('Listing not found');
            case 'NOT_AUCTION':
                throw new BadRequestException('This listing is not an auction');
            case 'NO_AUCTION':
                throw new BadRequestException('No auction has been created for this listing');
            case 'AUCTION_NOT_ACTIVE':
                throw new BadRequestException('This auction is not currently active');
            case 'LISTING_NOT_ACTIVE':
                throw new BadRequestException('This vehicle is not currently available for auction bidding');
            case 'ENDED':
                throw new BadRequestException('This auction has ended and is no longer accepting bids');
            case 'OWN_AUCTION':
                throw new BadRequestException('You cannot bid on your own auction');
            case 'INVALID_PRICES':
                throw new BadRequestException('This auction does not have valid bidding prices');
            case 'BID_TOO_LOW':
                if (highestBidAmount !== null) {
                    throw new BadRequestException(
                        `Bid must be at least £${minAllowed.toLocaleString()} (current: £${highestBidAmount.toLocaleString()} + £${minIncrement.toLocaleString()} increment)`,
                    );
                }
                const referencePrice = Math.min(startingBid, reservePrice);
                throw new BadRequestException(
                    `First offer must be at least £${minAllowed.toLocaleString()} (30% below the lower of the £${startingBid.toLocaleString()} starting bid and £${reservePrice.toLocaleString()} reserve; reference £${referencePrice.toLocaleString()})`,
                );
            case 'OK':
                break;
        }

        if (!row.bid_id || !row.bid_timestamp || !row.bid_created_at || !row.bid_updated_at) {
            throw new ConflictException(
                'The bid could not be committed. Refresh the auction and try again.',
            );
        }

        const toDate = (value: Date | string) => value instanceof Date ? value : new Date(value);
        const bid: Bid = {
            id: row.bid_id,
            listingId: row.bid_listing_id || row.listing_id,
            bidderId: row.bid_bidder_id || businessBidderId,
            amount: row.bid_amount as any,
            timestamp: toDate(row.bid_timestamp),
            createdAt: toDate(row.bid_created_at),
            updatedAt: toDate(row.bid_updated_at),
            deletedAt: row.bid_deleted_at ? toDate(row.bid_deleted_at) : null,
            cancelledAt: row.bid_cancelled_at ? toDate(row.bid_cancelled_at) : null,
            archivedAt: row.bid_archived_at ? toDate(row.bid_archived_at) : null,
        };

        const highestBid = row.highest_bid_id
            ? {
                id: row.highest_bid_id,
                bidderId: row.highest_bidder_id,
                amount: row.highest_bid_amount,
            }
            : null;

        const lockedListing = {
            id: row.listing_id,
            sellerId: row.seller_id,
            title: row.listing_title,
            make: row.listing_make,
            model: row.listing_model,
            year: row.listing_year,
            vrm: row.listing_vrm,
            price: row.listing_price,
        };

        const lockedAuction = {
            id: row.auction_id!,
            startTime: row.start_time,
            endTime: row.end_time,
            startingBid: row.starting_bid,
            reservePrice: row.reserve_price,
            minIncrement: row.min_increment,
        };

        const pendingBuyerId = row.pending_buyer_to_cancel;
        const newEndTime = row.new_end_time ? toDate(row.new_end_time) : null;
        const pendingAt = row.buy_it_now_pending_at
            ? toDate(row.buy_it_now_pending_at)
            : null;
        const effectiveEndTime = newEndTime ?? toDate(row.end_time);
        const buyItNowResponseDeadline = (
            row.buy_it_now_pending_buyer_id
            && !pendingBuyerId
            && pendingAt
        )
            ? calculateBuyItNowResponseDeadline(pendingAt, effectiveEndTime).toISOString()
            : undefined;

        const bidAmount = Number(bid.amount);
        const isFirstOffer = !highestBid;
        const firstOfferFloor = isFirstOffer
            ? calculateFirstOfferFloor(startingBid, reservePrice)
            : null;
        const percentBelowReserve = reservePrice > 0
            ? Math.max(0, Math.round(((reservePrice - bidAmount) / reservePrice) * 1000) / 10)
            : 0;
        const percentBelowStartingBid = startingBid > 0
            ? Math.max(0, Math.round(((startingBid - bidAmount) / startingBid) * 1000) / 10)
            : 0;

        this.trackAuctionEvent('auction_bid_placed', {
            auction_id: lockedAuction.id,
            auction_run_key: this.auctionRunKey(lockedAuction),
            listing_id: lockedListing.id,
            bid_id: bid.id,
            registration: lockedListing.vrm ?? null,
            vehicle: [lockedListing.year, lockedListing.make, lockedListing.model].filter(Boolean).join(' ') || lockedListing.title,
            amount: bidAmount,
            previous_highest_bid: highestBid ? Number(highestBid.amount) : null,
            starting_bid: startingBid,
            reserve_price: reservePrice,
            min_increment: minIncrement,
            first_offer_floor: firstOfferFloor,
            is_first_offer: isFirstOffer,
            below_starting_bid: bidAmount < startingBid,
            below_reserve: bidAmount < reservePrice,
            reserve_met_after: bidAmount >= reservePrice,
            percent_below_reserve: percentBelowReserve,
            percent_below_starting_bid: percentBelowStartingBid,
            market_value: Number(lockedListing.price) || null,
            anti_snipe_extended: Boolean(newEndTime),
            new_end_time: newEndTime?.toISOString() ?? null,
        }, businessBidderId);

        if (pendingBuyerId) {
            this.notificationsService.create({
                userId: pendingBuyerId,
                type: 'AUCTION_ENDED',
                title: 'Buy It Now request cancelled',
                message: `A new bid cancelled your Buy It Now request on ${lockedListing.make} ${lockedListing.model}.`,
                entityType: 'AUCTION',
                entityId: lockedAuction.id,
                link: `/auctions/live/${lockedAuction.id}`,
            }).catch(() => { /* notification failure must not fail the bid */ });
        }

        if (lockedListing.sellerId && bidAmount < reservePrice) {
            const vehicle = [lockedListing.year, lockedListing.make, lockedListing.model].filter(Boolean).join(' ') || lockedListing.title;
            this.notificationsService.create({
                userId: lockedListing.sellerId,
                type: 'AUCTION_OFFER_RECEIVED',
                title: 'New auction offer received',
                message: `Highest offer: £${bidAmount.toLocaleString('en-GB')} on ${vehicle}. Your reserve is £${reservePrice.toLocaleString('en-GB')}. Accept it now or keep the auction running.`,
                entityType: 'AUCTION',
                entityId: lockedAuction.id,
                actionType: 'ACCEPT_OR_WAIT',
                link: `/auctions/live/${lockedAuction.id}?sellerOffer=${bid.id}`,
                data: {
                    listingId: lockedListing.id,
                    bidId: bid.id,
                    amount: bidAmount,
                    reservePrice,
                    belowReserve: true,
                },
            }).catch(() => { /* notification failure must not fail the bid */ });
        }

        if (highestBid && highestBid.bidderId !== businessBidderId) {
            this.notificationsService.create({
                userId: highestBid.bidderId!,
                type: 'OUTBID',
                title: "You've been outbid",
                message: `A new bid of £${createBidDto.amount.toLocaleString()} was placed on ${lockedListing.make} ${lockedListing.model}. Bid again to stay in the lead.`,
                entityType: 'AUCTION',
                entityId: lockedAuction.id,
                link: `/auctions/live/${lockedAuction.id}`,
            }).catch(() => { /* notification failure must not fail the bid */ });
        }

        const initials = `${bidder?.firstName?.[0] ?? '?'}${bidder?.lastName?.[0] ?? ''}`.toUpperCase();

        // A realtime outage must never turn an already committed bid into a
        // visible HTTP 500 and tempt the dealer to submit the same bid again.
        try {
            this.auctionGateway.broadcastBid(lockedAuction.id, {
                bidId: bid.id,
                auctionId: lockedAuction.id,
                listingId: bid.listingId,
                amount: Number(bid.amount),
                bidderInitials: initials,
                bidderId: businessBidderId,
                timestamp: bid.timestamp.toISOString(),
                newEndTime: newEndTime?.toISOString(),
                buyItNowCancelled: Boolean(pendingBuyerId),
                buyItNowResponseDeadline,
            });
        } catch (error) {
            this.logger.warn(
                `Bid ${bid.id} committed for auction ${lockedAuction.id}, but realtime broadcast failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        return bid;
    }

    async cancelBid(bidId: string, bidderId: string): Promise<void> {
        const actor = await resolveDealerActor(this.prisma, bidderId);
        if (actor) {
            assertDealerPermission(
                actor,
                'PLACE_BID',
                'Your dealership role does not allow auction bidding.',
            );
        }
        const businessBidderId = await resolveBusinessBuyerId(this.prisma, bidderId);

        type AtomicBidCancellationRow = {
            bid_id: string;
            listing_id: string;
            bidder_id: string;
            cancelled_amount: unknown;
            bid_created_at: Date | string;
            bid_cancelled_at: Date | string | null;
            bid_deleted_at: Date | string | null;
            bid_archived_at: Date | string | null;
            listing_status: string;
            seller_id: string | null;
            listing_title: string;
            listing_year: number | null;
            listing_make: string | null;
            listing_model: string | null;
            auction_id: string | null;
            auction_status: string | null;
            auction_start_time: Date | string | null;
            auction_end_time: Date | string | null;
            reserve_price: unknown | null;
            starting_bid: unknown | null;
            before_highest_id: string | null;
            before_highest_amount: unknown | null;
            after_highest_id: string | null;
            after_highest_bidder_id: string | null;
            after_highest_amount: unknown | null;
            active_bid_count_after: number;
            decision_code:
                | 'OK'
                | 'NOT_YOURS'
                | 'PREVIOUS_RUN'
                | 'ALREADY_CANCELLED'
                | 'WINDOW_EXPIRED'
                | 'AUCTION_NOT_ACTIVE'
                | 'LISTING_NOT_ACTIVE'
                | 'ENDED';
            cancelled_bid_id: string | null;
        };

        /*
         * Cancellation shares the exact same per-listing advisory lock as bid
         * placement and reserve correction, but is executed as one PostgreSQL
         * statement. This avoids production failures caused by Prisma
         * interactive transactions on the pooled connection while preserving
         * all cancellation business rules and canonical post-cancel ranking.
         *
         * The "after highest" and active count explicitly exclude the target
         * bid. PostgreSQL data-modifying CTEs share one statement snapshot, so
         * this is deterministic even before the sibling UPDATE becomes visible
         * to a base-table rescan.
         */
        const rows = await this.prisma.$queryRaw<AtomicBidCancellationRow[]>`
            WITH seed AS MATERIALIZED (
                SELECT b."listingId" AS listing_id
                FROM "bids" b
                WHERE b.id = ${bidId}
            ),
            lock_row AS MATERIALIZED (
                SELECT pg_advisory_xact_lock(hashtextextended(s.listing_id, 0)) AS locked
                FROM seed s
            ),
            target AS MATERIALIZED (
                SELECT
                    b.id AS bid_id,
                    b."listingId" AS listing_id,
                    b."bidderId" AS bidder_id,
                    b.amount AS cancelled_amount,
                    b."createdAt" AS bid_created_at,
                    b."cancelledAt" AS bid_cancelled_at,
                    b."deletedAt" AS bid_deleted_at,
                    b."archivedAt" AS bid_archived_at,
                    l.status::text AS listing_status,
                    l."sellerId" AS seller_id,
                    l.title AS listing_title,
                    l.year AS listing_year,
                    l.make AS listing_make,
                    l.model AS listing_model,
                    a.id AS auction_id,
                    a.status::text AS auction_status,
                    a."startTime" AS auction_start_time,
                    a."endTime" AS auction_end_time,
                    a."reservePrice" AS reserve_price,
                    a."startingBid" AS starting_bid
                FROM "bids" b
                JOIN "listings" l ON l.id = b."listingId"
                LEFT JOIN "auctions" a
                    ON a."listingId" = l.id
                   AND a."deletedAt" IS NULL
                CROSS JOIN lock_row
                WHERE b.id = ${bidId}
            ),
            ranking AS MATERIALIZED (
                SELECT
                    t.*,
                    before_bid.id AS before_highest_id,
                    before_bid.amount AS before_highest_amount,
                    after_bid.id AS after_highest_id,
                    after_bid."bidderId" AS after_highest_bidder_id,
                    after_bid.amount AS after_highest_amount,
                    (
                        SELECT COUNT(*)::int
                        FROM "bids" b
                        WHERE b."listingId" = t.listing_id
                          AND b.id <> t.bid_id
                          AND b."deletedAt" IS NULL
                          AND b."cancelledAt" IS NULL
                          AND b."archivedAt" IS NULL
                    ) AS active_bid_count_after
                FROM target t
                LEFT JOIN LATERAL (
                    SELECT b.id, b.amount
                    FROM "bids" b
                    WHERE b."listingId" = t.listing_id
                      AND b."deletedAt" IS NULL
                      AND b."cancelledAt" IS NULL
                      AND b."archivedAt" IS NULL
                    ORDER BY b.amount DESC, b."timestamp" DESC
                    LIMIT 1
                ) before_bid ON TRUE
                LEFT JOIN LATERAL (
                    SELECT b.id, b."bidderId", b.amount
                    FROM "bids" b
                    WHERE b."listingId" = t.listing_id
                      AND b.id <> t.bid_id
                      AND b."deletedAt" IS NULL
                      AND b."cancelledAt" IS NULL
                      AND b."archivedAt" IS NULL
                    ORDER BY b.amount DESC, b."timestamp" DESC
                    LIMIT 1
                ) after_bid ON TRUE
            ),
            decision AS MATERIALIZED (
                SELECT
                    r.*,
                    CASE
                        WHEN r.bidder_id <> ${businessBidderId} THEN 'NOT_YOURS'
                        WHEN r.bid_archived_at IS NOT NULL THEN 'PREVIOUS_RUN'
                        WHEN r.bid_cancelled_at IS NOT NULL OR r.bid_deleted_at IS NOT NULL THEN 'ALREADY_CANCELLED'
                        WHEN (NOW() AT TIME ZONE 'UTC') > r.bid_created_at + INTERVAL '24 hours' THEN 'WINDOW_EXPIRED'
                        WHEN r.auction_id IS NULL OR r.auction_status <> 'ACTIVE' THEN 'AUCTION_NOT_ACTIVE'
                        WHEN r.listing_status <> 'ACTIVE' THEN 'LISTING_NOT_ACTIVE'
                        WHEN r.auction_end_time IS NULL OR (NOW() AT TIME ZONE 'UTC') >= r.auction_end_time THEN 'ENDED'
                        ELSE 'OK'
                    END AS decision_code
                FROM ranking r
            ),
            updated AS (
                UPDATE "bids" b
                SET
                    "cancelledAt" = (NOW() AT TIME ZONE 'UTC'),
                    "updatedAt" = (NOW() AT TIME ZONE 'UTC')
                FROM decision d
                WHERE b.id = d.bid_id
                  AND d.decision_code = 'OK'
                RETURNING b.id AS cancelled_bid_id
            )
            SELECT
                d.*,
                (SELECT cancelled_bid_id FROM updated LIMIT 1) AS cancelled_bid_id
            FROM decision d
        `;

        const row = rows[0];
        if (!row) {
            throw new ForbiddenException('Not your bid');
        }

        switch (row.decision_code) {
            case 'NOT_YOURS':
                throw new ForbiddenException('Not your bid');
            case 'PREVIOUS_RUN':
                throw new BadRequestException('This bid belongs to a previous auction and can no longer be cancelled');
            case 'ALREADY_CANCELLED':
                throw new BadRequestException('Bid already cancelled');
            case 'WINDOW_EXPIRED':
                throw new BadRequestException('Cancel window has expired (24 hours)');
            case 'AUCTION_NOT_ACTIVE':
                throw new BadRequestException('Cannot cancel a bid on an auction that is not ACTIVE');
            case 'LISTING_NOT_ACTIVE':
                throw new BadRequestException('Cannot cancel a bid after the auction vehicle is no longer active');
            case 'ENDED':
                throw new BadRequestException(
                    'This auction has ended. Bids can no longer be cancelled while the result is being finalised',
                );
            case 'OK':
                break;
        }

        if (!row.cancelled_bid_id || !row.auction_id || row.reserve_price == null || row.starting_bid == null) {
            throw new ConflictException(
                'The bid could not be cancelled. Refresh the auction and try again.',
            );
        }

        const reservePrice = Number(row.reserve_price);
        const startingBid = Number(row.starting_bid);
        const highestActiveBid = row.after_highest_amount == null
            ? null
            : Number(row.after_highest_amount);
        const activeBidCount = Number(row.active_bid_count_after || 0);
        const reserveMet = highestActiveBid !== null && highestActiveBid >= reservePrice;
        const firstOfferFloor = activeBidCount === 0
            ? calculateFirstOfferFloor(startingBid, reservePrice)
            : null;
        const cancelledWasHighest = row.before_highest_id === row.bid_id;
        const reserveWasMet = row.before_highest_amount != null
            ? Number(row.before_highest_amount) >= reservePrice
            : false;
        const afterHighest = row.after_highest_id
            ? {
                id: row.after_highest_id,
                bidderId: row.after_highest_bidder_id,
                amount: highestActiveBid,
            }
            : null;
        const listing = {
            id: row.listing_id,
            sellerId: row.seller_id,
            title: row.listing_title,
            year: row.listing_year,
            make: row.listing_make,
            model: row.listing_model,
            auction: {
                id: row.auction_id,
                startTime: row.auction_start_time,
                reservePrice,
                startingBid,
            },
        };

        this.trackAuctionEvent('auction_bid_cancelled', {
            auction_id: listing.auction.id,
            auction_run_key: this.auctionRunKey(listing.auction),
            listing_id: listing.id,
            cancelled_bid_id: bidId,
            cancelled_amount: Number(row.cancelled_amount),
            cancelled_was_highest: cancelledWasHighest,
            reserve_was_met: reserveWasMet,
            reserve_met_after: reserveMet,
            active_bid_count_after: activeBidCount,
            highest_active_bid_after: highestActiveBid,
            highest_active_bid_id_after: afterHighest?.id ?? null,
            first_offer_floor_after: firstOfferFloor,
            starting_bid: startingBid,
            reserve_price: reservePrice,
        }, businessBidderId);

        // A realtime outage must never turn a committed cancellation into a
        // false HTTP 500. Every client already canonical-resyncs on reconnect.
        try {
            this.auctionGateway.broadcastBidCancelled(listing.auction.id, {
                auctionId: listing.auction.id,
                bidId,
                highestActiveBid,
                highestActiveBidId: afterHighest?.id ?? null,
                highestActiveBidderId: afterHighest?.bidderId ?? null,
                activeBidCount,
                reserveMet,
                firstOfferFloor,
            });
        } catch (error) {
            this.logger.warn(
                `Bid ${bidId} was cancelled for auction ${listing.auction.id}, but realtime cancellation broadcast failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        if (cancelledWasHighest && listing.sellerId) {
            const vehicle = [
                listing.year,
                listing.make,
                listing.model,
            ].filter(Boolean).join(' ') || listing.title;

            if (activeBidCount === 0) {
                this.notificationsService.create({
                    userId: listing.sellerId,
                    type: 'AUCTION_UPDATED',
                    title: 'Highest auction bid cancelled',
                    message: `The highest bid on ${vehicle} was cancelled. There are now no active dealer bids. First offers can be made from £${Number(firstOfferFloor).toLocaleString('en-GB')}.`,
                    entityType: 'AUCTION',
                    entityId: listing.auction.id,
                    actionType: 'BID_CANCELLED',
                    link: `/auctions/live/${listing.auction.id}`,
                    data: {
                        cancelledBidId: bidId,
                        activeBidCount: 0,
                        highestActiveBid: null,
                        firstOfferFloor,
                        reserveMet: false,
                    },
                }).catch(() => {});
            } else if (reserveWasMet && !reserveMet) {
                this.notificationsService.create({
                    userId: listing.sellerId,
                    type: 'AUCTION_UPDATED',
                    title: 'Reserve is no longer met',
                    message: `The previous highest bid on ${vehicle} was cancelled. The current highest active bid is now £${Number(highestActiveBid).toLocaleString('en-GB')}, below your reserve of £${reservePrice.toLocaleString('en-GB')}.`,
                    entityType: 'AUCTION',
                    entityId: listing.auction.id,
                    actionType: 'BID_CANCELLED',
                    link: afterHighest?.id
                        ? `/auctions/live/${listing.auction.id}?sellerOffer=${afterHighest.id}`
                        : `/auctions/live/${listing.auction.id}`,
                    data: {
                        cancelledBidId: bidId,
                        activeBidCount,
                        highestActiveBid,
                        highestActiveBidId: afterHighest?.id ?? null,
                        reserveMet: false,
                    },
                }).catch(() => {});
            } else if (!reserveMet && afterHighest) {
                this.notificationsService.create({
                    userId: listing.sellerId,
                    type: 'AUCTION_UPDATED',
                    title: 'Highest auction offer changed',
                    message: `The previous highest offer on ${vehicle} was cancelled. The current highest active offer is now £${Number(highestActiveBid).toLocaleString('en-GB')} against your £${reservePrice.toLocaleString('en-GB')} reserve. You can accept the current offer or keep the auction running.`,
                    entityType: 'AUCTION',
                    entityId: listing.auction.id,
                    actionType: 'ACCEPT_OR_WAIT',
                    link: `/auctions/live/${listing.auction.id}?sellerOffer=${afterHighest.id}`,
                    data: {
                        cancelledBidId: bidId,
                        activeBidCount,
                        highestActiveBid,
                        highestActiveBidId: afterHighest.id,
                        reserveMet: false,
                    },
                }).catch(() => {});
            }
        }
    }

    async findMyActiveAuctionPositions(bidderId: string): Promise<any[]> {
        const businessBidderId = await resolveBusinessBuyerId(this.prisma, bidderId);
        const myBids = await this.prisma.bid.findMany({
            where: {
                bidderId: businessBidderId,
                deletedAt: null,
                cancelledAt: null,
                archivedAt: null,
                listing: {
                    auction: { status: 'ACTIVE' },
                },
            },
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
                        mileage: true,
                        sellerId: true,
                        auction: {
                            select: {
                                id: true,
                                status: true,
                                endTime: true,
                                minIncrement: true,
                                startingBid: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (myBids.length === 0) return [];

        // A trader can bid several times on the same vehicle. The dashboard
        // needs one position per auction, so keep the trader's highest active
        // bid for each listing rather than rendering duplicate bid-history rows.
        const myHighestByListing = new Map<string, any>();
        for (const bid of myBids) {
            const existing = myHighestByListing.get(bid.listingId);
            if (!existing || Number(bid.amount) > Number(existing.amount)) {
                myHighestByListing.set(bid.listingId, bid);
            }
        }

        const listingIds = [...myHighestByListing.keys()];
        const allLiveBids = await this.prisma.bid.findMany({
            where: {
                listingId: { in: listingIds },
                deletedAt: null,
                cancelledAt: null,
                archivedAt: null,
            },
            select: {
                id: true,
                listingId: true,
                bidderId: true,
                amount: true,
                createdAt: true,
            },
            orderBy: { amount: 'desc' },
        });

        const highestByListing = new Map<string, any>();
        const bidCountByListing = new Map<string, number>();
        for (const bid of allLiveBids) {
            bidCountByListing.set(
                bid.listingId,
                (bidCountByListing.get(bid.listingId) ?? 0) + 1,
            );
            if (!highestByListing.has(bid.listingId)) {
                highestByListing.set(bid.listingId, bid);
            }
        }

        return [...myHighestByListing.values()]
            .map((myBid) => {
                const auction = myBid.listing.auction;
                const highest = highestByListing.get(myBid.listingId);
                const currentHighestBid = highest ? Number(highest.amount) : Number(myBid.amount);
                const minIncrement = Number(auction?.minIncrement ?? 0);
                const createdAt = myBid.createdAt instanceof Date
                    ? myBid.createdAt
                    : new Date(myBid.createdAt);
                const cancelDeadline = new Date(createdAt.getTime() + BID_CANCEL_WINDOW_MS);

                return {
                    listingId: myBid.listingId,
                    auctionId: auction?.id,
                    listing: myBid.listing,
                    myHighestBid: Number(myBid.amount),
                    myBidId: myBid.id,
                    myBidCreatedAt: createdAt,
                    currentHighestBid,
                    isLeading: highest?.bidderId === businessBidderId,
                    nextMinimumBid: currentHighestBid + minIncrement,
                    bidCount: bidCountByListing.get(myBid.listingId) ?? 0,
                    canCancelCurrentBid: Date.now() < cancelDeadline.getTime(),
                    cancelDeadline,
                    endTime: auction?.endTime,
                };
            })
            .sort((a, b) => {
                const aEnd = a.endTime ? new Date(a.endTime).getTime() : Number.MAX_SAFE_INTEGER;
                const bEnd = b.endTime ? new Date(b.endTime).getTime() : Number.MAX_SAFE_INTEGER;
                return aEnd - bEnd;
            });
    }

    async findMyBids(bidderId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
        const businessBidderId = await resolveBusinessBuyerId(this.prisma, bidderId);
        const skip = (page - 1) * limit;

        const [bids, total] = await Promise.all([
            this.prisma.bid.findMany({
                where: { bidderId: businessBidderId, deletedAt: null, cancelledAt: null },
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
                            auction: {
                                select: {
                                    id: true,
                                    status: true,
                                    endTime: true,
                                    winnerId: true,
                                    winningBidAmount: true,
                                    wonAt: true,
                                    buyerFeePaid: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.bid.count({ where: { bidderId: businessBidderId, deletedAt: null, cancelledAt: null } }),
        ]);

        const listingIds = [...new Set(bids.map(b => b.listingId))];
        const topBids = await this.prisma.bid.findMany({
            where: { listingId: { in: listingIds }, deletedAt: null, cancelledAt: null, archivedAt: null },
            orderBy: { amount: 'desc' },
            distinct: ['listingId'],
            select: { id: true, listingId: true },
        });
        const winningMap = new Map(topBids.map(b => [b.listingId, b.id]));
        const enrichedBids = bids.map(bid => ({
            ...bid,
            isArchived: Boolean(bid.archivedAt),
            isWinning: !bid.archivedAt && winningMap.get(bid.listingId) === bid.id,
        }));

        return { data: enrichedBids, total };
    }

    async findByListing(listingId: string): Promise<Bid[]> {
        return this.prisma.bid.findMany({
            where: { listingId, deletedAt: null, cancelledAt: null, archivedAt: null },
            include: {
                bidder: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
            orderBy: { amount: 'desc' },
        });
    }

    async getBuyerStats(userId: string): Promise<{
        activeBids: number;
        wonAuctions: number;
        watchlistCount: number;
        totalSpent: number;
    }> {
        const businessBuyerId = await resolveBusinessBuyerId(this.prisma, userId);
        const [activeBids, wonAuctions, watchlistCount, totalSpentAgg] = await Promise.all([
            // Bids placed on currently ACTIVE auctions only
            this.prisma.bid.count({
                where: {
                    bidderId: businessBuyerId,
                    deletedAt: null,
                    cancelledAt: null,
                    archivedAt: null,
                    listing: { auction: { status: 'ACTIVE' } },
                },
            }),
            this.prisma.auction.count({
                where: { winnerId: businessBuyerId, status: 'ENDED' },
            }),
            this.prisma.watchlistItem.count({
                where: { userId },
            }),
            // Sum of soldPrice for all purchases where this user is the buyer
            this.prisma.sale.aggregate({
                where: { buyerId: businessBuyerId },
                _sum: { soldPrice: true },
            }),
        ]);

        return {
            activeBids,
            wonAuctions,
            watchlistCount,
            totalSpent: Number(totalSpentAgg._sum.soldPrice ?? 0),
        };
    }
}
