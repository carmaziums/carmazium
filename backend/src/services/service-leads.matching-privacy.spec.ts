import { BadRequestException } from '@nestjs/common';
import { CapabilityStatus, ServiceType } from '@prisma/client';
import { MAX_LEAD_RECIPIENTS, ServiceLeadsService } from './service-leads.service';

describe('TradeXchange Finance/Warranty matching and privacy', () => {
    let prisma: any;
    let notifications: any;
    let service: ServiceLeadsService;

    const candidate = (id: string, overrides: Record<string, any> = {}) => ({
        contractorId: id,
        reviewedAt: new Date('2026-09-01T00:00:00Z'),
        leadNationwide: false,
        leadPostcodeAreas: ['B'],
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
        contractor: {
            userId: `user-${id}`,
            rating: 4.5,
            totalReviews: 10,
        },
        ...overrides,
    });

    const openLead = (overrides: Record<string, any> = {}) => ({
        id: 'lead-1',
        customerId: 'customer-1',
        serviceType: ServiceType.FINANCE,
        status: 'OPEN',
        listingId: null,
        vehicleRegistration: 'AB12CDE',
        vehicleMake: 'BMW',
        vehicleModel: '320d',
        vehicleYear: 2020,
        vehicleMileage: 45_000,
        vehicleValuePence: 1_500_000,
        fullName: 'Cara Customer',
        email: 'cara@example.com',
        phone: '07000000000',
        postcode: 'B1 1AA',
        summary: 'Please call after 5pm',
        depositPence: 200_000,
        termMonths: 48,
        monthlyBudgetPence: 35_000,
        employmentStatus: 'Employed',
        annualIncomePence: 3_600_000,
        warrantyMonths: null,
        warrantyLevel: null,
        consentToProviderContact: true,
        consentRecordedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        closedAt: null,
        anonymizedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });

    beforeEach(() => {
        prisma = {
            user: {
                findUnique: jest.fn().mockResolvedValue({
                    email: 'cara@example.com',
                    firstName: 'Cara',
                    lastName: 'Customer',
                    phone: '07000000000',
                    postcode: 'B1 1AA',
                }),
            },
            contractorCapability: {
                findMany: jest.fn().mockResolvedValue([]),
                findUnique: jest.fn(),
                update: jest.fn(),
            },
            contractorProfile: {
                findUnique: jest.fn(),
            },
            serviceLead: {
                create: jest.fn().mockImplementation(async ({ data }: any) => ({
                    id: 'lead-1',
                    ...data,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    _count: { recipients: data.recipients?.create?.length ?? 0 },
                })),
                findMany: jest.fn().mockResolvedValue([]),
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            serviceLeadRecipient: {
                findMany: jest.fn().mockResolvedValue([]),
                findUnique: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
                createMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
        };
        prisma.$transaction = jest.fn(async (work: any) =>
            typeof work === 'function' ? work(prisma) : Promise.all(work),
        );
        prisma.$queryRaw = jest.fn().mockResolvedValue([]);

        notifications = { create: jest.fn().mockResolvedValue({}) };
        service = new ServiceLeadsService(prisma, notifications);
    });

    it('caps automatic sharing at five relevant providers', async () => {
        prisma.contractorCapability.findMany.mockResolvedValue(
            Array.from({ length: 7 }, (_, index) => candidate(`provider-${index + 1}`)),
        );

        const result = await service.create('customer-1', {
            serviceType: ServiceType.FINANCE,
            vehicleRegistration: 'AB12 CDE',
            vehicleYear: 2020,
            vehicleMileage: 45_000,
            vehicleValuePence: 1_500_000,
            postcode: 'B1 1AA',
            annualIncomePence: 3_600_000,
            termMonths: 48,
            employmentStatus: 'Employed',
            consentToProviderContact: true,
        } as any);

        expect(result.recipientCount).toBe(MAX_LEAD_RECIPIENTS);
        const createArg = prisma.serviceLead.create.mock.calls[0][0];
        expect(createArg.data.recipients.create).toHaveLength(MAX_LEAD_RECIPIENTS);
        expect(createArg.data.recipients.create.every((row: any) => row.matchSource === 'AUTO')).toBe(true);
        expect(notifications.create).toHaveBeenCalledTimes(MAX_LEAD_RECIPIENTS);
    });

    it('filters by postcode area and configured product eligibility', async () => {
        prisma.contractorCapability.findMany.mockResolvedValue([
            candidate('correct'),
            candidate('wrong-area', { leadPostcodeAreas: ['M'] }),
            candidate('too-expensive', { leadMinVehicleValuePence: 2_000_000 }),
            candidate('income-too-low', { leadMinAnnualIncomePence: 4_000_000 }),
            candidate('wrong-term', { leadFinanceTermMinMonths: 60 }),
        ]);

        await service.create('customer-1', {
            serviceType: ServiceType.FINANCE,
            vehicleRegistration: 'AB12 CDE',
            postcode: 'B1 1AA',
            vehicleValuePence: 1_500_000,
            annualIncomePence: 3_600_000,
            termMonths: 48,
            employmentStatus: 'Employed',
            consentToProviderContact: true,
        } as any);

        const createArg = prisma.serviceLead.create.mock.calls[0][0];
        expect(createArg.data.recipients.create).toHaveLength(1);
        expect(createArg.data.recipients.create[0]).toEqual(expect.objectContaining({
            contractorId: 'correct',
            matchReason: expect.stringContaining('Postcode area B'),
        }));
    });

    it('does not backfill historical open leads when a provider opens the inbox', async () => {
        prisma.contractorProfile.findUnique.mockResolvedValue({
            id: 'provider-profile',
            deletedAt: null,
            capabilities: [{ serviceType: ServiceType.FINANCE }],
        });
        prisma.serviceLeadRecipient.findMany.mockResolvedValue([]);

        const inbox = await service.inbox('provider-user', ServiceType.FINANCE);

        expect(inbox).toEqual([]);
        expect(prisma.serviceLeadRecipient.createMany).not.toHaveBeenCalled();
        expect(prisma.contractorCapability.findMany).not.toHaveBeenCalled();
    });

    it('returns a redacted provider inbox summary without customer contact or income', async () => {
        prisma.contractorProfile.findUnique.mockResolvedValue({
            id: 'provider-profile',
            deletedAt: null,
            capabilities: [{ serviceType: ServiceType.FINANCE }],
        });
        prisma.serviceLeadRecipient.findMany.mockResolvedValue([{
            id: 'recipient-1',
            leadId: 'lead-1',
            contractorId: 'provider-profile',
            status: 'NEW',
            headline: null,
            message: null,
            productName: null,
            indicativePricePence: null,
            representativeApr: null,
            termMonths: null,
            matchedAt: new Date(),
            matchSource: 'AUTO',
            viewedAt: null,
            respondedAt: null,
            lead: openLead(),
        }]);

        const [summary] = await service.inbox('provider-user', ServiceType.FINANCE);

        expect(summary).toEqual(expect.objectContaining({
            id: 'lead-1',
            postcode: 'B',
            recipientStatus: 'NEW',
            vehicleRegistration: 'AB12CDE',
            termMonths: 48,
        }));
        expect(summary).not.toHaveProperty('customerId');
        expect(summary).not.toHaveProperty('fullName');
        expect(summary).not.toHaveProperty('email');
        expect(summary).not.toHaveProperty('phone');
        expect(summary).not.toHaveProperty('summary');
        expect(summary).not.toHaveProperty('employmentStatus');
        expect(summary).not.toHaveProperty('annualIncomePence');
        expect(prisma.serviceLeadRecipient.updateMany).not.toHaveBeenCalled();
    });

    it('records contact disclosure only when a matched provider opens the detail', async () => {
        prisma.serviceLead.findUnique.mockResolvedValue(openLead());
        prisma.contractorProfile.findUnique.mockResolvedValue({
            id: 'provider-profile',
            deletedAt: null,
            capabilities: [{ serviceType: ServiceType.FINANCE }],
        });
        prisma.serviceLeadRecipient.findUnique.mockResolvedValue({
            id: 'recipient-1',
            leadId: 'lead-1',
            contractorId: 'provider-profile',
            status: 'NEW',
            headline: null,
            message: null,
            productName: null,
            indicativePricePence: null,
            representativeApr: null,
            termMonths: null,
            matchedAt: new Date(),
            matchSource: 'AUTO',
            matchReason: 'Postcode area B and configured eligibility matched',
            viewedAt: null,
            contactDisclosedAt: null,
            respondedAt: null,
        });
        prisma.serviceLeadRecipient.update.mockResolvedValue({});

        const detail = await service.providerLead('provider-user', 'lead-1');

        expect(detail).toEqual(expect.objectContaining({
            fullName: 'Cara Customer',
            email: 'cara@example.com',
            phone: '07000000000',
            annualIncomePence: 3_600_000,
            recipientStatus: 'VIEWED',
        }));
        expect(detail).not.toHaveProperty('customerId');
        expect(detail).not.toHaveProperty('consentRecordedAt');
        expect(prisma.serviceLeadRecipient.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'recipient-1', status: 'NEW' },
            data: expect.objectContaining({
                status: 'VIEWED',
                viewedAt: expect.any(Date),
                contactDisclosedAt: expect.any(Date),
            }),
        }));
    });

    it('explicit admin rematch adds only eligible providers and records ADMIN_REMATCH', async () => {
        prisma.serviceLead.findUnique.mockResolvedValue({
            ...openLead(),
            recipients: [{ contractorId: 'already-matched' }],
        });
        prisma.contractorCapability.findMany.mockResolvedValue([
            candidate('new-provider'),
            candidate('wrong-area', { leadPostcodeAreas: ['M'] }),
        ]);
        prisma.serviceLeadRecipient.createMany.mockResolvedValue({ count: 1 });

        const result = await service.adminRematch('lead-1');

        expect(result).toEqual({
            added: 1,
            recipientCount: 2,
            recipientLimit: MAX_LEAD_RECIPIENTS,
        });
        expect(prisma.serviceLeadRecipient.createMany).toHaveBeenCalledWith({
            data: [expect.objectContaining({
                leadId: 'lead-1',
                contractorId: 'new-provider',
                matchSource: 'ADMIN_REMATCH',
            })],
            skipDuplicates: true,
        });
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user-new-provider',
            actionType: 'ADMIN_REMATCH',
        }));
    });

    it('automatically rematches still-open enquiries using AUTO_REMATCH', async () => {
        prisma.$queryRaw.mockResolvedValue([{ id: 'lead-1' }, { id: 'lead-2' }]);
        const rematch = jest.spyOn(service, 'adminRematch')
            .mockResolvedValueOnce({ added: 1, recipientCount: 1, recipientLimit: MAX_LEAD_RECIPIENTS })
            .mockResolvedValueOnce({ added: 0, recipientCount: 5, recipientLimit: MAX_LEAD_RECIPIENTS });

        const result = await service.rematchOpenLeads(ServiceType.FINANCE);

        expect(rematch).toHaveBeenNthCalledWith(1, 'lead-1', 'AUTO_REMATCH', true);
        expect(rematch).toHaveBeenNthCalledWith(2, 'lead-2', 'AUTO_REMATCH', true);
        expect(result).toEqual({ scanned: 2, leadsUpdated: 1, recipientsAdded: 1 });
    });

    it('queries only open enquiries that still have recipient capacity', async () => {
        prisma.$queryRaw.mockResolvedValue([]);

        await service.rematchOpenLeads(ServiceType.WARRANTY, 25);

        const query = prisma.$queryRaw.mock.calls[0][0];
        const rendered = String(query?.strings?.join('?') ?? query);
        expect(rendered).toContain('SELECT COUNT(*)');
        expect(rendered).toContain('service_lead_recipients');
        expect(rendered).toContain('ORDER BY l."createdAt" ASC');
    });

    it('automatic rematch records AUTO_REMATCH on new recipient rows', async () => {
        prisma.serviceLead.findUnique.mockResolvedValue({
            ...openLead(),
            recipients: [],
        });
        prisma.contractorCapability.findMany.mockResolvedValue([candidate('new-provider')]);
        prisma.serviceLeadRecipient.createMany.mockResolvedValue({ count: 1 });

        const result = await service.adminRematch('lead-1', 'AUTO_REMATCH');

        expect(result.added).toBe(1);
        expect(prisma.serviceLeadRecipient.createMany).toHaveBeenCalledWith({
            data: [expect.objectContaining({
                leadId: 'lead-1',
                contractorId: 'new-provider',
                matchSource: 'AUTO_REMATCH',
            })],
            skipDuplicates: true,
        });
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user-new-provider',
            actionType: 'AUTO_REMATCH',
        }));
    });

    it('anonymises closed/expired enquiry identity after the retention period', async () => {
        prisma.serviceLead.findMany.mockResolvedValue([{ id: 'old-lead' }]);

        await service.privacyMaintenance();

        expect(prisma.serviceLeadRecipient.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { leadId: { in: ['old-lead'] } },
            data: { headline: null, message: null },
        }));
        expect(prisma.serviceLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: { in: ['old-lead'] }, anonymizedAt: null },
            data: expect.objectContaining({
                customerId: null,
                listingId: null,
                vehicleRegistration: null,
                fullName: null,
                email: null,
                phone: null,
                postcode: null,
                summary: null,
                employmentStatus: null,
                annualIncomePence: null,
                consentToProviderContact: false,
                consentRecordedAt: null,
                anonymizedAt: expect.any(Date),
            }),
        }));
    });

    it('refuses approval of Finance/Warranty capability until matching coverage is configured', async () => {
        prisma.contractorCapability.findUnique.mockResolvedValue({
            id: 'cap-1',
            serviceType: ServiceType.FINANCE,
            leadNationwide: false,
            leadPostcodeAreas: [],
            contractor: {
                userId: 'provider-user',
                user: { id: 'provider-user' },
            },
        });

        await expect(service.reviewLeadCapability('admin-1', 'cap-1', {
            status: CapabilityStatus.APPROVED,
        } as any)).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.contractorCapability.update).not.toHaveBeenCalled();
    });
});
