import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
            $queryRaw: jest.fn(),
            $executeRaw: jest.fn(),
            $transaction: jest.fn(),
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

    it('does not use the enquiry path for DELIVERY or INSPECTION', async () => {
        await expect(service.create('customer-1', {
            serviceType: ServiceType.DELIVERY,
            consentToProviderContact: true,
        } as any)).rejects.toBeInstanceOf(BadRequestException);
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

        const result = await service.reviewLeadCapability('admin-1', 'cap-1', { status: CapabilityStatus.APPROVED } as any);

        expect(result).toEqual({ id: 'cap-1', status: CapabilityStatus.APPROVED });
        expect(prisma.contractorCapability.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'cap-1' },
            data: expect.objectContaining({ status: CapabilityStatus.APPROVED, reviewedById: 'admin-1' }),
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
