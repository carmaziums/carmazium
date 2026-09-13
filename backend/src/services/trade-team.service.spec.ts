import { ForbiddenException } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { TradeTeamService, type TradeActorContext } from './trade-team.service';

describe('TradeTeamService', () => {
    let prisma: any;
    let service: TradeTeamService;

    const permission = {
        id: 'perm-1',
        dealerProfileId: 'dealer-1',
        email: 'driver@example.com',
        deliveryEnabled: true,
        inspectionEnabled: false,
        canQuote: true,
        canManage: true,
        canComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const membership = {
        id: 'staff-1',
        userId: 'staff-user',
        isActive: true,
        dealerProfile: {
            id: 'dealer-1',
            companyName: 'Example Motors',
            user: {
                id: 'business-owner',
                contractorProfile: {
                    id: 'business-provider',
                    userId: 'business-owner',
                    businessName: 'Example Motors',
                    capabilities: [{ serviceType: ServiceType.DELIVERY }],
                },
            },
        },
    };

    beforeEach(() => {
        prisma = {
            user: { findUnique: jest.fn() },
            dealerStaff: { findMany: jest.fn() },
            dealerProfile: { findUnique: jest.fn() },
            contractorProfile: { findUnique: jest.fn(), upsert: jest.fn() },
            contractorCapability: { findUnique: jest.fn(), upsert: jest.fn() },
            serviceJob: { findUnique: jest.fn() },
            $queryRaw: jest.fn(),
            $executeRaw: jest.fn().mockResolvedValue(1),
        };
        service = new TradeTeamService(prisma);
    });

    it('uses the dealership provider identity for authorised staff even if the staff user also has an independent provider profile', async () => {
        prisma.user.findUnique.mockResolvedValue({ email: 'Driver@Example.com' });
        prisma.dealerStaff.findMany.mockResolvedValue([membership]);
        prisma.$queryRaw.mockResolvedValueOnce([permission]);

        // If this gets called, the implementation would be at risk of routing
        // the job/payout through the employee's own provider account.
        prisma.contractorProfile.findUnique.mockResolvedValue({
            id: 'employee-provider',
            userId: 'staff-user',
            businessName: 'Driver Side Business',
            capabilities: [{ serviceType: ServiceType.DELIVERY }],
        });

        const actor = await service.tryResolveActor('staff-user');

        expect(actor).toMatchObject({
            actingUserId: 'staff-user',
            contractorProfileId: 'business-provider',
            businessOwnerUserId: 'business-owner',
            dealerProfileId: 'dealer-1',
            isStaff: true,
            allowedServiceTypes: [ServiceType.DELIVERY],
        });
        expect(prisma.contractorProfile.findUnique).not.toHaveBeenCalled();
    });

    it('does not grant a service type merely because the business is approved when staff was not assigned that service', async () => {
        prisma.user.findUnique.mockResolvedValue({ email: 'driver@example.com' });
        prisma.dealerStaff.findMany.mockResolvedValue([{
            ...membership,
            dealerProfile: {
                ...membership.dealerProfile,
                user: {
                    ...membership.dealerProfile.user,
                    contractorProfile: {
                        ...membership.dealerProfile.user.contractorProfile,
                        capabilities: [
                            { serviceType: ServiceType.DELIVERY },
                            { serviceType: ServiceType.INSPECTION },
                        ],
                    },
                },
            },
        }]);
        prisma.$queryRaw.mockResolvedValueOnce([permission]);

        const actor = await service.tryResolveActor('staff-user');
        expect(actor?.allowedServiceTypes).toEqual([ServiceType.DELIVERY]);

        prisma.serviceJob.findUnique.mockResolvedValue({ serviceType: ServiceType.INSPECTION });
        await expect(service.assertJobPermission(actor!, 'inspection-job', 'quote'))
            .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('enforces quote, manage and complete permissions independently', async () => {
        const actor: TradeActorContext = {
            actingUserId: 'staff-user',
            contractorProfileId: 'business-provider',
            businessOwnerUserId: 'business-owner',
            dealerProfileId: 'dealer-1',
            businessName: 'Example Motors',
            isStaff: true,
            allowedServiceTypes: [ServiceType.DELIVERY],
            canQuote: true,
            canManage: false,
            canComplete: false,
        };
        prisma.serviceJob.findUnique.mockResolvedValue({ serviceType: ServiceType.DELIVERY });

        await expect(service.assertJobPermission(actor, 'job-1', 'quote')).resolves.toBeTruthy();
        await expect(service.assertJobPermission(actor, 'job-1', 'manage')).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.assertJobPermission(actor, 'job-1', 'complete')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('revokes TradeXchange access immediately when the DealerStaff membership is inactive', async () => {
        prisma.user.findUnique.mockResolvedValue({ email: 'driver@example.com' });
        prisma.dealerStaff.findMany.mockResolvedValue([]);
        prisma.contractorProfile.findUnique.mockResolvedValue(null);

        await expect(service.tryResolveActor('staff-user')).resolves.toBeNull();
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('does not let an owner grant TradeXchange permissions to an email that is neither active staff nor a pending invite', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'dealer-1',
            companyName: 'Example Motors',
            user: {
                id: 'business-owner',
                stripeConnectAccountId: 'acct_business',
                stripeConnectOnboardingComplete: true,
                contractorProfile: null,
            },
            staff: [],
            invites: [],
        });

        await expect(service.setPermissions('business-owner', {
            email: 'stranger@example.com',
            deliveryEnabled: true,
            inspectionEnabled: false,
            canQuote: true,
            canManage: false,
            canComplete: false,
        })).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('accepts a pending invite for pre-assignment but access still depends on an active staff membership', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'dealer-1',
            companyName: 'Example Motors',
            user: {
                id: 'business-owner',
                stripeConnectAccountId: 'acct_business',
                stripeConnectOnboardingComplete: true,
                contractorProfile: null,
            },
            staff: [],
            invites: [{ email: 'newdriver@example.com', expiresAt: new Date(Date.now() + 86_400_000) }],
        });
        prisma.$queryRaw.mockResolvedValueOnce([{ ...permission, email: 'newdriver@example.com' }]);

        const saved = await service.setPermissions('business-owner', {
            email: 'newdriver@example.com',
            deliveryEnabled: true,
            inspectionEnabled: false,
            canQuote: true,
            canManage: true,
            canComplete: true,
        });
        expect(saved.email).toBe('newdriver@example.com');
    });

    it('writes staff actions against the employee and the business provider, never a staff payout profile', async () => {
        const actor: TradeActorContext = {
            actingUserId: 'staff-user',
            contractorProfileId: 'business-provider',
            businessOwnerUserId: 'business-owner',
            dealerProfileId: 'dealer-1',
            businessName: 'Example Motors',
            isStaff: true,
            allowedServiceTypes: [ServiceType.DELIVERY],
            canQuote: true,
            canManage: true,
            canComplete: true,
        };

        await service.logAction(actor, 'job-1', 'QUOTE_UPSERTED', { amountPence: 10000 });
        expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('preserves the existing independent provider flow when the user has no dealership TradeXchange assignment', async () => {
        prisma.user.findUnique.mockResolvedValue({ email: 'independent@example.com' });
        prisma.dealerStaff.findMany.mockResolvedValue([]);
        prisma.contractorProfile.findUnique.mockResolvedValue({
            id: 'independent-provider',
            userId: 'independent-user',
            businessName: 'Independent Transport',
            capabilities: [{ serviceType: ServiceType.DELIVERY }],
        });

        const actor = await service.tryResolveActor('independent-user');
        expect(actor).toMatchObject({
            contractorProfileId: 'independent-provider',
            businessOwnerUserId: 'independent-user',
            isStaff: false,
            canQuote: true,
            canManage: true,
            canComplete: true,
        });
    });
});
