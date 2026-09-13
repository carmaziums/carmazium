import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CapabilityStatus, ServiceType, UserRole } from '@prisma/client';
import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
    const buildPrisma = () => ({
        user: { findFirst: jest.fn() },
        sellerProfile: {
            upsert: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        sellerReview: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        sale: { findFirst: jest.fn() },
        deliveryRequest: { findFirst: jest.fn() },
        serviceJob: { findFirst: jest.fn() },
        serviceRequest: { findFirst: jest.fn() },
        auction: { findFirst: jest.fn() },
        $transaction: jest.fn(async (items: any[]) => Promise.all(items)),
    });

    it('does not expose an unverified account as a public profile', async () => {
        const prisma = buildPrisma();
        // The verified/public filter means Prisma returns no row for an account
        // that has not completed email verification.
        prisma.user.findFirst.mockResolvedValue(null);

        const service = new ProfilesService(prisma as any);
        await expect(service.getPublicProfile('unverified-user'))
            .rejects.toBeInstanceOf(NotFoundException);

        expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                id: 'unverified-user',
                deletedAt: null,
                showPublicProfile: true,
                isEmailVerified: true,
            },
        }));
    });

    it('derives public service badges from the Partner business and approved capabilities', async () => {
        const prisma = buildPrisma();
        prisma.user.findFirst.mockResolvedValue({
            id: 'partner-1',
            firstName: 'A',
            lastName: 'Partner',
            profileImage: 'https://example.com/person.jpg',
            role: UserRole.DEALER,
            location: 'Birmingham',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            showPublicProfile: true,
            isEmailVerified: true,
            isAddressVerified: true,
            dealerProfile: {
                id: 'dealer-1',
                companyName: 'Test Motors',
                registrationNumber: '12345678',
                businessAddress: 'Birmingham',
                logo: 'https://example.com/logo.jpg',
                description: 'Dealer and vehicle services',
                phone: '07123456789',
                website: 'https://example.com',
                openingHours: null,
                isVerified: true,
                verificationDate: new Date(),
            },
            contractorProfile: {
                businessName: 'Test Motors',
                serviceArea: 'West Midlands',
                certifications: [],
                capabilities: [
                    { serviceType: ServiceType.DELIVERY, status: CapabilityStatus.APPROVED },
                    { serviceType: ServiceType.INSPECTION, status: CapabilityStatus.APPROVED },
                ],
            },
            financePartnerProfile: null,
            insurancePartnerProfile: null,
            sellerProfile: {
                id: 'review-profile-1',
                reviews: [{ rating: 5 }, { rating: 4 }],
            },
        });

        const service = new ProfilesService(prisma as any);
        const result = await service.getPublicProfile('partner-1');

        expect(result.displayName).toBe('Test Motors');
        expect(result.avatar).toBe('https://example.com/logo.jpg');
        expect(result.accountLabel).toBe('Partner Account');
        expect(result.badges).toEqual(expect.arrayContaining([
            { key: 'vehicle-dealer', label: 'Vehicle Dealer', verified: true },
            { key: 'service-delivery', label: 'Delivery & Recovery', verified: true },
            { key: 'service-inspection', label: 'Vehicle Inspection', verified: true },
        ]));
        expect(result.rating).toMatchObject({ average: 4.5, count: 2 });
    });

    it('does not claim Vehicle Dealer just because the reusable Partner business profile exists', async () => {
        const prisma = buildPrisma();
        prisma.user.findFirst.mockResolvedValue({
            id: 'partner-delivery-only',
            firstName: 'Delivery',
            lastName: 'Partner',
            profileImage: null,
            role: UserRole.DEALER,
            location: 'Birmingham',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            showPublicProfile: true,
            isEmailVerified: true,
            isAddressVerified: true,
            dealerProfile: {
                id: 'business-1',
                companyName: 'Delivery Partner Ltd',
                registrationNumber: null,
                businessAddress: 'Birmingham',
                logo: null,
                description: null,
                phone: null,
                website: null,
                openingHours: null,
                isVerified: false,
                verificationDate: null,
            },
            contractorProfile: {
                businessName: 'Delivery Partner Ltd',
                serviceArea: 'West Midlands',
                certifications: [],
                capabilities: [
                    { serviceType: ServiceType.DELIVERY, status: CapabilityStatus.APPROVED },
                ],
            },
            financePartnerProfile: null,
            insurancePartnerProfile: null,
            sellerProfile: null,
        });

        const service = new ProfilesService(prisma as any);
        const result = await service.getPublicProfile('partner-delivery-only');

        expect(result.badges).toContainEqual({
            key: 'service-delivery',
            label: 'Delivery & Recovery',
            verified: true,
        });
        expect(result.badges).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ key: 'vehicle-dealer' }),
        ]));
    });

    it('blocks a review when the two profiles have no completed CarMazium interaction', async () => {
        const prisma = buildPrisma();
        prisma.user.findFirst.mockResolvedValue({ id: 'target-1' });
        prisma.sale.findFirst.mockResolvedValue(null);
        prisma.deliveryRequest.findFirst.mockResolvedValue(null);
        prisma.serviceJob.findFirst.mockResolvedValue(null);
        prisma.serviceRequest.findFirst.mockResolvedValue(null);
        prisma.auction.findFirst.mockResolvedValue(null);

        const service = new ProfilesService(prisma as any);

        await expect(service.submitReview('reviewer-1', 'target-1', { rating: 5, comment: 'Excellent service' }))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.sellerReview.create).not.toHaveBeenCalled();
    });

    it('creates an eligible review and refreshes the shared seller reliability score', async () => {
        const prisma = buildPrisma();
        prisma.user.findFirst.mockResolvedValue({ id: 'target-1' });
        prisma.sale.findFirst.mockResolvedValue({ listingId: 'listing-1' });
        prisma.deliveryRequest.findFirst.mockResolvedValue(null);
        prisma.serviceJob.findFirst.mockResolvedValue(null);
        prisma.serviceRequest.findFirst.mockResolvedValue(null);
        prisma.auction.findFirst.mockResolvedValue(null);
        prisma.sellerProfile.upsert.mockResolvedValue({ id: 'review-profile-1', userId: 'target-1' });
        prisma.sellerReview.findFirst.mockResolvedValue(null);
        prisma.sellerReview.create.mockResolvedValue({
            id: 'review-1',
            sellerId: 'review-profile-1',
            reviewerId: 'reviewer-1',
            listingId: 'listing-1',
            rating: 5,
            comment: 'Excellent service',
        });
        prisma.sellerProfile.findUnique.mockResolvedValue({
            id: 'review-profile-1',
            responseRate: 100,
            totalListings: 1,
            totalSales: 1,
            reviews: [{ rating: 5 }],
        });
        prisma.sellerProfile.update.mockResolvedValue({});

        const service = new ProfilesService(prisma as any);
        const result = await service.submitReview('reviewer-1', 'target-1', {
            rating: 5,
            comment: 'Excellent service',
        });

        expect(result.id).toBe('review-1');
        expect(prisma.sellerReview.create).toHaveBeenCalledWith({
            data: {
                sellerId: 'review-profile-1',
                reviewerId: 'reviewer-1',
                listingId: 'listing-1',
                rating: 5,
                comment: 'Excellent service',
            },
        });
        expect(prisma.sellerProfile.update).toHaveBeenCalledWith({
            where: { id: 'review-profile-1' },
            data: { reliabilityScore: 5 },
        });
    });

    it('attributes a completed TradeXchange service review to the Partner business owner profile', async () => {
        const prisma = buildPrisma();
        prisma.user.findFirst.mockResolvedValue({ id: 'partner-owner' });
        prisma.sale.findFirst.mockResolvedValue(null);
        prisma.deliveryRequest.findFirst.mockResolvedValue(null);
        prisma.serviceJob.findFirst.mockResolvedValue({ id: 'service-job-1' });
        prisma.serviceRequest.findFirst.mockResolvedValue(null);
        prisma.auction.findFirst.mockResolvedValue(null);
        prisma.sellerProfile.upsert.mockResolvedValue({ id: 'partner-reputation', userId: 'partner-owner' });
        prisma.sellerReview.findFirst.mockResolvedValue(null);
        prisma.sellerReview.create.mockResolvedValue({ id: 'review-service-1' });
        prisma.sellerProfile.findUnique.mockResolvedValue({
            id: 'partner-reputation',
            responseRate: 100,
            totalListings: 0,
            totalSales: 0,
            reviews: [{ rating: 5 }],
        });
        prisma.sellerProfile.update.mockResolvedValue({});

        const service = new ProfilesService(prisma as any);
        await service.submitReview('customer-1', 'partner-owner', {
            rating: 5,
            comment: 'Excellent delivery service',
        });

        expect(prisma.serviceJob.findFirst).toHaveBeenCalledWith({
            where: {
                status: { in: ['COMPLETED', 'RELEASED'] },
                OR: [
                    { customerId: 'customer-1', contractor: { is: { userId: 'partner-owner' } } },
                    { customerId: 'partner-owner', contractor: { is: { userId: 'customer-1' } } },
                ],
            },
            select: { id: true },
        });
        expect(prisma.sellerProfile.upsert).toHaveBeenCalledWith({
            where: { userId: 'partner-owner' },
            update: {},
            create: { userId: 'partner-owner' },
        });
        expect(prisma.sellerReview.create).toHaveBeenCalledWith({
            data: {
                sellerId: 'partner-reputation',
                reviewerId: 'customer-1',
                listingId: null,
                rating: 5,
                comment: 'Excellent delivery service',
            },
        });
    });
});
