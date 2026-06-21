import { DeliveryExpiryService } from './delivery-expiry.service';

/**
 * Unit test stub for DeliveryExpiryService — TDD RED state (Phase 15 Plan 01).
 *
 * Test FAILS in RED state because:
 * - Skeleton throws Error('not implemented') — method rejects instead of resolving.
 * - Test expects it to resolve AND asserts prisma was called — both fail.
 *
 * Plan 02 makes it GREEN by implementing the 48-hour expiry cron sweep.
 *
 * DEL-09 maps to requirement in REQUIREMENTS.md.
 */
describe('DeliveryExpiryService', () => {
  let service: DeliveryExpiryService;

  const mockPrisma = {
    deliveryRequest: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const mockNotifications = { create: jest.fn() };
  const mockEmail = { sendDeliveryExpiredEmail: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeliveryExpiryService();
  });

  describe('handleDeliveryExpiry', () => {
    it('DEL-09: cancels PENDING requests past expiresAt', async () => {
      // Real implementation: calls findMany(status=PENDING, expiresAt lte now) then cancels them
      // Skeleton: throws Error('not implemented') — rejects instead of resolving
      const now = new Date();
      const expiredRequest = {
        id: 'req-expired',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: 'PENDING',
        expiresAt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
        listing: { make: 'BMW', model: '3 Series' },
      };

      mockPrisma.deliveryRequest.findMany.mockResolvedValue([expiredRequest]);
      mockPrisma.deliveryRequest.updateMany.mockResolvedValue({ count: 1 });

      // Must resolve — skeleton rejects — RED state
      await service.handleDeliveryExpiry();

      // Once implemented: findMany called with PENDING + expiresAt lte now
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
