import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';
import { ListingStatus } from '@prisma/client';

@Injectable()
export class ListingsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(userId: string, dto: CreateListingDto) {
        return this.prisma.listing.create({
            data: {
                ...dto,
                userId,
                status: ListingStatus.ACTIVE, // Default to ACTIVE for now, or DRAFT if needed
                images: dto.images as any,
            },
        });
    }

    async findAll(filters: ListingFilterDto) {
        const { make, minPrice, maxPrice, minYear, page = 1, limit = 10 } = filters;

        const where: any = {
            status: ListingStatus.ACTIVE,
        };

        if (make) {
            where.make = { contains: make, mode: 'insensitive' };
        }

        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) where.price.gte = minPrice;
            if (maxPrice) where.price.lte = maxPrice;
        }

        if (minYear) {
            where.year = { gte: minYear };
        }

        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            this.prisma.listing.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.listing.count({ where }),
        ]);

        return {
            items,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findOne(id: string) {
        const listing = await this.prisma.listing.findUnique({
            where: { id },
        });

        if (!listing) {
            throw new NotFoundException(`Listing with ID ${id} not found`);
        }

        return listing;
    }

    async update(id: string, userId: string, dto: UpdateListingDto) {
        const listing = await this.findOne(id);

        if (listing.userId !== userId) {
            throw new ForbiddenException('You do not have permission to update this listing');
        }

        return this.prisma.listing.update({
            where: { id },
            data: {
                ...dto,
                images: dto.images ? (dto.images as any) : undefined,
            },
        });
    }

    async remove(id: string, userId: string) {
        const listing = await this.findOne(id);

        if (listing.userId !== userId) {
            throw new ForbiddenException('You do not have permission to delete this listing');
        }

        return this.prisma.listing.delete({
            where: { id },
        });
    }
}
