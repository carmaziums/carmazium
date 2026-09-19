import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { TradeTeamService, type TradeActorContext } from './trade-team.service';

describe('TradeTeamService', () => {
    let prisma: any;
    let service: TradeTeamService;

    const permission = {
        id: 'perm-1',
        dealerProfileId: 'dealer-1',
        staffUserId: 'staff-user',
        email: 'driver@example.com',
        deliveryEnabled: true,
        inspectionEnabled: false,
        canView: true,
        canChat: true,
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
            contractorProfile: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
            contractorCapability: { findUnique: jest.fn(), upsert: jest.fn() },
            serviceJob: { findUnique: jest.fn() },
            $queryRaw: jest.fn(),
            $executeRaw: jest.fn().mockResolvedValue(1),
        };
        service = new TradeTeamService(prisma, { create: jest.fn().mockResolvedValue({}) } as any);
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

        prisma.serviceJob.findUnique.mockResolvedValue({ serviceType: ServiceType.INSPECTION, customerId: 'customer-1' });
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
            canView: true,
            canChat: true,
            canQuote: true,
            canManage: false,
            canComplete: false,
        };
        prisma.serviceJob.findUnique.mockResolvedValue({ serviceType: ServiceType.DELIVERY, customerId: 'customer-1' });

        await expect(service.assertJobPermission(actor, 'job-1', 'quote')).resolves.toBeTruthy();
        await expect(service.assertJobPermission(actor, 'job-1', 'manage')).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.assertJobPermission(actor, 'job-1', 'complete')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does not let staff quote on a job posted by the dealership owner', async () => {
        const actor: TradeActorContext = {
            actingUserId: 'staff-user',
            contractorProfileId: 'business-provider',
            businessOwnerUserId: 'business-owner',
            dealerProfileId: 'dealer-1',
            businessName: 'Example Motors',
            isStaff: true,
            allowedServiceTypes: [ServiceType.DELIVERY],
            canView: true,
            canChat: true,
            canQuote: true,
            canManage: true,
            canComplete: true,
        };
        prisma.serviceJob.findUnique.mockResolvedValue({
            serviceType: ServiceType.DELIVERY,
            customerId: 'business-owner',
        });

        await expect(service.assertJobPermission(actor, 'job-owner-posted', 'quote'))
            .rejects.toBeInstanceOf(BadRequestException);
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
            canView: true,
            canChat: true,
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
            canView: true,
            canChat: true,
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
            canView: true,
            canChat: true,
            canQuote: true,
            canManage: true,
            canComplete: true,
        };

        await service.logAction(actor, 'job-1', 'QUOTE_UPSERTED', { amountPence: 10000 });
        expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it.each([ServiceType.FINANCE, ServiceType.WARRANTY])(
        'lets a Partner business apply for %s without changing account role',
        async (serviceType) => {
            prisma.dealerProfile.findUnique.mockResolvedValue({
                id: 'dealer-1',
                companyName: 'Example Motors',
                phone: '01234 567890',
                businessAddress: 'Birmingham',
                user: {
                    id: 'business-owner',
                    stripeConnectAccountId: null,
                    stripeConnectOnboardingComplete: false,
                    contractorProfile: null,
                },
                staff: [],
                invites: [],
            });
            prisma.contractorProfile.upsert.mockResolvedValue({
                id: 'business-provider',
                userId: 'business-owner',
                businessName: 'Example Motors',
            });
            prisma.contractorCapability.findUnique.mockResolvedValue(null);
            prisma.contractorCapability.upsert.mockResolvedValue({
                id: `cap-${serviceType.toLowerCase()}`,
                contractorId: 'business-provider',
                serviceType,
                status: 'PENDING',
            });

            const result = await service.applyBusinessCapability('business-owner', serviceType);

            expect(result).toMatchObject({ serviceType, status: 'PENDING' });
            expect(prisma.contractorProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { userId: 'business-owner' },
            }));
            expect(prisma.contractorCapability.upsert).toHaveBeenCalledWith(expect.objectContaining({
                where: {
                    contractorId_serviceType: {
                        contractorId: 'business-provider',
                        serviceType,
                    },
                },
            }));
        },
    );

    it('enforces view and chat separately from quote/manage/complete permissions', async () => {
        const actor: TradeActorContext = {
            actingUserId: 'staff-user',
            contractorProfileId: 'business-provider',
            businessOwnerUserId: 'business-owner',
            dealerProfileId: 'dealer-1',
            businessName: 'Example Motors',
            isStaff: true,
            allowedServiceTypes: [ServiceType.DELIVERY],
            canView: true,
            canChat: false,
            canQuote: false,
            canManage: false,
            canComplete: false,
        };
        prisma.serviceJob.findUnique.mockResolvedValue({
            serviceType: ServiceType.DELIVERY,
            customerId: 'customer-1',
        });

        await expect(service.assertJobPermission(actor, 'job-1', 'view')).resolves.toBeTruthy();
        await expect(service.assertJobPermission(actor, 'job-1', 'chat')).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.assertJobPermission(actor, 'job-1', 'quote')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does not expose a provider-side job identity to staff without canView', async () => {
        prisma.user.findUnique.mockResolvedValue({ email: 'driver@example.com' });
        prisma.dealerStaff.findMany.mockResolvedValue([membership]);
        prisma.$queryRaw.mockResolvedValueOnce([{ ...permission, canView: false, canChat: false }]);
        prisma.serviceJob.findUnique.mockResolvedValue({ serviceType: ServiceType.DELIVERY });

        await expect(service.contractorProfileForJob('staff-user', 'job-1')).resolves.toBeNull();
    });

    it('rejects string booleans at the service boundary instead of treating "false" as true', async () => {
        await expect(service.setPermissions('business-owner', {
            email: 'driver@example.com',
            deliveryEnabled: 'false',
            inspectionEnabled: false,
            canView: false,
            canChat: false,
            canQuote: false,
            canManage: false,
            canComplete: false,
        } as any)).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.dealerProfile.findUnique).not.toHaveBeenCalled();
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('requires canView before chat, quote, manage or complete can be granted', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'dealer-1',
            companyName: 'Example Motors',
            phone: '01234 567890',
            businessAddress: 'Birmingham',
            user: {
                id: 'business-owner',
                stripeConnectAccountId: 'acct_business',
                stripeConnectOnboardingComplete: true,
                contractorProfile: null,
            },
            staff: [{
                user: {
                    id: 'staff-user',
                    email: 'driver@example.com',
                    firstName: 'Drive',
                    lastName: 'One',
                },
            }],
            invites: [],
        });

        await expect(service.setPermissions('business-owner', {
            email: 'driver@example.com',
            deliveryEnabled: true,
            inspectionEnabled: false,
            canView: false,
            canChat: true,
            canQuote: false,
            canManage: false,
            canComplete: false,
        } as any)).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('binds an active staff permission to the immutable user id rather than relying on email alone', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'dealer-1',
            companyName: 'Example Motors',
            phone: '01234 567890',
            businessAddress: 'Birmingham',
            user: {
                id: 'business-owner',
                stripeConnectAccountId: 'acct_business',
                stripeConnectOnboardingComplete: true,
                contractorProfile: null,
            },
            staff: [{
                user: {
                    id: 'staff-user',
                    email: 'driver@example.com',
                    firstName: 'Drive',
                    lastName: 'One',
                },
            }],
            invites: [],
        });
        prisma.$queryRaw
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ ...permission, staffUserId: 'staff-user' }]);

        const saved = await service.setPermissions('business-owner', {
            email: 'driver@example.com',
            deliveryEnabled: true,
            inspectionEnabled: false,
            canView: true,
            canChat: true,
            canQuote: true,
            canManage: true,
            canComplete: false,
        } as any);

        expect(saved.staffUserId).toBe('staff-user');
        expect(prisma.user.update).toBeUndefined();
    });

    it('stores a full permission snapshot with every staff job action', async () => {
        const actor: TradeActorContext = {
            actingUserId: 'staff-user',
            contractorProfileId: 'business-provider',
            businessOwnerUserId: 'business-owner',
            dealerProfileId: 'dealer-1',
            businessName: 'Example Motors',
            isStaff: true,
            allowedServiceTypes: [ServiceType.DELIVERY],
            canView: true,
            canChat: true,
            canQuote: true,
            canManage: false,
            canComplete: false,
        };

        await service.logAction(actor, 'job-1', 'QUOTE_UPSERTED', { amountPence: 10000 });

        expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
        const query = prisma.$executeRaw.mock.calls[0][0];
        expect(JSON.stringify(query)).toContain('permissionSnapshot');
        expect(JSON.stringify(query)).toContain('canChat');
    });

    it('keeps payout controls owner-only: team permissions never update user payout fields', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'dealer-1',
            companyName: 'Example Motors',
            phone: '01234 567890',
            businessAddress: 'Birmingham',
            user: {
                id: 'business-owner',
                stripeConnectAccountId: 'acct_business',
                stripeConnectOnboardingComplete: true,
                contractorProfile: null,
            },
            staff: [{
                user: {
                    id: 'staff-user',
                    email: 'driver@example.com',
                    firstName: 'Drive',
                    lastName: 'One',
                },
            }],
            invites: [],
        });
        prisma.$queryRaw
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ ...permission, staffUserId: 'staff-user' }]);

        await service.setPermissions('business-owner', {
            email: 'driver@example.com',
            deliveryEnabled: true,
            inspectionEnabled: false,
            canView: true,
            canChat: true,
            canQuote: true,
            canManage: false,
            canComplete: false,
        } as any);

        expect(prisma.user.update).toBeUndefined();
        expect(prisma.contractorProfile.update).not.toHaveBeenCalled();
    });

    it('heals dealership-owned ContractorProfile identity from DealerProfile when team settings are loaded', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'dealer-1',
            companyName: 'Canonical Motors Ltd',
            phone: '01234 567890',
            businessAddress: '1 Canonical Road, Birmingham',
            user: {
                id: 'business-owner',
                stripeConnectAccountId: 'acct_business',
                stripeConnectOnboardingComplete: true,
                contractorProfile: {
                    id: 'business-provider',
                    businessName: 'Old Name',
                    phone: null,
                    serviceArea: null,
                    capabilities: [],
                },
            },
            staff: [],
            invites: [],
        });
        prisma.contractorProfile.update.mockResolvedValue({
            id: 'business-provider',
            businessName: 'Canonical Motors Ltd',
            phone: '01234 567890',
            serviceArea: '1 Canonical Road, Birmingham',
            capabilities: [],
        });
        prisma.$queryRaw.mockResolvedValue([]);

        await service.listTeam('business-owner');

        expect(prisma.contractorProfile.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'business-provider' },
            data: {
                businessName: 'Canonical Motors Ltd',
                phone: '01234 567890',
                serviceArea: '1 Canonical Road, Birmingham',
            },
        }));
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
            canView: true,
            canChat: true,
            canQuote: true,
            canManage: true,
            canComplete: true,
        });
    });
});
