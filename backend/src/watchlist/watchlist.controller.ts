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
