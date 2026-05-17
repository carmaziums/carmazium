import {
    Controller,
    Post,
    Get,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiParam,
    ApiCookieAuth,
    ApiResponse,
} from '@nestjs/swagger';
import { FeaturedBoostService } from './featured-boost.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';

@ApiTags('Featured Boost')
@Controller('featured-boost')
export class FeaturedBoostController {
    constructor(private readonly featuredBoostService: FeaturedBoostService) { }

    @Post(':listingId')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Boost a listing — returns Stripe checkout URL' })
    @ApiParam({ name: 'listingId', description: 'UUID of the listing to boost' })
    @ApiResponse({ status: 200, description: 'Stripe checkout URL returned' })
    @ApiResponse({ status: 400, description: 'Listing already featured' })
    @ApiResponse({ status: 403, description: 'Not your listing' })
    async boost(
        @Param('listingId') listingId: string,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any>> {
        const result = await this.featuredBoostService.activateBoost(listingId, user.id);
        return new StandardResponse(result);
    }

    @Get('my')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: "Get seller's boost history" })
    async getMyBoosts(@CurrentUser() user: any): Promise<StandardResponse<any>> {
        const boosts = await this.featuredBoostService.getMyBoosts(user.id);
        return new StandardResponse(boosts);
    }

    @Get('status/:listingId')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiParam({ name: 'listingId', description: 'UUID of the listing' })
    @ApiOperation({ summary: 'Get boost status for a listing' })
    async getStatus(@Param('listingId') listingId: string): Promise<StandardResponse<any>> {
        const status = await this.featuredBoostService.getBoostStatus(listingId);
        return new StandardResponse(status);
    }
}
