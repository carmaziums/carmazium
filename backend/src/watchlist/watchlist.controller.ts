import {
    Controller,
    Get,
    Post,
    Delete,
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
    ApiParam,
} from '@nestjs/swagger';
import { WatchlistService } from './watchlist.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { VerifiedDealerGuard } from '../auth/guards/verified-dealer.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse, PaginatedResponse } from '../listings/dto/response.dto';

@ApiTags('Watchlist')
@Controller('watchlist')
export class WatchlistController {
    constructor(private readonly watchlistService: WatchlistService) { }

    /**
     * Get user's watchlist.
     */
    @Get()
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Get my watchlist' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @CurrentUser() user: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const pageNum = parseInt(page || '1');
        const limitNum = parseInt(limit || '20');

        const { data, total } = await this.watchlistService.findAll(
            user.id,
            pageNum,
            limitNum,
        );
        return new PaginatedResponse(data, total, pageNum, limitNum);
    }

    /**
     * This endpoint exposes trade-auction state only after dealer verification.
     * The general watchlist endpoint intentionally remains retail-safe.
     */
    @Get('auctions')
    @UseGuards(SessionAuthGuard, VerifiedDealerGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Get my saved trade auctions (verified dealers)' })
    async findAuctionShortlist(
        @CurrentUser() user: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('view') view?: string,
    ) {
        const safePage = Number.isSafeInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
        const safeLimit = Number.isSafeInteger(Number(limit)) && Number(limit) > 0
            ? Math.min(Number(limit), 50)
            : 12;
        const result = await this.watchlistService.findAuctionShortlist(
            user.id, safePage, safeLimit, view !== 'all',
        );
        return new PaginatedResponse(result.data, result.total, result.page, result.limit);
    }

    /**
     * Save an auction to the verified-dealer shortlist.
     * Deliberately separate from generic Saved Cars so a normal buyer cannot
     * turn a known auction listing ID into trade inventory access.
     */
    @Post('auctions/:listingId')
    @UseGuards(SessionAuthGuard, VerifiedDealerGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Save auction to shortlist (verified dealers)' })
    @ApiParam({ name: 'listingId', description: 'Auction listing ID to shortlist' })
    async addAuction(
        @CurrentUser() user: any,
        @Param('listingId') listingId: string,
    ) {
        const item = await this.watchlistService.addAuction(user.id, listingId);
        return new StandardResponse(item);
    }

    /**
     * Remove an auction from the verified-dealer shortlist.
     */
    @Delete('auctions/:listingId')
    @UseGuards(SessionAuthGuard, VerifiedDealerGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove auction from shortlist (verified dealers)' })
    @ApiParam({ name: 'listingId', description: 'Auction listing ID to remove' })
    async removeAuction(
        @CurrentUser() user: any,
        @Param('listingId') listingId: string,
    ): Promise<void> {
        await this.watchlistService.removeAuction(user.id, listingId);
    }

    /**
     * Add listing to watchlist.
     */
    @Post(':listingId')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Add listing to watchlist' })
    @ApiParam({ name: 'listingId', description: 'ID of the listing to add' })
    @ApiResponse({ status: 201, description: 'Added to watchlist' })
    @ApiResponse({ status: 409, description: 'Already in watchlist' })
    async add(
        @CurrentUser() user: any,
        @Param('listingId') listingId: string,
    ) {
        const item = await this.watchlistService.add(user.id, listingId);
        return new StandardResponse(item);
    }

    /**
     * Remove listing from watchlist.
     */
    @Delete(':listingId')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove listing from watchlist' })
    @ApiParam({ name: 'listingId', description: 'ID of the listing to remove' })
    async remove(
        @CurrentUser() user: any,
        @Param('listingId') listingId: string,
    ): Promise<void> {
        await this.watchlistService.remove(user.id, listingId);
    }

    /**
     * Check if listing is in watchlist.
     */
    @Get('check/:listingId')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Check if listing is in watchlist' })
    async check(
        @CurrentUser() user: any,
        @Param('listingId') listingId: string,
    ) {
        const inWatchlist = await this.watchlistService.isInWatchlist(
            user.id,
            listingId,
        );
        return new StandardResponse({ inWatchlist });
    }

    /**
     * Get watchlist count.
     */
    @Get('count')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Get watchlist count' })
    async getCount(@CurrentUser() user: any) {
        const count = await this.watchlistService.getCount(user.id);
        return new StandardResponse({ count });
    }
}
