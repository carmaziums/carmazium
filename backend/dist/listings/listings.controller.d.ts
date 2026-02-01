import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';
import { StandardResponse, PaginatedResponse } from './dto/response.dto';
import { Listing } from '@prisma/client';
export declare class ListingsController {
    private readonly listingsService;
    constructor(listingsService: ListingsService);
    create(createListingDto: CreateListingDto): Promise<StandardResponse<Listing>>;
    findAll(filterDto: ListingFilterDto): Promise<PaginatedResponse<Listing>>;
    findBySlug(slug: string): Promise<StandardResponse<Listing>>;
    update(id: string, updateListingDto: UpdateListingDto): Promise<StandardResponse<Listing>>;
    remove(id: string): Promise<StandardResponse<Listing>>;
}
