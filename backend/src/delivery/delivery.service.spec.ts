import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

/**
 * Unit test stubs for DeliveryService — TDD GREEN state (Phase 15 Plan 02).
 *
 * All 8 tests pass GREEN because the real implementation is in place.
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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: EmailService, useValue: mockEmail },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<DeliveryService>(DeliveryService);
  });

  // ---------------------------------------------------------------------------
  // createDeliveryRequest
  // ---------------------------------------------------------------------------
  describe('createDeliveryRequest', () => {
    const dto: any = {
      listingId: 'listing-1',
      deliveryAddress: { street: '1 High St', city: 'London', postcode: 'SW1A 1AA' },
      deliveryNotes: undefined,
    };
    const buyerId = 'buyer-1';

    it('DEL-01: rejects if buyer has no offer on listing', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        deliveryAvailable: true,
        sellerId: 'seller-1',
        seller: { id: 'seller-1' },
        deliveryMaxMiles: null,
        deliveryPricePerMile: 0.5,
        latitude: 51.5074,
        longitude: -0.1278,
        title: 'BMW 3 Series',
      });
      mockPrisma.offer.findFirst.mockResolvedValue(null);

      await expect(service.createDeliveryRequest(dto, buyerId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('DEL-02: rejects duplicate active request', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        deliveryAvailable: true,
        sellerId: 'seller-1',
        seller: { id: 'seller-1' },
        deliveryMaxMiles: null,
        deliveryPricePerMile: 0.5,
        latitude: 51.5074,
        longitude: -0.1278,
        title: 'BMW 3 Series',
      });
      mockPrisma.offer.findFirst.mockResolvedValueOnce({ id: 'offer-1' });
      mockPrisma.deliveryRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
      });

      await expect(service.createDeliveryRequest(dto, buyerId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('DEL-03: rejects out-of-radius request', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        deliveryAvailable: true,
        sellerId: 'seller-1',
        seller: { id: 'seller-1' },
        deliveryMaxMiles: 50,
        deliveryPricePerMile: 0.5,
        latitude: 51.5074,
        longitude: -0.1278,
        title: 'BMW 3 Series',
      });
      mockPrisma.offer.findFirst.mockResolvedValueOnce({ id: 'offer-1' });
      mockPrisma.deliveryRequest.findFirst.mockResolvedValue(null);
      mockConfig.get.mockReturnValue('test-api-key');
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
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        deliveryAvailable: true,
        sellerId: 'seller-1',
        seller: { id: 'seller-1' },
        deliveryMaxMiles: null,
        deliveryPricePerMile: 0.5,
        latitude: 51.5074,
        longitude: -0.1278,
        title: 'BMW 3 Series',
      });
      mockPrisma.offer.findFirst
        .mockResolvedValueOnce({ id: 'offer-1' })  // buyer has offer
        .mockResolvedValueOnce({ id: 'offer-1' }); // most recent offerId
      mockPrisma.deliveryRequest.findFirst.mockResolvedValue(null);
      mockConfig.get.mockReturnValue('test-api-key');
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
      mockNotifications.create.mockResolvedValue({});

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
      const requestId = 'req-1';
      const nonSellerId = 'buyer-1';
      mockPrisma.deliveryRequest.findFirst.mockResolvedValue({
        id: requestId,
        sellerId: 'seller-1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
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
      const requestId = 'req-1';
      const sellerId = 'seller-1';
      mockPrisma.deliveryRequest.findFirst.mockResolvedValue({
        id: requestId,
        sellerId,
        buyerId: 'buyer-1',
        status: 'PENDING',
        listing: { title: 'BMW 3 Series' },
      });
      mockPrisma.deliveryRequest.update.mockResolvedValue({
        id: requestId,
        status: 'DECLINED',
      });
      mockNotifications.create.mockResolvedValue({});

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
