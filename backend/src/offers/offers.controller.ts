import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiCookieAuth,
} from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';

@ApiTags('Offers')
@Controller('offers')
@UseGuards(SessionAuthGuard)
@ApiCookieAuth()
export class OffersController {
    constructor(private readonly offersService: OffersService) { }

    /**
     * Buyer: Submit a price offer on a listing
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Make an offer', description: 'Submit an offer within the listing\'s price range.' })
    @ApiResponse({ status: 201, description: 'Offer created' })
    @ApiResponse({ status: 400, description: 'Amount out of range or invalid' })
    @ApiResponse({ status: 403, description: 'Cannot offer on own listing' })
    @ApiResponse({ status: 404, description: 'Listing not found' })
    async makeOffer(
        @Body() dto: CreateOfferDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any>> {
        const offer = await this.offersService.makeOffer(user.id, dto);
        return new StandardResponse(offer);
    }

    /**
     * Buyer: Get all offers they have submitted
     */
    @Get('my')
    @ApiOperation({ summary: 'Get my offers', description: 'Returns all offers submitted by the authenticated buyer.' })
    @ApiResponse({ status: 200, description: 'List of buyer\'s offers with listing details' })
    async getMyOffers(
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any[]>> {
        const offers = await this.offersService.getMyOffers(user.id);
        return new StandardResponse(offers);
    }

    /**
     * Buyer: Get their own latest offer for a specific listing
     */
    @Get('my/:listingId')
    @ApiOperation({ summary: 'Get my offer for a listing', description: 'Returns the authenticated buyer\'s most recent offer on a specific listing, or null if none.' })
    @ApiParam({ name: 'listingId', description: 'UUID of the listing' })
    @ApiResponse({ status: 200, description: 'Buyer\'s latest offer or null' })
    async getMyOfferForListing(
        @Param('listingId') listingId: string,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any>> {
        const offer = await this.offersService.getMyOfferForListing(listingId, user.id);
        return new StandardResponse(offer);
    }

    /**
     * Seller: Get all offers on a specific listing they own
     */
    @Get('listing/:listingId')
    @ApiOperation({ summary: 'Get offers for a listing', description: 'Returns all offers on a listing. Seller only.' })
    @ApiParam({ name: 'listingId', description: 'UUID of the listing' })
    @ApiResponse({ status: 200, description: 'List of offers with buyer details' })
    @ApiResponse({ status: 403, description: 'Not the listing owner' })
    async getOffersForListing(
        @Param('listingId') listingId: string,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any[]>> {
        const offers = await this.offersService.getOffersForListing(listingId, user.id);
        return new StandardResponse(offers);
    }

    /**
     * Seller: Accept or reject an offer
     */
    @Patch(':id/respond')
    @ApiOperation({ summary: 'Respond to an offer', description: 'Accept or reject an offer. Seller only. Accepting auto-rejects competing offers.' })
    @ApiParam({ name: 'id', description: 'UUID of the offer' })
    @ApiResponse({ status: 200, description: 'Offer status updated' })
    @ApiResponse({ status: 400, description: 'Offer already responded to' })
    @ApiResponse({ status: 403, description: 'Not the listing owner' })
    async respondToOffer(
        @Param('id') id: string,
        @Body() dto: RespondOfferDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any>> {
        const offer = await this.offersService.respondToOffer(id, user.id, dto.status, dto.counterAmount);
        return new StandardResponse(offer);
    }

    /**
     * Seller: Get total pending offers count across all their listings
     * Used to drive the badge/dot on the Offers sidebar tab
     */
    @Get('pending-count')
    @ApiOperation({ summary: 'Get pending offers count', description: 'Returns the total number of PENDING offers across all listings owned by the seller.' })
    @ApiResponse({ status: 200, description: 'Pending offers count' })
    async getPendingOffersCount(
        @CurrentUser() user: any,
    ): Promise<StandardResponse<{ count: number }>> {
        const count = await this.offersService.getPendingOffersCount(user.id);
        return new StandardResponse({ count });
    }

    /**
     * Buyer: Withdraw a pending offer
     */
    @Patch(':id/withdraw')
    @ApiOperation({ summary: 'Withdraw an offer', description: 'Withdraw a pending offer. Buyer only.' })
    @ApiParam({ name: 'id', description: 'UUID of the offer' })
    @ApiResponse({ status: 200, description: 'Offer status updated to WITHDRAWN' })
    @ApiResponse({ status: 400, description: 'Offer not pending' })
    @ApiResponse({ status: 403, description: 'Not the offer owner' })
    async withdrawOffer(
        @Param('id') id: string,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any>> {
        const offer = await this.offersService.withdrawOffer(id, user.id);
        return new StandardResponse(offer);
    }

    /**
     * Buyer: Accept or reject a counter-offer from the seller
     */
    @Patch(':id/respond-counter')
    @ApiOperation({ summary: 'Respond to a counter-offer', description: 'Accept or reject a counter-offer. Buyer only.' })
    @ApiParam({ name: 'id', description: 'UUID of the offer' })
    async respondToCounterOffer(
        @Param('id') id: string,
        @Body() dto: RespondOfferDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<any>> {
        const offer = await this.offersService.respondToCounterOffer(id, user.id, dto.status);
        return new StandardResponse(offer);
    }
}
