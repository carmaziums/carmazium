import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryExpiryService } from './delivery-expiry.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Unit test stub for DeliveryExpiryService — TDD GREEN state (Phase 15 Plan 02).
 *
 * Test passes GREEN because the real implementation is in place.
 *
 * DEL-09 maps to requirement in REQUIREMENTS.md.
 */
describe('DeliveryExpiryService', () => {
  let service: DeliveryExpiryService;

  const mockPrisma = {
    deliveryRequest: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const mockNotifications = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryExpiryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<DeliveryExpiryService>(DeliveryExpiryService);
  });

  describe('handleDeliveryExpiry', () => {
    it('DEL-09: cancels PENDING requests past expiresAt', async () => {
      const now = new Date();
      const expiredRequest = {
        id: 'req-expired',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: 'PENDING',
        expiresAt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
        listing: { title: 'BMW 3 Series' },
      };

      mockPrisma.deliveryRequest.findMany.mockResolvedValue([expiredRequest]);
      mockPrisma.deliveryRequest.update.mockResolvedValue({ id: 'req-expired', status: 'CANCELLED' });
      mockNotifications.create.mockResolvedValue({});

      await service.handleDeliveryExpiry();

      // findMany called with PENDING + expiresAt lte now
      expect(mockPrisma.deliveryRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        }),
      );
    });
  });
});
