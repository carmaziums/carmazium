import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BidsService } from './bids.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Bids')
@Controller('bids')
export class BidsController {
    constructor(private readonly bidsService: BidsService) { }

    /**
     * Place a bid on an auction listing
     */
    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Place a bid on an auction listing' })
    @ApiResponse({ status: 201, description: 'Bid placed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid bid or listing not an auction' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async create(
        @CurrentUser() user: any,
        @Body() createBidDto: CreateBidDto,
    ) {
        const bid = await this.bidsService.create(user.id, createBidDto);
        return { success: true, data: bid };
    }

    /**
     * Get current user's bids
     */
    @Get('my')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get my bids' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findMyBids(
        @CurrentUser() user: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const { data, total } = await this.bidsService.findMyBids(
            user.id,
            parseInt(page || '1'),
            parseInt(limit || '20'),
        );
        const pageNum = parseInt(page || '1');
        const limitNum = parseInt(limit || '20');
        return {
            success: true,
            data,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        };
    }

    /**
     * Get buyer dashboard stats
     */
    @Get('stats')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get buyer dashboard statistics' })
    async getBuyerStats(@CurrentUser() user: any) {
        const stats = await this.bidsService.getBuyerStats(user.id);
        return { success: true, data: stats };
    }

    /**
     * Get all bids for a specific listing (public)
     */
    @Get('listing/:listingId')
    @ApiOperation({ summary: 'Get all bids for a listing' })
    async findByListing(@Param('listingId') listingId: string) {
        const bids = await this.bidsService.findByListing(listingId);
        return { success: true, data: bids };
    }
}
