import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { Auction } from '@prisma/client';

@Injectable()
export class AuctionsService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create a new auction for a listing
     * Ensures listing exists, belongs to user, and is of type AUCTION
     */
    async create(createAuctionDto: CreateAuctionDto, userId: string): Promise<Auction> {
        // Validate dates
        const now = new Date();
        if (new Date(createAuctionDto.endTime) <= new Date(createAuctionDto.startTime)) {
            throw new BadRequestException('End time must be after start time');
        }
        if (new Date(createAuctionDto.endTime) <= now) {
            throw new BadRequestException('End time must be in the future');
        }

        // Fetch listing to verify ownership and type
        const listing = await this.prisma.listing.findUnique({
            where: { id: createAuctionDto.listingId },
        });

        if (!listing) {
            throw new NotFoundException('Listing not found');
        }

        if (listing.sellerId && listing.sellerId !== userId) {
            throw new ForbiddenException('You do not own this listing');
        }

        if (listing.type !== 'AUCTION') {
            throw new BadRequestException('Listing is not of type AUCTION');
        }

        // Check if auction already exists for this listing
        const existing = await this.prisma.auction.findUnique({
            where: { listingId: createAuctionDto.listingId },
        });

        if (existing) {
            throw new BadRequestException('Auction already exists for this listing');
        }

        return this.prisma.auction.create({
            data: {
                ...createAuctionDto,
                listingId: createAuctionDto.listingId,
            },
        });
    }

    /**
     * Get all active auctions
     * (Auctions that have started and not ended)
     */
    async findAllActive(): Promise<Auction[]> {
        const now = new Date();
        return this.prisma.auction.findMany({
            where: {
                startTime: { lte: now },
                endTime: { gt: now },
                listing: { status: 'ACTIVE' },
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
                    },
                },
            },
            orderBy: { endTime: 'asc' }, // Ending soonest first
        });
    }

    /**
     * Get a single auction by ID
     */
    async findOne(id: string): Promise<Auction> {
        const auction = await this.prisma.auction.findUnique({
            where: { id },
            include: {
                listing: true,
            },
        });

        if (!auction) {
            throw new NotFoundException(`Auction with ID "${id}" not found`);
        }

        return auction;
    }

    /**
     * Update an auction
     * Restricted to seller
     */
    async update(id: string, updateAuctionDto: UpdateAuctionDto, userId: string): Promise<Auction> {
        const auction = await this.findOne(id);

        // Verify ownership via listing
        const listing = await this.prisma.listing.findUnique({
            where: { id: auction.listingId },
        });

        if (listing?.sellerId !== userId) {
            throw new ForbiddenException('You do not own this auction');
        }

        // Prevent updating critical fields if auction has started or has bids?
        // For simpler MVP, allows update but maybe should restrict.
        // Let's at least check dates if provided.
        if (updateAuctionDto.startTime && updateAuctionDto.endTime) {
            if (new Date(updateAuctionDto.endTime) <= new Date(updateAuctionDto.startTime)) {
                throw new BadRequestException('End time must be after start time');
            }
        }

        return this.prisma.auction.update({
            where: { id },
            data: updateAuctionDto,
        });
    }

    /**
     * Remove an auction (Force delete or soft delete?)
     * Schema has deletedAt, so we use soft delete if standard practice, 
     * but usually deleting an auction is rare. Let's support soft delete.
     */
    async remove(id: string, userId: string): Promise<Auction> {
        const auction = await this.findOne(id);

        const listing = await this.prisma.listing.findUnique({
            where: { id: auction.listingId },
        });

        if (listing?.sellerId !== userId) {
            throw new ForbiddenException('You do not own this auction');
        }

        return this.prisma.auction.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }
}
