import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DeliveryExpiryService {
  private readonly logger = new Logger(DeliveryExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Daily safety-net cron: cancels any PENDING delivery requests that have
   * passed their 48-hour expiry window. Runs at 3 AM UTC daily.
   *
   * DEL-09: handleDeliveryExpiry finds all PENDING requests with expiresAt lte now,
   * sets status CANCELLED, notifies each buyer.
   */
  @Cron('0 3 * * *')
  async handleDeliveryExpiry(): Promise<void> {
    const now = new Date();

    const expired = await this.prisma.deliveryRequest.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lte: now },
      },
      include: {
        listing: { select: { title: true } },
      },
    });

    if (expired.length === 0) {
      this.logger.log('[DeliveryExpiry] No expired delivery requests found.');
      return;
    }

    this.logger.log(
      `[DeliveryExpiry] Cancelling ${expired.length} expired delivery request(s).`,
    );

    for (const req of expired) {
      try {
        await this.prisma.deliveryRequest.update({
          where: { id: req.id },
          data: { status: 'CANCELLED', cancelledAt: now },
        });

        await this.notificationsService.create({
          userId: req.buyerId,
          type: 'DELIVERY_EXPIRED',
          title: 'Delivery Request Expired',
          message: `Your delivery request for ${(req as any).listing?.title ?? 'your listing'} expired — the seller did not respond within 48 hours. You may submit a new request.`,
          link: '/dashboard/buyer/offers',
          entityType: 'DELIVERY_REQUEST',
          entityId: req.id,
          actionType: 'EXPIRED',
          data: { deliveryRequestId: req.id },
        });
      } catch (err) {
        this.logger.error(
          `[DeliveryExpiry] Failed to cancel request ${req.id}: ${err?.message}`,
        );
      }
    }
  }
}
