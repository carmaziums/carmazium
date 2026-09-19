import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { CapabilityStatus, ServiceType } from '@prisma/client';
import { ServiceLeadsService } from './service-leads.service';

describe('ServiceLeadsService', () => {
    let prisma: any;
    let notifications: any;
    let service: ServiceLeadsService;

    beforeEach(() => {
        prisma = {
            user: { findUnique: jest.fn() },
            contractorProfile: { findUnique: jest.fn() },
            contractorCapability: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
            },
            serviceLead: {
                create: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            serviceLeadRecipient: {
                createMany: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn(),
            },
            $transaction: jest.fn(async (callback: any) => callback(prisma)),
        };
        notifications = { create: jest.fn().mockResolvedValue({}) };
        service = new ServiceLeadsService(prisma, notifications);
    });

    it('rejects an enquiry when provider-contact consent was not given', async () => {
        await expect(service.create('customer-1', {
            serviceType: ServiceType.FINANCE,
            consentToProviderContact: false,
        } as any)).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects WARRANTY without enough vehicle identity', async () => {
        await expect(service.create('customer-1', {
            serviceType: ServiceType.WARRANTY,
            consentToProviderContact: true,
        } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks new Finance enquiries when the emergency switch is false', async () => {
        const previous = process.env.NEXT_PUBLIC_FEATURE_FINANCE_SERVICES;
        process.env.NEXT_PUBLIC_FEATURE_FINANCE_SERVICES = 'false';
        try {
            await expect(service.create('customer-1', {
                serviceType: ServiceType.FINANCE,
                consentToProviderContact: true,
            } as any)).rejects.toBeInstanceOf(ServiceUnavailableException);
        } finally {
            if (previous === undefined) delete process.env.NEXT_PUBLIC_FEATURE_FINANCE_SERVICES;
            else process.env.NEXT_PUBLIC_FEATURE_FINANCE_SERVICES = previous;
        }
    });

    it('does not use the enquiry path for DELIVERY or INSPECTION', async () => {
        await expect(service.create('customer-1', {
            serviceType: ServiceType.DELIVERY,
            consentToProviderContact: true,
        } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates Finance enquiries through Prisma models and matches approved providers', async () => {
        prisma.user.findUnique.mockResolvedValue({
            email: 'buyer@example.com',
            firstName: 'Buyer',
            lastName: 'One',
            phone: '07000000000',
            postcode: 'B1 1AA',
        });
        prisma.contractorCapability.findMany.mockResolvedValue([
            {
                contractorId: 'provider-profile-1',
                contractor: { userId: 'provider-user-1' },
            },
        ]);
        prisma.serviceLead.create.mockResolvedValue({
            id: 'lead-1',
            customerId: 'customer-1',
            serviceType: ServiceType.FINANCE,
            status: 'OPEN',
            listingId: null,
            fullName: 'Buyer One',
            email: 'buyer@example.com',
            phone: '07000000000',
            postcode: 'B1 1AA',
            consentToProviderContact: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            _count: { recipients: 1 },
        });

        const result = await service.create('customer-1', {
            serviceType: ServiceType.FINANCE,
            consentToProviderContact: true,
            depositPence: 100000,
            termMonths: 48,
        } as any);

        expect(prisma.serviceLead.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                customerId: 'customer-1',
                serviceType: ServiceType.FINANCE,
                depositPence: 100000,
                termMonths: 48,
                consentToProviderContact: true,
                recipients: {
                    create: [{
                        contractorId: 'provider-profile-1',
                        status: 'NEW',
                    }],
                },
            }),
            include: { _count: { select: { recipients: true } } },
        }));
        expect(result).toEqual(expect.objectContaining({
            id: 'lead-1',
            recipientCount: 1,
        }));
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'provider-user-1',
            entityId: 'lead-1',
        }));
    });

    it('allows admin approval of FINANCE without requiring Stripe Connect', async () => {
        prisma.contractorCapability.findUnique.mockResolvedValue({
            id: 'cap-1',
            serviceType: ServiceType.FINANCE,
            contractor: {
                userId: 'provider-1',
                user: {
                    id: 'provider-1',
                    stripeConnectAccountId: null,
                    stripeConnectOnboardingComplete: false,
                },
            },
        });
        prisma.contractorCapability.update.mockResolvedValue({ id: 'cap-1', status: CapabilityStatus.APPROVED });

        const result = await service.reviewLeadCapability(
            'admin-1',
            'cap-1',
            { status: CapabilityStatus.APPROVED } as any,
        );

        expect(result).toEqual({ id: 'cap-1', status: CapabilityStatus.APPROVED });
        expect(prisma.contractorCapability.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'cap-1' },
            data: expect.objectContaining({
                status: CapabilityStatus.APPROVED,
                reviewedById: 'admin-1',
            }),
        }));
    });

    it('does not let a provider without an approved lead capability open the inbox', async () => {
        prisma.contractorProfile.findUnique.mockResolvedValue({
            id: 'provider-profile-1',
            deletedAt: null,
            capabilities: [],
        });
        await expect(service.inbox('provider-1')).rejects.toBeInstanceOf(ForbiddenException);
    });
});
