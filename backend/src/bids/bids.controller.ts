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
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiCookieAuth,
    ApiQuery,
} from '@nestjs/swagger';
import { BidsService } from './bids.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse, PaginatedResponse } from '../listings/dto/response.dto';

@ApiTags('Bids')
@Controller('bids')
export class BidsController {
    constructor(private readonly bidsService: BidsService) { }

    /**
     * Place a bid on an auction listing.
     */
    @Post()
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Place a bid on an auction listing' })
    @ApiResponse({ status: 201, description: 'Bid placed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid bid or listing not an auction' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async create(
        @CurrentUser() user: any,
        @Body() createBidDto: CreateBidDto,
    ) {
        const bid = await this.bidsService.create(user.id, createBidDto);
        return new StandardResponse(bid);
    }

    /**
     * Get current user's bids.
     */
    @Get('my')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Get my bids' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findMyBids(
        @CurrentUser() user: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const pageNum = parseInt(page || '1');
        const limitNum = parseInt(limit || '20');

        const { data, total } = await this.bidsService.findMyBids(
            user.id,
            pageNum,
            limitNum,
        );
        return new PaginatedResponse(data, total, pageNum, limitNum);
    }

    /**
     * Get buyer dashboard statistics.
     */
    @Get('stats')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Get buyer dashboard statistics' })
    async getBuyerStats(@CurrentUser() user: any) {
        const stats = await this.bidsService.getBuyerStats(user.id);
        return new StandardResponse(stats);
    }

    /**
     * Get all bids for a specific listing (public).
     */
    @Get('listing/:listingId')
    @ApiOperation({ summary: 'Get all bids for a listing' })
    async findByListing(@Param('listingId') listingId: string) {
        const bids = await this.bidsService.findByListing(listingId);
        return new StandardResponse(bids);
    }
}
