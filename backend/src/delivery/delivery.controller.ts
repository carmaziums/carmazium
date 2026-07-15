import {
  Controller,
  Post,
  Patch,
  Get,
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
  ApiParam,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryRequestDto } from './dto/create-delivery-request.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';

@ApiTags('Delivery Requests')
@Controller('delivery-requests')
@UseGuards(SessionAuthGuard)
@ApiCookieAuth()
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  /**
   * Buyer: Get a delivery cost estimate for a listing + postcode, without
   * creating a request (no existing offer required — this is a preview).
   * GET /delivery-requests/quote?listingId=...&postcode=...
   */
  @Get('quote')
  @ApiOperation({ summary: 'Get delivery cost estimate', description: 'Real road-distance x per-mile-rate estimate for a listing, computed the same way createDeliveryRequest does — no offer or request required.' })
  @ApiResponse({ status: 200, description: 'Estimate returned' })
  @ApiResponse({ status: 400, description: 'Seller has not set a location, or the postcode could not be resolved' })
  @ApiResponse({ status: 404, description: 'Listing not found or delivery not available' })
  async getQuote(
    @Query('listingId') listingId: string,
    @Query('postcode') postcode: string,
  ): Promise<StandardResponse<any>> {
    const quote = await this.deliveryService.getDeliveryQuote(listingId, postcode);
    return new StandardResponse(quote);
  }

  /**
   * Buyer: Create a delivery request for a listing (requires an existing offer)
   * POST /delivery-requests
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create delivery request', description: 'Buyer requests delivery for a listing. Must have an existing offer. Distance is calculated server-side via Google Maps.' })
  @ApiResponse({ status: 201, description: 'Delivery request created' })
  @ApiResponse({ status: 400, description: 'No offer on listing, duplicate active request, or out-of-radius' })
  @ApiResponse({ status: 404, description: 'Listing not found or delivery not available' })
  async createDeliveryRequest(
    @Body() dto: CreateDeliveryRequestDto,
    @CurrentUser() user: any,
  ): Promise<StandardResponse<any>> {
    const request = await this.deliveryService.createDeliveryRequest(dto, user.id);
    return new StandardResponse(request);
  }

  /**
   * Seller: Accept a delivery request
   * PATCH /delivery-requests/:id/accept
   */
  @Patch(':id/accept')
  @ApiOperation({ summary: 'Accept delivery request', description: 'Seller accepts a pending delivery request.' })
  @ApiParam({ name: 'id', description: 'UUID of the delivery request' })
  @ApiResponse({ status: 200, description: 'Delivery request accepted' })
  @ApiResponse({ status: 400, description: 'Request not in PENDING status or expired' })
  @ApiResponse({ status: 403, description: 'Not the seller for this request' })
  @ApiResponse({ status: 404, description: 'Delivery request not found' })
  async acceptDeliveryRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<StandardResponse<any>> {
    const request = await this.deliveryService.acceptDeliveryRequest(id, user.id);
    return new StandardResponse(request);
  }

  /**
   * Seller: Decline a delivery request
   * PATCH /delivery-requests/:id/decline
   */
  @Patch(':id/decline')
  @ApiOperation({ summary: 'Decline delivery request', description: 'Seller declines a pending delivery request. Buyer is notified.' })
  @ApiParam({ name: 'id', description: 'UUID of the delivery request' })
  @ApiResponse({ status: 200, description: 'Delivery request declined' })
  @ApiResponse({ status: 400, description: 'Request not in PENDING status' })
  @ApiResponse({ status: 403, description: 'Not the seller for this request' })
  @ApiResponse({ status: 404, description: 'Delivery request not found' })
  async declineDeliveryRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<StandardResponse<any>> {
    const request = await this.deliveryService.declineDeliveryRequest(id, user.id);
    return new StandardResponse(request);
  }

  /**
   * Buyer: Cancel a pending delivery request
   * PATCH /delivery-requests/:id/cancel
   */
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel delivery request', description: 'Buyer cancels their pending delivery request.' })
  @ApiParam({ name: 'id', description: 'UUID of the delivery request' })
  @ApiResponse({ status: 200, description: 'Delivery request cancelled' })
  @ApiResponse({ status: 400, description: 'Request not in PENDING status' })
  @ApiResponse({ status: 403, description: 'Not the buyer for this request' })
  @ApiResponse({ status: 404, description: 'Delivery request not found' })
  async cancelDeliveryRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<StandardResponse<any>> {
    const request = await this.deliveryService.cancelDeliveryRequest(id, user.id);
    return new StandardResponse(request);
  }

  /**
   * Buyer: Mark delivery as complete (ACCEPTED → COMPLETED)
   * PATCH /delivery-requests/:id/complete
   */
  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete delivery request', description: 'Buyer marks an accepted delivery as complete (received).' })
  @ApiParam({ name: 'id', description: 'UUID of the delivery request' })
  @ApiResponse({ status: 200, description: 'Delivery request completed' })
  @ApiResponse({ status: 400, description: 'Request not in ACCEPTED status' })
  @ApiResponse({ status: 403, description: 'Not the buyer for this request' })
  @ApiResponse({ status: 404, description: 'Delivery request not found' })
  async completeDeliveryRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<StandardResponse<any>> {
    const request = await this.deliveryService.completeDeliveryRequest(id, user.id);
    return new StandardResponse(request);
  }

  /**
   * Buyer: Get all their delivery requests (keyed by listingId on frontend)
   * GET /delivery-requests/my
   */
  @Get('my')
  @ApiOperation({ summary: 'Get my delivery requests', description: 'Returns all delivery requests submitted by the authenticated buyer.' })
  @ApiResponse({ status: 200, description: 'List of buyer delivery requests with listing details' })
  async getMyRequests(
    @CurrentUser() user: any,
  ): Promise<StandardResponse<any[]>> {
    const requests = await this.deliveryService.getMyRequests(user.id);
    return new StandardResponse(requests);
  }

  /**
   * Seller: Get all delivery requests received across their listings
   * GET /delivery-requests/received
   */
  @Get('received')
  @ApiOperation({ summary: 'Get received delivery requests', description: 'Returns all delivery requests received by the authenticated seller.' })
  @ApiResponse({ status: 200, description: 'List of received delivery requests with buyer and listing details' })
  async getReceivedRequests(
    @CurrentUser() user: any,
  ): Promise<StandardResponse<any[]>> {
    const requests = await this.deliveryService.getReceivedRequests(user.id);
    return new StandardResponse(requests);
  }
}
