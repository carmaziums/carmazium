import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { WatchlistService } from './watchlist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Watchlist')
@Controller('watchlist')
export class WatchlistController {
    constructor(private readonly watchlistService: WatchlistService) { }

    /**
     * Get user's watchlist
     */
    @Get()
    // @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get my watchlist' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @CurrentUser() user: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const { data, total } = await this.watchlistService.findAll(
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
     * Add listing to watchlist
     */
    @Post(':listingId')
    // @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Add listing to watchlist' })
    @ApiParam({ name: 'listingId', description: 'ID of the listing to add' })
    @ApiResponse({ status: 201, description: 'Added to watchlist' })
    @ApiResponse({ status: 409, description: 'Already in watchlist' })
    async add(
        @CurrentUser() user: any,
        @Param('listingId') listingId: string,
    ) {
        const item = await this.watchlistService.add(user.id, listingId);
        return { success: true, data: item };
    }

    /**
     * Remove listing from watchlist
     */
    @Delete(':listingId')
    // @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Remove listing from watchlist' })
    @ApiParam({ name: 'listingId', description: 'ID of the listing to remove' })
    async remove(
        @CurrentUser() user: any,
        @Param('listingId') listingId: string,
    ) {
        await this.watchlistService.remove(user.id, listingId);
        return { success: true };
    }

    /**
     * Check if listing is in watchlist
     */
    @Get('check/:listingId')
    // @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Check if listing is in watchlist' })
    async check(
        @CurrentUser() user: any,
        @Param('listingId') listingId: string,
    ) {
        const inWatchlist = await this.watchlistService.isInWatchlist(user.id, listingId);
        return { success: true, data: { inWatchlist } };
    }

    /**
     * Get watchlist count
     */
    @Get('count')
    // @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get watchlist count' })
    async getCount(@CurrentUser() user: any) {
        const count = await this.watchlistService.getCount(user.id);
        return { success: true, data: { count } };
    }
}
