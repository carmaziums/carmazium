import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';
import { StandardResponse, PaginatedResponse } from './dto/response.dto';
import { Listing } from '@prisma/client';

/**
 * Custom decorator to extract userId from request
 * TODO: Replace with actual auth guard and user decorator
 * For now, this is a placeholder
 */
function UserId() {
    return function (target: any, propertyKey: string, parameterIndex: number) {
        // Placeholder - in production, this would extract userId from JWT token
        // For testing, you can hardcode a test user ID or use a header
    };
}

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
    constructor(private readonly listingsService: ListingsService) { }

    /**
     * Create a new listing
     * Requires authentication
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create a new listing',
        description: 'Creates a new vehicle listing. Requires authentication.',
    })
    @ApiResponse({
        status: 201,
        description: 'Listing created successfully',
        type: StandardResponse,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data',
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - Authentication required',
    })
    async create(
        @Body() createListingDto: CreateListingDto,
        // TODO: Uncomment when auth is implemented
        // @UserId() userId: string,
    ): Promise<StandardResponse<Listing>> {
        // TEMPORARY: For testing without auth, userId is optional
        // In production, this should come from @UserId() decorator with JWT
        const listing = await this.listingsService.create(createListingDto);
        return new StandardResponse(listing);
    }

    /**
     * Get all listings with filtering and pagination
     * Public endpoint
     * IMPORTANT: This route must come BEFORE /:slug to avoid route clash
     */
    @Get()
    @ApiOperation({
        summary: 'Get all listings',
        description: 'Retrieves all active listings with optional filtering and pagination',
    })
    @ApiQuery({ name: 'minPrice', required: false, type: Number })
    @ApiQuery({ name: 'maxPrice', required: false, type: Number })
    @ApiQuery({ name: 'make', required: false, type: String })
    @ApiQuery({ name: 'year', required: false, type: Number })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
    @ApiResponse({
        status: 200,
        description: 'List of listings with pagination metadata',
    })
    async findAll(
        @Query() filterDto: ListingFilterDto,
    ): Promise<PaginatedResponse<Listing>> {
        const { data, total } = await this.listingsService.findAll(filterDto);
        const page = filterDto.page || 1;
        const limit = filterDto.limit || 20;

        return new PaginatedResponse(data, total, page, limit);
    }

    /**
     * Get a single listing by slug
     * Public endpoint
     * IMPORTANT: This route uses :slug parameter and must come AFTER the /listings route
     * to avoid treating query parameters as slug values
     */
    @Get(':slug')
    @ApiOperation({
        summary: 'Get listing by slug',
        description: 'Retrieves a single listing by its SEO-friendly slug',
    })
    @ApiParam({
        name: 'slug',
        description: 'URL-friendly slug of the listing',
        example: 'audi-q7-2015-x8d2',
    })
    @ApiResponse({
        status: 200,
        description: 'Listing found',
    })
    @ApiResponse({
        status: 404,
        description: 'Listing not found',
    })
    async findBySlug(@Param('slug') slug: string): Promise<StandardResponse<Listing>> {
        const listing = await this.listingsService.findBySlug(slug);
        return new StandardResponse(listing);
    }

    /**
     * Update a listing
     * Requires authentication and ownership
     */
    @Patch(':id')
    @ApiOperation({
        summary: 'Update a listing',
        description: 'Updates a listing. Requires authentication and ownership.',
    })
    @ApiParam({
        name: 'id',
        description: 'UUID of the listing',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Listing updated successfully',
    })
    @ApiResponse({
        status: 403,
        description: 'Forbidden - You do not own this listing',
    })
    @ApiResponse({
        status: 404,
        description: 'Listing not found',
    })
    async update(
        @Param('id') id: string,
        @Body() updateListingDto: UpdateListingDto,
        // TODO: Uncomment when auth is implemented
        // @UserId() userId: string,
    ): Promise<StandardResponse<Listing>> {
        // TEMPORARY: For testing without auth
        const userId = 'temp-user-id-for-testing';

        const listing = await this.listingsService.update(id, userId, updateListingDto);
        return new StandardResponse(listing);
    }

    /**
     * Soft delete a listing
     * Requires authentication and ownership
     */
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Delete a listing (soft delete)',
        description: 'Soft deletes a listing by setting deletedAt. Requires authentication and ownership.',
    })
    @ApiParam({
        name: 'id',
        description: 'UUID of the listing',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Listing deleted successfully',
    })
    @ApiResponse({
        status: 403,
        description: 'Forbidden - You do not own this listing',
    })
    @ApiResponse({
        status: 404,
        description: 'Listing not found',
    })
    async remove(
        @Param('id') id: string,
        // TODO: Uncomment when auth is implemented
        // @UserId() userId: string,
    ): Promise<StandardResponse<Listing>> {
        // TEMPORARY: For testing without auth
        const userId = 'temp-user-id-for-testing';

        const listing = await this.listingsService.softDelete(id, userId);
        return new StandardResponse(listing);
    }
}
