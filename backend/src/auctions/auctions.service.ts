/* ============================================================================
 * AUCTIONS SERVICE — FROZEN
 * ============================================================================
 * Auctions have been temporarily disabled by client decision.
 * All service logic is preserved in AUCTION_DISABLED blocks.
 * To re-enable: uncomment all blocks and restore the original class body.
 * ============================================================================ */

import { Injectable } from '@nestjs/common';

/* AUCTION_DISABLED — original imports kept for easy re-enable
import {
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { Auction } from '@prisma/client';
*/

@Injectable()
export class AuctionsService {
    /* AUCTION_DISABLED
    constructor(private readonly prisma: PrismaService) { }
    */

    /* AUCTION_DISABLED — create()
     *
     * async create(createAuctionDto: CreateAuctionDto, userId: string): Promise<Auction> {
     *     const now = new Date();
     *     if (new Date(createAuctionDto.endTime) <= new Date(createAuctionDto.startTime)) {
     *         throw new BadRequestException('End time must be after start time');
     *     }
     *     if (new Date(createAuctionDto.endTime) <= now) {
     *         throw new BadRequestException('End time must be in the future');
     *     }
     *
     *     const listing = await this.prisma.listing.findUnique({
     *         where: { id: createAuctionDto.listingId },
     *     });
     *
     *     if (!listing) throw new NotFoundException('Listing not found');
     *     if (listing.sellerId && listing.sellerId !== userId) throw new ForbiddenException('You do not own this listing');
     *     if (listing.type !== 'AUCTION') throw new BadRequestException('Listing is not of type AUCTION');
     *
     *     const existing = await this.prisma.auction.findUnique({
     *         where: { listingId: createAuctionDto.listingId },
     *     });
     *     if (existing) throw new BadRequestException('Auction already exists for this listing');
     *
     *     return this.prisma.auction.create({ data: { ...createAuctionDto } });
     * }
     */

    /* AUCTION_DISABLED — findAllActive()
     *
     * async findAllActive(): Promise<Auction[]> {
     *     const now = new Date();
     *     return this.prisma.auction.findMany({
     *         where: {
     *             startTime: { lte: now },
     *             endTime: { gt: now },
     *             listing: { status: 'ACTIVE' },
     *         },
     *         include: {
     *             listing: {
     *                 select: { id: true, title: true, slug: true, images: true, make: true, model: true, year: true },
     *             },
     *         },
     *         orderBy: { endTime: 'asc' },
     *     });
     * }
     */

    /* AUCTION_DISABLED — findOne()
     *
     * async findOne(id: string): Promise<Auction> {
     *     const auction = await this.prisma.auction.findUnique({
     *         where: { id },
     *         include: { listing: true },
     *     });
     *     if (!auction) throw new NotFoundException(`Auction with ID "${id}" not found`);
     *     return auction;
     * }
     */

    /* AUCTION_DISABLED — update()
     *
     * async update(id: string, updateAuctionDto: UpdateAuctionDto, userId: string): Promise<Auction> {
     *     const auction = await this.findOne(id);
     *     const listing = await this.prisma.listing.findUnique({ where: { id: auction.listingId } });
     *
     *     if (listing?.sellerId !== userId) throw new ForbiddenException('You do not own this auction');
     *
     *     if (updateAuctionDto.startTime && updateAuctionDto.endTime) {
     *         if (new Date(updateAuctionDto.endTime) <= new Date(updateAuctionDto.startTime)) {
     *             throw new BadRequestException('End time must be after start time');
     *         }
     *     }
     *
     *     return this.prisma.auction.update({ where: { id }, data: updateAuctionDto });
     * }
     */

    /* AUCTION_DISABLED — remove()
     *
     * async remove(id: string, userId: string): Promise<Auction> {
     *     const auction = await this.findOne(id);
     *     const listing = await this.prisma.listing.findUnique({ where: { id: auction.listingId } });
     *
     *     if (listing?.sellerId !== userId) throw new ForbiddenException('You do not own this auction');
     *
     *     return this.prisma.auction.update({
     *         where: { id },
     *         data: { deletedAt: new Date() },
     *     });
     * }
     */
}
