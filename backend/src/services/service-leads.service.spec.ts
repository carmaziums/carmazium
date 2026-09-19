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
                findMany: jest.fn().mockResolvedValue([]),
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
            $transaction: jest.fn(async (work: any) =>
                typeof work === 'function' ? work(prisma) : Promise.all(work),
            ),
            $executeRaw: jest.fn().mockResolvedValue(1),
            $queryRaw: jest.fn().mockResolvedValue([]),
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
                reviewedAt: new Date(),
                leadNationwide: true,
                leadPostcodeAreas: [],
                leadMinVehicleValuePence: null,
                leadMaxVehicleValuePence: null,
                leadMinVehicleYear: null,
                leadMaxVehicleMileage: null,
                leadMinAnnualIncomePence: null,
                leadFinanceTermMinMonths: null,
                leadFinanceTermMaxMonths: null,
                leadWarrantyLevels: [],
                leadWarrantyMinMonths: null,
                leadWarrantyMaxMonths: null,
                contractor: { userId: 'provider-user-1', rating: 0, totalReviews: 0 },
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
            vehicleRegistration: 'AB12 CDE',
            vehicleValuePence: 1_500_000,
            postcode: 'B1 1AA',
            depositPence: 100000,
            termMonths: 48,
            monthlyBudgetPence: 35_000,
            employmentStatus: 'Employed',
        } as any);

        expect(prisma.serviceLead.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                customerId: 'customer-1',
                serviceType: ServiceType.FINANCE,
                depositPence: 100000,
                termMonths: 48,
                consentToProviderContact: true,
                recipients: {
                    create: [expect.objectContaining({
                        contractorId: 'provider-profile-1',
                        status: 'NEW',
                        matchSource: 'AUTO',
                        matchReason: expect.stringContaining('Nationwide'),
                    })],
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

    it('rejects a Finance enquiry that lacks the minimum underwriting context', async () => {
        prisma.user.findUnique.mockResolvedValue({
            email: 'buyer@example.com',
            firstName: 'Buyer',
            lastName: 'One',
            phone: '07000000000',
            postcode: 'B1 1AA',
        });

        await expect(service.create('customer-1', {
            serviceType: ServiceType.FINANCE,
            vehicleRegistration: 'AB12 CDE',
            vehicleValuePence: 1_500_000,
            postcode: 'B1 1AA',
            termMonths: 48,
            consentToProviderContact: true,
        } as any)).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.serviceLead.create).not.toHaveBeenCalled();
    });

    it('enforces the five-active-enquiry limit inside the create transaction', async () => {
        prisma.user.findUnique.mockResolvedValue({
            email: 'buyer@example.com',
            firstName: 'Buyer',
            lastName: 'One',
            phone: '07000000000',
            postcode: 'B1 1AA',
        });
        prisma.serviceLead.count.mockResolvedValue(5);

        await expect(service.create('customer-1', {
            serviceType: ServiceType.WARRANTY,
            vehicleRegistration: 'AB12 CDE',
            warrantyMonths: 12,
            warrantyLevel: 'Comprehensive',
            consentToProviderContact: true,
        } as any)).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.$executeRaw).toHaveBeenCalled();
        expect(prisma.serviceLead.create).not.toHaveBeenCalled();
    });

    it('does not approve FINANCE until its verification evidence is complete', async () => {
        prisma.contractorCapability.findUnique.mockResolvedValue({
            id: 'cap-1',
            serviceType: ServiceType.FINANCE,
            leadNationwide: true,
            leadPostcodeAreas: [],
            verificationStatus: 'IN_REVIEW',
            verificationCompletedAt: null,
            verificationExpiresAt: null,
            contractor: {
                userId: 'provider-1',
                user: { id: 'provider-1' },
            },
        });
        prisma.$queryRaw.mockResolvedValue([]);

        await expect(service.reviewLeadCapability(
            'admin-1',
            'cap-1',
            { status: CapabilityStatus.APPROVED } as any,
        )).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.contractorCapability.update).not.toHaveBeenCalled();
    });

    it('allows admin approval of FINANCE without requiring Stripe Connect', async () => {
        prisma.contractorCapability.findUnique.mockResolvedValue({
            id: 'cap-1',
            serviceType: ServiceType.FINANCE,
            leadNationwide: true,
            leadPostcodeAreas: [],
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
        prisma.$queryRaw.mockResolvedValue([
            {
                id: 'e-business',
                evidenceType: 'BUSINESS_IDENTITY',
                evidenceStatus: 'APPROVED',
                evidenceExpiresAt: null,
                createdAt: new Date(),
            },
            {
                id: 'e-regulatory',
                evidenceType: 'FINANCE_REGULATORY_AUTHORITY',
                evidenceStatus: 'APPROVED',
                evidenceExpiresAt: null,
                createdAt: new Date(),
            },
        ]);

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

    it('shows a matched provider the full consented lead detail and marks NEW as VIEWED', async () => {
        const expiresAt = new Date(Date.now() + 60_000);
        prisma.serviceLead.findUnique.mockResolvedValue({
            id: 'lead-1',
            customerId: 'customer-1',
            serviceType: ServiceType.FINANCE,
            status: 'OPEN',
            fullName: 'Buyer One',
            email: 'buyer@example.com',
            phone: '07000000000',
            postcode: 'B1 1AA',
            vehicleRegistration: 'AB12CDE',
            vehicleMake: 'BMW',
            vehicleModel: '320d',
            vehicleYear: 2019,
            vehicleMileage: 55_000,
            vehicleValuePence: 1_500_000,
            depositPence: 200_000,
            termMonths: 48,
            monthlyBudgetPence: 35_000,
            employmentStatus: 'Employed',
            annualIncomePence: 3_600_000,
            warrantyMonths: null,
            warrantyLevel: null,
            summary: 'Looking for a competitive option.',
            expiresAt,
        });
        prisma.contractorProfile.findUnique.mockResolvedValue({
            id: 'provider-profile-1',
            deletedAt: null,
            capabilities: [{ serviceType: ServiceType.FINANCE }],
        });
        prisma.serviceLead.findMany.mockResolvedValue([]);
        prisma.serviceLeadRecipient.findUnique.mockResolvedValue({
            id: 'recipient-1',
            leadId: 'lead-1',
            contractorId: 'provider-profile-1',
            status: 'NEW',
            headline: null,
            message: null,
            productName: null,
            indicativePricePence: null,
            representativeApr: null,
            termMonths: null,
            viewedAt: null,
            respondedAt: null,
        });
        prisma.serviceLeadRecipient.update.mockResolvedValue({});

        const detail = await service.providerLead('provider-1', 'lead-1');

        expect(detail).toMatchObject({
            id: 'lead-1',
            fullName: 'Buyer One',
            email: 'buyer@example.com',
            phone: '07000000000',
            depositPence: 200_000,
            monthlyBudgetPence: 35_000,
            employmentStatus: 'Employed',
            annualIncomePence: 3_600_000,
            recipientStatus: 'VIEWED',
        });
        expect(prisma.serviceLeadRecipient.update).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                leadId_contractorId: {
                    leadId: 'lead-1',
                    contractorId: 'provider-profile-1',
                },
            },
            data: expect.objectContaining({ status: 'VIEWED' }),
        }));
    });

    it('does not expose provider detail when the caller lacks the matching approved capability', async () => {
        prisma.serviceLead.findUnique.mockResolvedValue({
            id: 'lead-1',
            serviceType: ServiceType.FINANCE,
            status: 'OPEN',
            expiresAt: new Date(Date.now() + 60_000),
        });
        prisma.contractorProfile.findUnique.mockResolvedValue({
            id: 'warranty-profile',
            deletedAt: null,
            capabilities: [],
        });

        await expect(service.providerLead('warranty-user', 'lead-1'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.serviceLeadRecipient.findUnique).not.toHaveBeenCalled();
    });

    it('expires stale enquiries and closes NEW/VIEWED recipient rows together', async () => {
        prisma.serviceLead.findMany.mockResolvedValue([{ id: 'lead-expired' }]);
        prisma.serviceLead.updateMany.mockResolvedValue({ count: 1 });
        prisma.serviceLeadRecipient.updateMany.mockResolvedValue({ count: 2 });

        const expired = await service.expireOldLeads();

        expect(expired).toBe(1);
        expect(prisma.serviceLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ id: { in: ['lead-expired'] }, status: 'OPEN' }),
            data: expect.objectContaining({ status: 'EXPIRED', closedAt: expect.any(Date) }),
        }));
        expect(prisma.serviceLeadRecipient.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                leadId: { in: ['lead-expired'] },
                status: { in: ['NEW', 'VIEWED'] },
            },
            data: expect.objectContaining({ status: 'CLOSED' }),
        }));
    });

    it('does not claim an enquiry was viewed when a provider responds without opening its detail', async () => {
        prisma.contractorProfile.findUnique.mockResolvedValue({
            id: 'finance-profile',
            businessName: 'Finance Co',
            deletedAt: null,
            capabilities: [{ serviceType: ServiceType.FINANCE }],
        });
        prisma.serviceLead.findUnique.mockResolvedValue({
            id: 'lead-1',
            customerId: 'customer-1',
            serviceType: ServiceType.FINANCE,
            status: 'OPEN',
            expiresAt: new Date(Date.now() + 60_000),
        });
        prisma.serviceLeadRecipient.findUnique.mockResolvedValue({
            id: 'recipient-1',
            status: 'NEW',
            viewedAt: null,
        });
        prisma.serviceLeadRecipient.update.mockResolvedValue({ id: 'recipient-1', status: 'RESPONDED' });

        await service.respond('finance-user', 'lead-1', {
            headline: 'Indicative option',
            message: 'We can discuss this with you.',
        } as any);

        const data = prisma.serviceLeadRecipient.update.mock.calls[0][0].data;
        expect(data.status).toBe('RESPONDED');
        expect(data.respondedAt).toBeInstanceOf(Date);
        expect(data).not.toHaveProperty('viewedAt');
    });

    it('rejects finance-only response fields on Warranty enquiries', async () => {
        prisma.contractorProfile.findUnique.mockResolvedValue({
            id: 'warranty-profile',
            businessName: 'Warranty Co',
            deletedAt: null,
            capabilities: [{ serviceType: ServiceType.WARRANTY }],
        });
        prisma.serviceLead.findUnique.mockResolvedValue({
            id: 'lead-1',
            customerId: 'customer-1',
            serviceType: ServiceType.WARRANTY,
            status: 'OPEN',
            expiresAt: new Date(Date.now() + 60_000),
        });

        await expect(service.respond('warranty-user', 'lead-1', {
            headline: 'Warranty option',
            message: 'Cover available.',
            representativeApr: 7.9,
        } as any)).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.serviceLeadRecipient.update).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only provider responses in the backend', async () => {
        prisma.contractorProfile.findUnique.mockResolvedValue({
            id: 'finance-profile',
            businessName: 'Finance Co',
            deletedAt: null,
            capabilities: [{ serviceType: ServiceType.FINANCE }],
        });
        prisma.serviceLead.findUnique.mockResolvedValue({
            id: 'lead-1',
            customerId: 'customer-1',
            serviceType: ServiceType.FINANCE,
            status: 'OPEN',
            expiresAt: new Date(Date.now() + 60_000),
        });

        await expect(service.respond('finance-user', 'lead-1', {
            headline: '   ',
            message: '   ',
        } as any)).rejects.toBeInstanceOf(BadRequestException);
    });
});
