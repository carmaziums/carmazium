import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';
import { Listing } from '@prisma/client';
export declare class ListingsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private generateSlug;
    create(createListingDto: CreateListingDto, userId?: string): Promise<Listing>;
    findAll(filterDto: ListingFilterDto): Promise<{
        data: Listing[];
        total: number;
    }>;
    findBySlug(slug: string): Promise<Listing>;
    findById(id: string): Promise<Listing>;
    update(id: string, userId: string, updateListingDto: UpdateListingDto): Promise<Listing>;
    softDelete(id: string, userId: string): Promise<Listing>;
}
