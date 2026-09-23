import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    ParseIntPipe,
    DefaultValuePipe,
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiCookieAuth,
} from '@nestjs/swagger';
import { SellersService } from './sellers.service';
import { CreateSellerReviewDto } from './dto/create-seller-review.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { OptionalSessionAuthGuard } from '../auth/guards/optional-session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse, PaginatedResponse } from '../listings/dto/response.dto';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Sellers')
@Controller('sellers')
export class SellersController {
    constructor(
        private readonly sellersService: SellersService,
        private readonly prisma: PrismaService,
    ) { }

    /**
     * GET /sellers/:userId
     * Public — returns a seller's profile, stats, and review summary.
     */
    @Get(':userId')
    @ApiOperation({ summary: 'Get public seller profile' })
    @ApiParam({ name: 'userId', description: 'UUID of the seller (User ID)', example: 'uuid' })
    @ApiResponse({ status: 200, description: 'Seller profile with stats and review summary' })
    @ApiResponse({ status: 404, description: 'Seller profile not found' })
    async getProfile(@Param('userId') userId: string): Promise<StandardResponse<any>> {
        const profile = await this.sellersService.getPublicProfile(userId);
        return new StandardResponse(profile);
    }

    /**
     * GET /sellers/:userId/phone
     * Soft-auth. Authenticated callers can see the seller number. Anonymous
     * callers may see it only when `listingId` identifies this seller's ACTIVE
     * PREMIUM retail listing; otherwise only `phoneAvailable` is returned.
     */
    @Get(':userId/phone')
    @UseGuards(OptionalSessionAuthGuard)
    @ApiOperation({ summary: "Get a seller's contact phone with listing-aware public gating" })
    @ApiParam({ name: 'userId', description: 'UUID of the seller', example: 'uuid' })
    @ApiQuery({ name: 'listingId', required: false, type: String, description: 'Listing context for Premium public contact visibility' })
    async getContactPhone(
        @Param('userId') userId: string,
        @CurrentUser() user: any,
        @Query('listingId') listingId?: string,
    ): Promise<StandardResponse<{ phone: string | null; phoneAvailable: boolean }>> {
        const result = await this.sellersService.getContactPhone(userId, !!user, listingId);
        return new StandardResponse(result);
    }

    /**
     * GET /sellers/:userId/listings
     * Public — returns active listings belonging to this seller, paginated.
     */
    @Get(':userId/listings')
    @ApiOperation({ summary: "Get all active listings by a seller" })
    @ApiParam({ name: 'userId', description: 'UUID of the seller', example: 'uuid' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 12 })
    @ApiResponse({ status: 200, description: 'Paginated list of seller listings' })
    async getSellerListings(
        @Param('userId') userId: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    ): Promise<PaginatedResponse<any>> {
        const { data, total } = await this.sellersService.getSellerListings(userId, page, limit);
        return new PaginatedResponse(data, total, page, limit);
    }

    /**
     * GET /sellers/:sellerProfileId/reviews
     * Public — returns paginated reviews for a SellerProfile.
     */
    @Get(':sellerProfileId/reviews')
    @ApiOperation({ summary: 'Get reviews for a seller profile' })
    @ApiParam({ name: 'sellerProfileId', description: 'UUID of the SellerProfile (not User ID)', example: 'uuid' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiResponse({ status: 200, description: 'Paginated list of reviews' })
    async getReviews(
        @Param('sellerProfileId') sellerProfileId: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ): Promise<PaginatedResponse<any>> {
        const { data, total } = await this.sellersService.getSellerReviews(sellerProfileId, page, limit);
        return new PaginatedResponse(data, total, page, limit);
    }

    /**
     * POST /sellers/reviews
     * Legacy seller-review compatibility route.
     *
     * SellerReview is also the storage used by the unified profile reputation
     * system. Historical rows remain untouched, but all new writes through this
     * legacy endpoint must now prove the reviewer bought the exact listing from
     * the exact seller. This closes the old arbitrary-review path without
     * creating a second reputation store or migrating historical reviews.
     */
    @Post('reviews')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Submit a verified seller review (auth required)' })
    @ApiResponse({ status: 201, description: 'Verified review submitted and reliability score updated' })
    @ApiResponse({ status: 400, description: 'Missing listing, duplicate review or self-review attempt' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'No completed CarMazium transaction for this listing' })
    @ApiResponse({ status: 404, description: 'Seller profile not found' })
    async submitReview(
        @Body() dto: CreateSellerReviewDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any>> {
        const sellerProfile = await this.prisma.sellerProfile.findUnique({
            where: { id: dto.sellerId },
            select: { userId: true },
        });
        if (!sellerProfile) {
            throw new NotFoundException('Seller profile not found');
        }
        if (sellerProfile.userId === user.id) {
            throw new BadRequestException('You cannot review yourself');
        }
        if (!dto.listingId) {
            throw new BadRequestException('A completed CarMazium listing is required to leave a seller review.');
        }

        const [sale, auctionHandover] = await Promise.all([
            this.prisma.sale.findFirst({
                where: {
                    listingId: dto.listingId,
                    sellerId: sellerProfile.userId,
                    buyerId: user.id,
                },
                select: { id: true },
            }),
            this.prisma.auction.findFirst({
                where: {
                    listingId: dto.listingId,
                    winnerId: user.id,
                    handoverSubmittedAt: { not: null },
                    listing: { sellerId: sellerProfile.userId },
                },
                select: { id: true },
            }),
        ]);

        if (!sale && !auctionHandover) {
            throw new ForbiddenException(
                'Reviews can only be left after a completed CarMazium vehicle transaction with this seller.',
            );
        }

        const review = await this.sellersService.submitReview(user.id, dto);
        return new StandardResponse(review);
    }
}
