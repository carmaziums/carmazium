import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CreateDeliveryRequestDto } from './dto/create-delivery-request.dto';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Calculate road distance in miles using Google Maps Distance Matrix API.
   * Origin: seller's listing lat/lng. Destination: buyer's delivery postcode.
   */
  private async getRoadDistanceMiles(
    originLat: number,
    originLng: number,
    destinationPostcode: string,
  ): Promise<number> {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'Delivery distance service not configured.',
      );
    }

    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${originLat},${originLng}` +
      `&destinations=${encodeURIComponent(destinationPostcode)}` +
      `&units=imperial` +
      `&key=${apiKey}`;

    const { data } = await this.httpService.axiosRef.get(url);

    const element = data?.rows?.[0]?.elements?.[0];
    if (element?.status !== 'OK') {
      throw new BadRequestException(
        'Could not calculate road distance to that postcode.',
      );
    }

    // distance.value is always in metres regardless of units param
    return element.distance.value / 1609.344;
  }

  // ─── Buyer: Get a delivery cost estimate (no offer/request required) ───────
  // Added so mobile can show buyers the same server-computed figure
  // (real road distance x the listing's own deliveryPricePerMile) instead of
  // a client-side formula that didn't match what createDeliveryRequest
  // actually charges (mobile-production-readiness-plan.md F24).

  async getDeliveryQuote(
    listingId: string,
    postcode: string,
  ): Promise<{ distanceMiles: number; estimatedCostGbp: number; withinRadius: boolean; ratePerMile: number }> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        deliveryAvailable: true,
        deliveryMaxMiles: true,
        deliveryPricePerMile: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!listing || !listing.deliveryAvailable) {
      throw new NotFoundException(
        'Listing not found or delivery is not available for this listing.',
      );
    }

    if (listing.latitude == null) {
      throw new BadRequestException(
        'The seller has not set a location for this listing.',
      );
    }

    const distanceMiles = await this.getRoadDistanceMiles(
      listing.latitude,
      listing.longitude!,
      postcode,
    );

    const ratePerMile = listing.deliveryPricePerMile ? Number(listing.deliveryPricePerMile) : 0;
    const estimatedCostGbp = Math.round(distanceMiles * ratePerMile);
    const withinRadius = listing.deliveryMaxMiles == null || distanceMiles <= listing.deliveryMaxMiles;

    return { distanceMiles, estimatedCostGbp, withinRadius, ratePerMile };
  }

  // ─── Buyer: Create a delivery request ──────────────────────────────────────

  async createDeliveryRequest(
    dto: CreateDeliveryRequestDto,
    buyerId: string,
  ): Promise<any> {
    // 1. Fetch listing with seller
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      include: { seller: { select: { id: true } } },
    });

    if (!listing || !listing.deliveryAvailable) {
      throw new NotFoundException(
        'Listing not found or delivery is not available for this listing.',
      );
    }

    // 2. Verify buyer has at least one offer on this listing
    const buyerOffer = await this.prisma.offer.findFirst({
      where: { listingId: dto.listingId, buyerId },
    });

    if (!buyerOffer) {
      throw new BadRequestException(
        'You must have an offer on this listing to request delivery.',
      );
    }

    // 3. Check for existing active delivery request
    const existingRequest = await this.prisma.deliveryRequest.findFirst({
      where: {
        listingId: dto.listingId,
        buyerId,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
    });

    if (existingRequest) {
      throw new BadRequestException(
        'You already have an active delivery request for this listing.',
      );
    }

    // 4. Require seller location for distance calculation
    if (listing.latitude == null) {
      throw new BadRequestException(
        'The seller has not set a location for this listing.',
      );
    }

    // 5. Calculate road distance
    const distanceMiles = await this.getRoadDistanceMiles(
      listing.latitude,
      listing.longitude!,
      dto.deliveryAddress.postcode,
    );

    // 6. Radius check
    if (
      listing.deliveryMaxMiles != null &&
      distanceMiles > listing.deliveryMaxMiles
    ) {
      throw new BadRequestException(
        "Delivery is not available to your location — outside the seller's delivery radius.",
      );
    }

    // 7. Compute estimated cost
    const estimatedCostGbp = listing.deliveryPricePerMile
      ? Math.round(distanceMiles * Number(listing.deliveryPricePerMile))
      : 0;

    // 8. Get most recent offerId for FK
    const recentOffer = await this.prisma.offer.findFirst({
      where: { listingId: dto.listingId, buyerId },
      orderBy: { createdAt: 'desc' },
    });

    // 9. Create the delivery request
    const req = await this.prisma.deliveryRequest.create({
      data: {
        listingId: dto.listingId,
        offerId: recentOffer!.id,
        buyerId,
        sellerId: listing.seller!.id,
        deliveryAddress: dto.deliveryAddress as any,
        deliveryNotes: dto.deliveryNotes ?? null,
        distanceMiles,
        estimatedCostGbp,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    // 10. Notify seller
    try {
      await this.notificationsService.create({
        userId: listing.seller!.id,
        type: 'DELIVERY_REQUESTED',
        title: 'Delivery Request Received',
        message: `A buyer has requested delivery of your ${listing.title} to ${dto.deliveryAddress.postcode}. Estimated cost: £${estimatedCostGbp}. Accept or decline within 48 hours.`,
        link: '/dashboard/seller/offers',
        entityType: 'DELIVERY_REQUEST',
        entityId: req.id,
        actionType: 'CREATED',
        data: { listingId: dto.listingId, deliveryRequestId: req.id },
      });
    } catch (err) {
      console.error('[DeliveryService] Failed to notify seller of delivery request:', err);
    }

    return req;
  }

  // ─── Seller: Accept a delivery request ────────────────────────────────────

  async acceptDeliveryRequest(id: string, userId: string): Promise<any> {
    const request = await this.prisma.deliveryRequest.findFirst({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Delivery request not found.');
    }

    // Lazy expiry check
    if (request.status === 'PENDING' && request.expiresAt < new Date()) {
      await this.prisma.deliveryRequest.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      try {
        await this.notificationsService.create({
          userId: request.buyerId,
          type: 'DELIVERY_EXPIRED',
          title: 'Delivery Request Expired',
          message: 'Your delivery request has expired (48-hour window passed).',
          link: '/dashboard/buyer/offers',
          entityType: 'DELIVERY_REQUEST',
          entityId: id,
          actionType: 'EXPIRED',
          data: { deliveryRequestId: id },
        });
      } catch { /* non-fatal */ }
      throw new BadRequestException('This delivery request has expired.');
    }

    if (userId !== request.sellerId) {
      throw new ForbiddenException(
        'You are not the seller for this delivery request.',
      );
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot accept a delivery request with status ${request.status}.`,
      );
    }

    const updated = await this.prisma.deliveryRequest.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    try {
      await this.notificationsService.create({
        userId: request.buyerId,
        type: 'DELIVERY_ACCEPTED',
        title: 'Delivery Request Accepted',
        message: 'The seller has accepted your delivery request. Contact them via chat to arrange details.',
        link: '/dashboard/buyer/offers',
        entityType: 'DELIVERY_REQUEST',
        entityId: id,
        actionType: 'ACCEPTED',
        data: { deliveryRequestId: id },
      });
    } catch { /* non-fatal */ }

    return updated;
  }

  // ─── Seller: Decline a delivery request ───────────────────────────────────

  async declineDeliveryRequest(id: string, userId: string): Promise<any> {
    const request = await this.prisma.deliveryRequest.findFirst({
      where: { id },
      include: { listing: { select: { title: true } } },
    });

    if (!request) {
      throw new NotFoundException('Delivery request not found.');
    }

    if (userId !== request.sellerId) {
      throw new ForbiddenException(
        'You are not the seller for this delivery request.',
      );
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot decline a delivery request with status ${request.status}.`,
      );
    }

    const updated = await this.prisma.deliveryRequest.update({
      where: { id },
      data: { status: 'DECLINED', declinedAt: new Date() },
    });

    await this.notificationsService.create({
      userId: request.buyerId,
      type: 'DELIVERY_DECLINED',
      title: 'Delivery Request Declined',
      message: `The seller has declined your delivery request for ${(request as any).listing?.title ?? 'the listing'}. You may re-request after a period.`,
      link: '/dashboard/buyer/offers',
      entityType: 'DELIVERY_REQUEST',
      entityId: id,
      actionType: 'DECLINED',
      data: { deliveryRequestId: id },
    });

    return updated;
  }

  // ─── Buyer: Cancel a pending delivery request ──────────────────────────────

  async cancelDeliveryRequest(id: string, userId: string): Promise<any> {
    const request = await this.prisma.deliveryRequest.findFirst({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Delivery request not found.');
    }

    if (userId !== request.buyerId) {
      throw new ForbiddenException(
        'You are not the buyer for this delivery request.',
      );
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Can only cancel a pending delivery request.');
    }

    return this.prisma.deliveryRequest.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  // ─── Buyer: Mark delivery as complete ─────────────────────────────────────

  async completeDeliveryRequest(id: string, userId: string): Promise<any> {
    const request = await this.prisma.deliveryRequest.findFirst({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Delivery request not found.');
    }

    if (userId !== request.buyerId) {
      throw new ForbiddenException(
        'You are not the buyer for this delivery request.',
      );
    }

    if (request.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Can only mark an accepted delivery request as complete.',
      );
    }

    return this.prisma.deliveryRequest.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  // ─── Buyer: Get all their delivery requests ────────────────────────────────

  async getMyRequests(buyerId: string): Promise<any[]> {
    return this.prisma.deliveryRequest.findMany({
      where: { buyerId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            deliveryPricePerMile: true,
            deliveryMaxMiles: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Seller: Get all received delivery requests ────────────────────────────

  async getReceivedRequests(sellerId: string): Promise<any[]> {
    return this.prisma.deliveryRequest.findMany({
      where: { sellerId },
      include: {
        listing: {
          select: { id: true, title: true },
        },
        buyer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
