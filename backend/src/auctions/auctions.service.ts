import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    forwardRef,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { AuctionGateway, AuctionEndPayload } from './auction.gateway';
import { EmailService } from '../email/email.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { UpdateAuctionDigestDto } from './dto/update-auction-digest.dto';
import { Auction } from '@prisma/client';

const AUCTION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const ANTI_SNIPE_MINUTES = 3;

@Injectable()
export class AuctionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsGateway: NotificationsGateway,
        private readonly notificationsService: NotificationsService,
        @Inject(forwardRef(() => AuctionGateway))
        private readonly auctionGateway: AuctionGateway,
        private readonly emailService: EmailService,
    ) { }

    async create(createAuctionDto: CreateAuctionDto, userId: string): Promise<Auction> {
        const now = new Date();
        const startTime = new Date(createAuctionDto.startTime);

        // Allow immediate start (startTime in the past or very near future is treated as 'now')
        // Only reject if startTime is more than 1 minute in the past (clock skew tolerance)
        if (startTime.getTime() < now.getTime() - 60 * 1000) {
            throw new BadRequestException('Start time cannot be in the past');
        }

        // Compute endTime server-side — always startTime + 24 hours
        const endTime = new Date(startTime.getTime() + AUCTION_DURATION_MS);

        const listing = await this.prisma.listing.findUnique({
            where: { id: createAuctionDto.listingId },
        });

        if (!listing || listing.deletedAt) {
            throw new NotFoundException('Listing not found');
        }

        if (listing.sellerId !== userId) {
            throw new ForbiddenException('You do not own this listing');
        }

        if (listing.status === 'SOLD') {
            throw new BadRequestException('This listing has already been sold');
        }

        // The opening/starting bid must be meaningfully below the asking price
        // (at least 30% lower) so the auction has room to actually run — otherwise
        // the very first bid could already meet or exceed retail.
        const maxStartingBid = Number(listing.price) * 0.7;
        if (createAuctionDto.startingBid > maxStartingBid) {
            throw new BadRequestException(
                `Starting bid must be at least 30% below the asking price of £${Number(listing.price).toLocaleString()} (max £${maxStartingBid.toLocaleString(undefined, { maximumFractionDigits: 2 })})`,
            );
        }

        const existing = await this.prisma.auction.findUnique({
            where: { listingId: createAuctionDto.listingId },
        });

        // Block only if a live (SCHEDULED or ACTIVE) auction already exists
        if (existing && !existing.deletedAt && existing.status !== 'ENDED' && existing.status !== 'CANCELLED') {
            throw new BadRequestException('An auction already exists for this listing');
        }

        // Auto-convert listing to AUCTION type so bids validation passes
        if (listing.type !== 'AUCTION') {
            await this.prisma.listing.update({
                where: { id: createAuctionDto.listingId },
                data: { type: 'AUCTION' },
            });
        }

        // Re-use the existing row (listingId is @unique — can't insert a second row)
        if (existing) {
            return this.prisma.auction.update({
                where: { id: existing.id },
                data: {
                    startTime,
                    endTime,
                    reservePrice: createAuctionDto.reservePrice,
                    startingBid: createAuctionDto.startingBid,
                    minIncrement: createAuctionDto.minIncrement,
                    buyItNowPrice: createAuctionDto.buyItNowPrice ?? null,
                    status: 'SCHEDULED',
                    deletedAt: null,
                    winnerId: null,
                    winningBidAmount: null,
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
        }

        return this.prisma.auction.create({
            data: {
                listingId: createAuctionDto.listingId,
                startTime,
                endTime,
                reservePrice: createAuctionDto.reservePrice,
                startingBid: createAuctionDto.startingBid,
                minIncrement: createAuctionDto.minIncrement,
                buyItNowPrice: createAuctionDto.buyItNowPrice ?? null,
                status: 'SCHEDULED',
            },
        });
    }

    async findAllActive(): Promise<any[]> {
        return this.prisma.auction.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
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
                            where: { deletedAt: null, cancelledAt: null },
                            orderBy: { amount: 'desc' },
                            take: 1,
                            select: { amount: true },
                        },
                        _count: { select: { bids: true } },
                    },
                },
            },
            orderBy: { endTime: 'asc' },
        });
    }

    async findAllScheduled(page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.auction.findMany({
                where: { status: 'SCHEDULED', deletedAt: null },
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
                            _count: { select: { bids: true } },
                        },
                    },
                },
                orderBy: { startTime: 'asc' },
                skip,
                take: limit,
            }),
            this.prisma.auction.count({ where: { status: 'SCHEDULED', deletedAt: null } }),
        ]);
        return { data, total };
    }

    async findOne(id: string): Promise<any> {
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
                                dealerProfile: { select: { companyName: true, logo: true } },
                            },
                        },
                        bids: {
                            where: { deletedAt: null, cancelledAt: null },
                            orderBy: { amount: 'desc' },
                            take: 50,
                            include: {
                                bidder: { select: { id: true, firstName: true, lastName: true } },
                            },
                        },
                    },
                },
                winner: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        if (!auction || auction.deletedAt) {
            throw new NotFoundException(`Auction not found`);
        }

        return this.clearExpiredBin(auction);
    }

    async findMyAuctions(userId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
        const skip = (page - 1) * limit;
        const where = { deletedAt: null, listing: { sellerId: userId } };
        const [data, total] = await Promise.all([
            this.prisma.auction.findMany({
                where,
                include: {
                    listing: {
                        include: {
                            bids: {
                                where: { deletedAt: null, cancelledAt: null },
                                orderBy: { amount: 'desc' },
                                take: 1,
                                select: { amount: true },
                            },
                            _count: { select: { bids: true } },
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

    // Auctions the current user WON as a bidder — distinct from findMyAuctions
    // above, which is scoped to auctions the user SOLD. Mobile's Auctions tab
    // previously only ever showed the seller-side list; won-auction purchases
    // were only discoverable via the separate, generic Purchases screen (Sale
    // records, no auction-specific fields). Added for mobile-production-
    // readiness-plan.md F43. Includes `listing.seller` (unlike findMyAuctions,
    // which has no reason to — the buyer needs to know who to contact).
    async findWonAuctions(userId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
        const skip = (page - 1) * limit;
        const where = { deletedAt: null, winnerId: userId };
        const [data, total] = await Promise.all([
            this.prisma.auction.findMany({
                where,
                include: {
                    listing: {
                        include: {
                            bids: {
                                where: { deletedAt: null, cancelledAt: null },
                                orderBy: { amount: 'desc' },
                                take: 1,
                                select: { amount: true },
                            },
                            _count: { select: { bids: true } },
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
                            hpiReport: { select: { isClear: true } },
                        },
                    },
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.auction.count({ where }),
        ]);
        return { data, total };
    }

    async update(id: string, updateAuctionDto: UpdateAuctionDto, userId: string): Promise<Auction> {
        const auction = await this.findOne(id);

        if (auction.listing.sellerId !== userId) {
            throw new ForbiddenException('You do not own this auction');
        }

        if (auction.status !== 'SCHEDULED') {
            throw new BadRequestException('Only SCHEDULED auctions can be updated');
        }

        const startTime = updateAuctionDto.startTime
            ? new Date(updateAuctionDto.startTime)
            : auction.startTime;

        const endTime = new Date(startTime.getTime() + AUCTION_DURATION_MS);

        return this.prisma.auction.update({
            where: { id },
            data: {
                startTime,
                endTime,
                ...(updateAuctionDto.reservePrice !== undefined && { reservePrice: updateAuctionDto.reservePrice }),
                ...(updateAuctionDto.startingBid !== undefined && { startingBid: updateAuctionDto.startingBid }),
                ...(updateAuctionDto.minIncrement !== undefined && { minIncrement: updateAuctionDto.minIncrement }),
            },
        });
    }

    // Digest — seller-authored custom tags/batch labels and self-rating for their own
    // auction listing. Editable any time before the auction ends, unlike update() which
    // is restricted to SCHEDULED auctions since it recalculates timing/pricing.
    async updateDigest(id: string, dto: UpdateAuctionDigestDto, userId: string): Promise<Auction> {
        const auction = await this.findOne(id);

        if (auction.listing.sellerId !== userId) {
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
        const auction = await this.findOne(id);

        if (auction.listing.sellerId !== userId) {
            throw new ForbiddenException('You do not own this auction');
        }

        if (auction.status !== 'SCHEDULED') {
            throw new BadRequestException('Only SCHEDULED auctions can be cancelled');
        }

        const cancelled = await this.prisma.auction.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });

        // Clear linkedListingId on both the AUCTION listing and the linked CLASSIFIED listing
        // so the seller can re-auction or proceed with retail only
        const classifiedId = (auction.listing as any).linkedListingId as string | null;
        await this.prisma.listing.update({
            where: { id: auction.listingId },
            data: { linkedListingId: null } as any,
        });
        if (classifiedId) {
            await this.prisma.listing.update({
                where: { id: classifiedId },
                data: { linkedListingId: null } as any,
            });
        }

        return cancelled;
    }

    async sellerClose(auctionId: string, userId: string): Promise<void> {
        const auction = await this.findOne(auctionId);
        if (auction.listing.sellerId !== userId) {
            throw new ForbiddenException('You do not own this auction');
        }
        if (auction.status !== 'ACTIVE') {
            throw new BadRequestException('Only ACTIVE auctions can be closed early');
        }
        await this.closeAuction(auctionId);
    }

    async acceptBid(auctionId: string, bidId: string, sellerId: string): Promise<void> {
        const auction = await this.findOne(auctionId);
        if (auction.listing.sellerId !== sellerId) {
            throw new ForbiddenException('You do not own this auction');
        }
        if (auction.status !== 'ACTIVE') {
            throw new BadRequestException('Only ACTIVE auctions can have a bid accepted');
        }

        const bid = await this.prisma.bid.findUnique({ where: { id: bidId } });
        if (!bid || bid.listingId !== auction.listingId || bid.deletedAt || bid.cancelledAt) {
            throw new NotFoundException('Bid not found in this auction');
        }

        const winningAmount = Number(bid.amount);
        const winnerId = bid.bidderId;
        const linkedListingId = (auction.listing as any).linkedListingId as string | null;

        await this.prisma.$transaction([
            this.prisma.auction.update({
                where: { id: auctionId },
                data: { status: 'ENDED', winnerId, winningBidAmount: bid.amount },
            }),
            this.prisma.listing.update({
                where: { id: auction.listingId },
                data: { status: 'SOLD' },
            }),
            // Auto-close the linked retail listing if this auction listing had one
            ...(linkedListingId ? [
                this.prisma.listing.update({
                    where: { id: linkedListingId },
                    data: { status: 'SOLD' },
                }),
            ] : []),
            this.prisma.sale.create({
                data: { listingId: auction.listingId, sellerId, buyerId: winnerId, soldPrice: bid.amount },
            }),
            this.prisma.sellerProfile.upsert({
                where: { userId: sellerId },
                create: { userId: sellerId, totalSales: 1 },
                update: { totalSales: { increment: 1 } },
            }),
        ]);

        const endPayload: AuctionEndPayload = { auctionId, winnerId, winningBidAmount: winningAmount, reserveMet: true };
        this.auctionGateway.broadcastAuctionEnd(auctionId, endPayload);
        await this.notifyAuctionEnd(auction, winnerId, winningAmount, true);
    }

    async remove(id: string, userId: string): Promise<Auction> {
        const auction = await this.findOne(id);

        if (auction.listing.sellerId !== userId) {
            throw new ForbiddenException('You do not own this auction');
        }

        if (auction.status !== 'SCHEDULED') {
            throw new BadRequestException('Only SCHEDULED auctions can be deleted');
        }

        return this.prisma.auction.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async submitHandoverProof(auctionId: string, userId: string, proofUrl: string): Promise<any> {
        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            include: { listing: { select: { sellerId: true, title: true } } },
        });

        if (!auction || auction.deletedAt) {
            throw new NotFoundException('Auction not found');
        }
        if (auction.listing.sellerId !== userId) {
            throw new ForbiddenException('You do not own this auction');
        }
        if (auction.status !== 'ENDED') {
            throw new BadRequestException('Handover proof can only be submitted for ended auctions');
        }
        if (!auction.winnerId) {
            throw new BadRequestException('This auction has no winner');
        }
        if (auction.handoverProofUrl) {
            throw new BadRequestException('Handover proof has already been submitted');
        }

        const updated = await this.prisma.auction.update({
            where: { id: auctionId },
            data: {
                handoverProofUrl: proofUrl,
                handoverSubmittedAt: new Date(),
            },
        });

        // Notify seller that proof is under review
        this.notificationsGateway.sendNotification(userId, {
            type: 'AUCTION_ENDED',
            title: 'Handover proof received',
            message: `Your proof for "${auction.listing.title}" is under review. Your £100 seller bonus will be released once verified.`,
            entityType: 'AUCTION',
            entityId: auctionId,
            link: `/dashboard/seller/auctions`,
        });

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

    // Called by AuctionLifecycleService when endTime has passed
    async closeAuction(auctionId: string): Promise<void> {
        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            include: {
                listing: {
                    include: {
                        bids: {
                            where: { deletedAt: null, cancelledAt: null },
                            orderBy: { amount: 'desc' },
                            take: 1,
                            include: { bidder: { select: { id: true, firstName: true } } },
                        },
                    },
                },
            },
        });

        if (!auction || auction.status !== 'ACTIVE') return;

        const topBid = auction.listing.bids[0];
        const reserveMet = topBid && Number(topBid.amount) >= Number(auction.reservePrice);

        if (reserveMet && topBid) {
            // Winner found
            const sellerId = auction.listing.sellerId;
            const linkedListingId = (auction.listing as any).linkedListingId as string | null;
            await this.prisma.$transaction([
                this.prisma.auction.update({
                    where: { id: auctionId },
                    data: {
                        status: 'ENDED',
                        winnerId: topBid.bidderId,
                        winningBidAmount: topBid.amount,
                    },
                }),
                this.prisma.listing.update({
                    where: { id: auction.listingId },
                    data: { status: 'SOLD' },
                }),
                // Auto-close the linked retail listing if this auction listing had one
                ...(linkedListingId ? [
                    this.prisma.listing.update({
                        where: { id: linkedListingId },
                        data: { status: 'SOLD' },
                    }),
                ] : []),
                // Create Sale record so revenue appears in earnings, stats, and buyer history
                ...(sellerId ? [
                    this.prisma.sale.create({
                        data: {
                            listingId: auction.listingId,
                            sellerId,
                            buyerId: topBid.bidderId,
                            soldPrice: topBid.amount,
                        },
                    }),
                    this.prisma.sellerProfile.upsert({
                        where: { userId: sellerId },
                        create: { userId: sellerId, totalSales: 1 },
                        update: { totalSales: { increment: 1 } },
                    }),
                ] : []),
            ]);

            const endPayload: AuctionEndPayload = {
                auctionId,
                winnerId: topBid.bidderId,
                winningBidAmount: Number(topBid.amount),
                reserveMet: true,
            };
            this.auctionGateway.broadcastAuctionEnd(auctionId, endPayload);
            await this.notifyAuctionEnd(auction, topBid.bidderId, Number(topBid.amount), true);
        } else {
            // No winner — reserve not met.
            // Move listing to DRAFT (seller's inventory). It will NOT appear in
            // public retail search until the seller explicitly relists it from
            // their inventory dashboard.
            const classifiedId = (auction.listing as any).linkedListingId as string | null;
            await this.prisma.$transaction([
                this.prisma.auction.update({
                    where: { id: auctionId },
                    data: { status: 'ENDED' },
                }),
                this.prisma.listing.update({
                    where: { id: auction.listingId },
                    data: {
                        status: 'DRAFT',
                        type: 'CLASSIFIED', // Reset type so seller can list it for retail
                        linkedListingId: null, // Clear link so seller can re-auction
                    } as any,
                }),
                // If there was a paired CLASSIFIED retail listing, clear its link too
                // so the seller can re-auction the same vehicle if they want
                ...(classifiedId ? [
                    this.prisma.listing.update({
                        where: { id: classifiedId },
                        data: { linkedListingId: null } as any,
                    }),
                ] : []),
            ]);

            const endPayload: AuctionEndPayload = {
                auctionId,
                winnerId: null,
                winningBidAmount: null,
                reserveMet: false,
            };
            this.auctionGateway.broadcastAuctionEnd(auctionId, endPayload);
            await this.notifyAuctionEnd(auction, null, null, false);
        }
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
                message: `You won the auction for ${vehicle} with a bid of £${winningAmount.toLocaleString()}. Contact the seller to arrange collection.`,
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
                    message: `Your auction for ${vehicle} has ended. Winning bid: £${winningAmount.toLocaleString()}.`,
                    entityType: 'AUCTION',
                    entityId: auction.id,
                    link: `/dashboard/seller/auctions`,
                });
            }

            // Auto-create chat room between winner and seller
            if (listing.sellerId && listing.sellerId !== winnerId) {
                await this.prisma.chatRoom.upsert({
                    where: {
                        initiatorId_participantId: {
                            initiatorId: winnerId,
                            participantId: listing.sellerId,
                        },
                    },
                    create: {
                        initiatorId: winnerId,
                        participantId: listing.sellerId,
                        listingId: auction.listingId,
                    },
                    update: { listingId: auction.listingId },
                });
            }

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
            // No winner — notify seller only, persisted + push delivered
            if (listing.sellerId) {
                await this.notificationsService.create({
                    userId: listing.sellerId,
                    type: 'AUCTION_ENDED',
                    title: 'Auction ended — reserve not met',
                    message: `Your auction for ${vehicle} ended without meeting the reserve price. You can relist or adjust the reserve.`,
                    entityType: 'AUCTION',
                    entityId: auction.id,
                    link: `/dashboard/seller/auctions`,
                });

                const seller = await this.prisma.user.findUnique({ where: { id: listing.sellerId }, select: { email: true, firstName: true } });
                if (seller?.email) {
                    this.emailService.sendAuctionReserveNotMetEmail(seller.email, seller.firstName || 'there', vehicle || listing.title, auction.id).catch(console.error);
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
        const auction = await this.findOne(auctionId);

        if (auction.status !== 'ACTIVE') {
            throw new BadRequestException('Auction is not ACTIVE');
        }
        if (!auction.buyItNowPrice) {
            throw new BadRequestException('No Buy It Now price set on this auction');
        }

        // Check reserve not already met by existing top bid
        const topBid = await this.prisma.bid.findFirst({
            where: { listingId: auction.listingId, deletedAt: null, cancelledAt: null },
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
        const auction = await this.findOne(auctionId);

        if (auction.listing.sellerId !== sellerId) {
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
                    sellerId,
                    buyerId: pendingBuyerId,
                    soldPrice: binPrice,
                },
            }),
            this.prisma.sellerProfile.upsert({
                where: { userId: sellerId },
                create: { userId: sellerId, totalSales: 1 },
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
        const auction = await this.findOne(auctionId);

        if (auction.listing.sellerId !== sellerId) {
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
