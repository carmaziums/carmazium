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

@ApiTags('Sellers')
@Controller('sellers')
export class SellersController {
    constructor(private readonly sellersService: SellersService) { }

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
     * Soft-auth — returns the seller's contact phone only if the caller is
     * logged in; anonymous callers get `phoneAvailable` instead of the number.
     */
    @Get(':userId/phone')
    @UseGuards(OptionalSessionAuthGuard)
    @ApiOperation({ summary: "Get a seller's contact phone (gated by login)" })
    @ApiParam({ name: 'userId', description: 'UUID of the seller', example: 'uuid' })
    async getContactPhone(
        @Param('userId') userId: string,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<{ phone: string | null; phoneAvailable: boolean }>> {
        const result = await this.sellersService.getContactPhone(userId, !!user);
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
     * Auth required — submit a new review for a seller.
     * The reviewer must be a different user from the seller.
     */
    @Post('reviews')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Submit a seller review (auth required)' })
    @ApiResponse({ status: 201, description: 'Review submitted and reliability score updated' })
    @ApiResponse({ status: 400, description: 'Duplicate review or self-review attempt' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Seller profile not found' })
    async submitReview(
        @Body() dto: CreateSellerReviewDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any>> {
        const review = await this.sellersService.submitReview(user.id, dto);
        return new StandardResponse(review);
    }
}
