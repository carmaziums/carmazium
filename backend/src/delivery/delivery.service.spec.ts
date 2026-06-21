import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DeliveryService } from './delivery.service';

/**
 * Unit test stubs for DeliveryService — TDD RED state (Phase 15 Plan 01).
 *
 * All 8 tests FAIL in RED state because:
 * - Tests that guard → assert specific NestJS exception class (BadRequestException/ForbiddenException)
 *   but skeleton throws Error('not implemented'), which does not match instanceof check.
 * - Tests that store data → assert method resolves with a record, but skeleton throws.
 *
 * Plan 02 makes them GREEN by implementing real logic.
 *
 * DEL-01 through DEL-08 map to requirements in REQUIREMENTS.md.
 */
describe('DeliveryService', () => {
  let service: DeliveryService;

  const mockPrisma = {
    deliveryRequest: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    offer: { findFirst: jest.fn() },
    listing: { findUnique: jest.fn() },
  };
  const mockNotifications = { create: jest.fn() };
  const mockEmail = { sendDeliveryRequestEmail: jest.fn() };
  const mockHttpService = { axiosRef: { get: jest.fn() } };
  const mockConfig = { get: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeliveryService();
  });

  // ---------------------------------------------------------------------------
  // createDeliveryRequest
  // ---------------------------------------------------------------------------
  describe('createDeliveryRequest', () => {
    const dto = {
      listingId: 'listing-1',
      deliveryAddress: { street: '1 High St', city: 'London', postcode: 'SW1A 1AA' },
      deliveryNotes: null,
    };
    const buyerId = 'buyer-1';

    it('DEL-01: rejects if buyer has no offer on listing', async () => {
      // Real implementation: throws BadRequestException when offer not found
      // Skeleton: throws Error('not implemented') — does NOT match BadRequestException
      mockPrisma.offer.findFirst.mockResolvedValue(null);

      await expect(service.createDeliveryRequest(dto, buyerId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('DEL-02: rejects duplicate active request', async () => {
      // Real implementation: throws BadRequestException for duplicate PENDING/ACCEPTED request
      // Skeleton: throws Error('not implemented') — does NOT match BadRequestException
      mockPrisma.offer.findFirst.mockResolvedValue({ id: 'offer-1' });
      mockPrisma.deliveryRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
      });

      await expect(service.createDeliveryRequest(dto, buyerId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('DEL-03: rejects out-of-radius request', async () => {
      // Real implementation: throws BadRequestException when distance > deliveryMaxMiles
      // Skeleton: throws Error('not implemented') — does NOT match BadRequestException
      mockPrisma.offer.findFirst.mockResolvedValue({ id: 'offer-1' });
      mockPrisma.deliveryRequest.findFirst.mockResolvedValue(null);
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        deliveryMaxMiles: 50,
        deliveryPricePerMile: 0.5,
        latitude: 51.5074,
        longitude: -0.1278,
      });
      mockHttpService.axiosRef.get.mockResolvedValue({
        data: {
          rows: [{ elements: [{ distance: { value: 120000 }, status: 'OK' }] }],
          status: 'OK',
        },
      });

      await expect(service.createDeliveryRequest(dto, buyerId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('DEL-04: stores distance and cost', async () => {
      // Real implementation: resolves with created DeliveryRequest including distanceMiles + estimatedCostGbp
      // Skeleton: throws Error('not implemented') — rejects instead of resolving
      mockPrisma.offer.findFirst.mockResolvedValue({ id: 'offer-1' });
      mockPrisma.deliveryRequest.findFirst.mockResolvedValue(null);
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        deliveryMaxMiles: null,
        deliveryPricePerMile: 0.5,
        latitude: 51.5074,
        longitude: -0.1278,
      });
      mockHttpService.axiosRef.get.mockResolvedValue({
        data: {
          rows: [{ elements: [{ distance: { value: 40234 }, status: 'OK' }] }],
          status: 'OK',
        },
      });
      mockPrisma.deliveryRequest.create.mockResolvedValue({
        id: 'req-new',
        distanceMiles: 25,
        estimatedCostGbp: 13,
      });

      // This must RESOLVE — but skeleton REJECTS — RED state
      const result = await service.createDeliveryRequest(dto, buyerId);
      expect(result).toHaveProperty('distanceMiles');
      expect(result).toHaveProperty('estimatedCostGbp');
    });
  });

  // ---------------------------------------------------------------------------
  // acceptDeliveryRequest
  // ---------------------------------------------------------------------------
  describe('acceptDeliveryRequest', () => {
    it('DEL-05: throws ForbiddenException for non-seller', async () => {
      // Real implementation: throws ForbiddenException when userId !== request.sellerId
      // Skeleton: throws Error('not implemented') — does NOT match ForbiddenException
      const requestId = 'req-1';
      const nonSellerId = 'buyer-1';
      mockPrisma.deliveryRequest.findFirst.mockResolvedValue({
        id: requestId,
        sellerId: 'seller-1',
        status: 'PENDING',
      });

      await expect(service.acceptDeliveryRequest(requestId, nonSellerId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // declineDeliveryRequest
  // ---------------------------------------------------------------------------
  describe('declineDeliveryRequest', () => {
    it('DEL-06: sends buyer notification on decline', async () => {
      // Real implementation: resolves after calling notificationsService.create(buyerId)
      // Skeleton: throws Error('not implemented') — rejects instead of resolving
      const requestId = 'req-1';
      const sellerId = 'seller-1';
      mockPrisma.deliveryRequest.findFirst.mockResolvedValue({
        id: requestId,
        sellerId,
        buyerId: 'buyer-1',
        status: 'PENDING',
      });

      // Must resolve — skeleton rejects — RED state
      await service.declineDeliveryRequest(requestId, sellerId);

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'buyer-1' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // cancelDeliveryRequest
  // ---------------------------------------------------------------------------
  describe('cancelDeliveryRequest', () => {
    it('DEL-07: rejects non-PENDING status', async () => {
      // Real implementation: throws BadRequestException when status !== PENDING
      // Skeleton: throws Error('not implemented') — does NOT match BadRequestException
      const requestId = 'req-1';
      const buyerId = 'buyer-1';
      mockPrisma.deliveryRequest.findFirst.mockResolvedValue({
        id: requestId,
        buyerId,
        status: 'ACCEPTED',
      });

      await expect(service.cancelDeliveryRequest(requestId, buyerId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // completeDeliveryRequest
  // ---------------------------------------------------------------------------
  describe('completeDeliveryRequest', () => {
    it('DEL-08: rejects non-ACCEPTED status', async () => {
      // Real implementation: throws BadRequestException when status !== ACCEPTED
      // Skeleton: throws Error('not implemented') — does NOT match BadRequestException
      const requestId = 'req-1';
      const buyerId = 'buyer-1';
      mockPrisma.deliveryRequest.findFirst.mockResolvedValue({
        id: requestId,
        buyerId,
        status: 'PENDING',
      });

      await expect(service.completeDeliveryRequest(requestId, buyerId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
