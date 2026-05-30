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
import { Auction } from '@prisma/client';

const AUCTION_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
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

        if (startTime.getTime() < now.getTime() + 30 * 60 * 1000) {
            throw new BadRequestException('Start time must be at least 30 minutes in the future');
        }

        // Compute endTime server-side — always startTime + 6 hours
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
                        bids: {
                            where: { deletedAt: null },
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
                            where: { deletedAt: null },
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

        return auction;
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
                                where: { deletedAt: null },
                                orderBy: { amount: 'desc' },
                                take: 1,
                                select: { amount: true },
                            },
                            _count: { select: { bids: true } },
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

    async cancel(id: string, userId: string): Promise<Auction> {
        const auction = await this.findOne(id);

        if (auction.listing.sellerId !== userId) {
            throw new ForbiddenException('You do not own this auction');
        }

        if (auction.status !== 'SCHEDULED') {
            throw new BadRequestException('Only SCHEDULED auctions can be cancelled');
        }

        return this.prisma.auction.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });
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
                            where: { deletedAt: null },
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
            // No winner — reserve not met
            await this.prisma.auction.update({
                where: { id: auctionId },
                data: { status: 'ENDED' },
            });

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
                userId:     winnerId,
                type:       'AUCTION_WON',
                title:      'You won the auction!',
                message:    `You won the auction for ${vehicle} with a bid of £${winningAmount.toLocaleString()}. Contact the seller to arrange collection.`,
                entityType: 'AUCTION',
                entityId:   auction.id,
                link:       `/auction/${auction.id}`,
            });

            // Notify seller — persisted + push delivered
            if (listing.sellerId) {
                await this.notificationsService.create({
                    userId:     listing.sellerId,
                    type:       'AUCTION_ENDED',
                    title:      'Your auction has ended',
                    message:    `Your auction for ${vehicle} has ended. Winning bid: £${winningAmount.toLocaleString()}.`,
                    entityType: 'AUCTION',
                    entityId:   auction.id,
                    link:       `/auction/${auction.id}`,
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
            if (buyer?.email) {
                this.emailService.sendAuctionWonEmail(buyer.email, buyer.firstName || 'there', vehicle || listing.title, winningAmount, auction.id).catch(console.error);
            }
            if (seller?.email) {
                this.emailService.sendAuctionEndedSellerEmail(seller.email, seller.firstName || 'there', vehicle || listing.title, winningAmount, auction.id).catch(console.error);
            }
        } else {
            // No winner — notify seller only, persisted + push delivered
            if (listing.sellerId) {
                await this.notificationsService.create({
                    userId:     listing.sellerId,
                    type:       'AUCTION_ENDED',
                    title:      'Auction ended — reserve not met',
                    message:    `Your auction for ${vehicle} ended without meeting the reserve price. You can relist or adjust the reserve.`,
                    entityType: 'AUCTION',
                    entityId:   auction.id,
                    link:       `/auction/${auction.id}`,
                });

                const seller = await this.prisma.user.findUnique({ where: { id: listing.sellerId }, select: { email: true, firstName: true } });
                if (seller?.email) {
                    this.emailService.sendAuctionReserveNotMetEmail(seller.email, seller.firstName || 'there', vehicle || listing.title, auction.id).catch(console.error);
                }
            }
        }
    }
}
