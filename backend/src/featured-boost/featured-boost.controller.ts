import {
    Controller,
    Post,
    Get,
    Param,
    UseGuards,
    Headers,
    RawBodyRequest,
    Req,
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
import { Request } from 'express';

@ApiTags('Featured Boost')
@Controller('featured-boost')
export class FeaturedBoostController {
    constructor(private readonly featuredBoostService: FeaturedBoostService) { }

    /**
     * POST /featured-boost/:listingId
     * Activate a boost. In bypass mode: immediately active.
     * In Stripe mode: returns a redirect URL.
     */
    @Post(':listingId')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Boost a listing',
        description:
            'Activates a featured boost for a listing. In bypass mode returns immediately. In Stripe mode returns a checkout URL.',
    })
    @ApiParam({ name: 'listingId', description: 'UUID of the listing to boost' })
    @ApiResponse({ status: 200, description: 'Boost activated or Stripe URL returned' })
    @ApiResponse({ status: 400, description: 'Listing already featured or not ACTIVE' })
    @ApiResponse({ status: 403, description: 'Not your listing' })
    async boost(
        @Param('listingId') listingId: string,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any>> {
        const result = await this.featuredBoostService.activateBoost(listingId, user.id);
        return new StandardResponse(result);
    }

    /**
     * POST /featured-boost/webhook
     * Stripe webhook — verifies signature and activates boost on payment.
     */
    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Stripe webhook handler' })
    async webhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('stripe-signature') sig: string,
    ) {
        const rawBody = req.rawBody ?? Buffer.from('');
        return this.featuredBoostService.handleStripeWebhook(rawBody, sig);
    }

    /**
     * GET /featured-boost/my
     * Returns the authenticated seller's boost history.
     */
    @Get('my')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: "Get seller's boost history" })
    async getMyBoosts(@CurrentUser() user: any): Promise<StandardResponse<any>> {
        const boosts = await this.featuredBoostService.getMyBoosts(user.id);
        return new StandardResponse(boosts);
    }

    /**
     * GET /featured-boost/status/:listingId
     * Returns boost status for a listing.
     */
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
