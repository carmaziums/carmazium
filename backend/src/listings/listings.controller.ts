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
    UseGuards,
    Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiCookieAuth,
} from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { RecordSaleDto } from './dto/record-sale.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';
import { StandardResponse, PaginatedResponse } from './dto/response.dto';
import { Listing } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';



@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
    constructor(private readonly listingsService: ListingsService) { }

    /**
     * Create a new listing
     * Requires authentication
     */
    @Post()
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
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
        @CurrentUser() user: any,
    ): Promise<StandardResponse<Listing>> {
        const listing = await this.listingsService.create(createListingDto, user.id);
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
     * Get featured listings (isFeatured = true)
     * Public endpoint — used for homepage carousel and "Featured" sections
     */
    @Get('featured')
    @ApiOperation({
        summary: 'Get featured listings',
        description: 'Returns currently active featured listings, ordered by expiry date.',
    })
    @ApiResponse({ status: 200, description: 'Array of featured listings' })
    async getFeatured(): Promise<StandardResponse<Listing[]>> {
        const listings = await this.listingsService.getFeaturedListings(8);
        return new StandardResponse(listings);
    }

    /**
     * Get current user's listings
     * Requires authentication
     */
    @Get('my')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({
        summary: 'Get my listings',
        description: 'Retrieves all listings belonging to the authenticated user',
    })
    @ApiResponse({
        status: 200,
        description: 'User listings with pagination',
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized',
    })
    async findMyListings(
        @CurrentUser() user: any,
        @Query() filterDto: ListingFilterDto,
    ): Promise<PaginatedResponse<Listing>> {
        const { data, total } = await this.listingsService.findMyListings(user.id, filterDto);
        const page = filterDto.page || 1;
        const limit = filterDto.limit || 20;
        return new PaginatedResponse(data, total, page, limit);
    }

    /**
     * Get seller dashboard statistics
     * Requires authentication
     */
    @Get('stats')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({
        summary: 'Get seller stats',
        description: 'Retrieves dashboard statistics for the authenticated seller',
    })
    @ApiResponse({
        status: 200,
        description: 'Seller statistics',
    })
    async getSellerStats(
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any>> {
        const stats = await this.listingsService.getSellerStats(user.id);
        return new StandardResponse(stats);
    }

    /**
     * Get seller performance analytics
     * Requires authentication
     */
    @Get('performance')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({
        summary: 'Get seller performance analytics',
        description: 'Returns revenue, views, conversion rate, and per-listing view data for charts',
    })
    @ApiResponse({
        status: 200,
        description: 'Seller performance data',
    })
    async getSellerPerformance(
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any>> {
        const performance = await this.listingsService.getSellerPerformance(user.id);
        return new StandardResponse(performance);
    }

    /**
     * Get earnings history for the authenticated seller/dealer
     *
     * IMPORTANT: This route MUST be declared before `@Get(':slug')` so the static
     * "earnings" path isn't captured by the dynamic slug parameter.
     */
    @Get('earnings')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({
        summary: 'Get earnings history',
        description: 'Returns sales history, total revenue, and total sales count for the user.',
    })
    @ApiResponse({ status: 200, description: 'Earnings data retrieved successfully' })
    async getEarnings(
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any>> {
        const earnings = await this.listingsService.getEarnings(user.id);
        return new StandardResponse(earnings);
    }

    @Get('earnings/export')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Export earnings history as CSV' })
    async exportEarnings(
        @CurrentUser() user: any,
        @Res() res: Response,
    ): Promise<void> {
        const earnings = await this.listingsService.getEarnings(user.id);
        const rows: string[] = ['Date,Vehicle,VRM,Buyer,Listed Price,Sold Price'];
        for (const sale of earnings.sales) {
            const date = new Date(sale.createdAt).toLocaleDateString('en-GB');
            const title = `"${(sale.listing?.title ?? '').replace(/"/g, '""')}"`;
            const vrm = sale.listing?.vrm ?? '';
            const buyer = sale.buyer ? `${sale.buyer.firstName ?? ''} ${sale.buyer.lastName ?? ''}`.trim() : 'Private';
            const listed = Number(sale.listing?.price ?? 0).toFixed(2);
            const sold = Number(sale.soldPrice).toFixed(2);
            rows.push(`${date},${title},${vrm},${buyer},${listed},${sold}`);
        }
        const csv = rows.join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="earnings.csv"');
        res.send(csv);
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
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
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
        @CurrentUser() user: any,
    ): Promise<StandardResponse<Listing>> {
        const listing = await this.listingsService.update(id, user.id, updateListingDto);
        return new StandardResponse(listing);
    }

    /**
     * Update listing status
     * Requires authentication and ownership
     */
    @Patch(':id/status')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({
        summary: 'Update listing status',
        description: 'Updates the status of a listing (e.g. DRAFT -> ACTIVE -> SOLD).',
    })
    @ApiParam({ name: 'id', description: 'UUID of the listing' })
    @ApiResponse({ status: 200, description: 'Status updated successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    async updateStatus(
        @Param('id') id: string,
        @Body() updateStatusDto: UpdateStatusDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<Listing>> {
        const listing = await this.listingsService.updateStatus(id, user.id, updateStatusDto.status);
        return new StandardResponse(listing);
    }

    /**
     * Mark listing as sold with final details
     * Requires authentication and ownership
     */
    @Patch(':id/sold')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({
        summary: 'Mark listing as sold',
        description: 'Records final sale price and buyer ID, then marks listing as SOLD.',
    })
    @ApiParam({ name: 'id', description: 'UUID of the listing' })
    @ApiResponse({ status: 200, description: 'Sale recorded and listing marked as SOLD' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    async recordSale(
        @Param('id') id: string,
        @Body() recordSaleDto: RecordSaleDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<Listing>> {
        const listing = await this.listingsService.recordSale(id, user.id, recordSaleDto);
        return new StandardResponse(listing);
    }

    /**
     * Soft delete a listing
     * Requires authentication and ownership
     */
    @Delete(':id')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
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
        @CurrentUser() user: any,
    ): Promise<StandardResponse<Listing>> {
        const listing = await this.listingsService.softDelete(id, user.id);
        return new StandardResponse(listing);
    }
}
