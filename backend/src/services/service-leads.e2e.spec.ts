/**
 * Journey-level regression coverage for the enquiry half of TradeXchange.
 *
 * Finance and Warranty intentionally do not use the paid ServiceJob engine.
 * These tests exercise the real ServiceLeadsService against an in-memory
 * Prisma-shaped store so matching, inbox visibility, responses and customer
 * closure are tested as one sequence rather than isolated methods.
 */
import { ForbiddenException } from '@nestjs/common';
import { CapabilityStatus, ServiceType } from '@prisma/client';
import { ServiceLeadsService } from './service-leads.service';

type Row = Record<string, any>;

const clone = <T>(value: T): T => value && typeof value === 'object'
    ? { ...(value as any) }
    : value;

class LeadStore {
    users: Row[] = [];
    profiles: Row[] = [];
    capabilities: Row[] = [];
    leads: Row[] = [];
    recipients: Row[] = [];
    private seq = 0;

    private id(prefix: string) {
        this.seq += 1;
        return `${prefix}-${this.seq}`;
    }

    private matchesScalar(value: any, rule: any): boolean {
        if (rule && typeof rule === 'object' && !(rule instanceof Date) && !Array.isArray(rule)) {
            if ('in' in rule) return rule.in.includes(value);
            if ('not' in rule) return value !== rule.not;
            if ('gt' in rule) return value > rule.gt;
            if ('gte' in rule) return value >= rule.gte;
            if ('lt' in rule) return value < rule.lt;
            if ('lte' in rule) return value <= rule.lte;
        }
        return value === rule;
    }

    private matchesLead(lead: Row, where: Row = {}): boolean {
        return Object.entries(where).every(([key, rule]) => {
            if (key === 'lead') return this.matchesLead(lead, rule as Row);
            return this.matchesScalar(lead[key], rule);
        });
    }

    prisma(): any {
        const store = this;
        const prisma: any = {
            user: {
                findUnique: async ({ where }: any) => clone(store.users.find((u) => u.id === where.id) ?? null),
            },
            contractorCapability: {
                findMany: async ({ where }: any) => store.capabilities
                    .filter((cap) => {
                        if (where.serviceType && cap.serviceType !== where.serviceType) return false;
                        if (where.status && cap.status !== where.status) return false;
                        const profile = store.profiles.find((p) => p.id === cap.contractorId);
                        if (where.contractor?.deletedAt === null && profile?.deletedAt) return false;
                        return true;
                    })
                    .map((cap) => ({
                        contractorId: cap.contractorId,
                        contractor: {
                            userId: store.profiles.find((p) => p.id === cap.contractorId)?.userId,
                        },
                    })),
                findUnique: async ({ where }: any) => {
                    const cap = store.capabilities.find((row) => row.id === where.id);
                    return cap ? clone(cap) : null;
                },
                update: async ({ where, data }: any) => {
                    const cap = store.capabilities.find((row) => row.id === where.id);
                    if (!cap) throw new Error('capability not found');
                    Object.assign(cap, data);
                    return clone(cap);
                },
            },
            contractorProfile: {
                findUnique: async ({ where, include }: any) => {
                    const profile = store.profiles.find((row) => row.userId === where.userId);
                    if (!profile) return null;

                    let capabilities = store.capabilities.filter((cap) => cap.contractorId === profile.id);
                    const capWhere = include?.capabilities?.where;
                    if (capWhere?.status) capabilities = capabilities.filter((cap) => cap.status === capWhere.status);
                    if (capWhere?.serviceType) {
                        const serviceRule = capWhere.serviceType;
                        capabilities = capabilities.filter((cap) =>
                            typeof serviceRule === 'object'
                                ? serviceRule.in.includes(cap.serviceType)
                                : cap.serviceType === serviceRule,
                        );
                    }
                    return {
                        ...clone(profile),
                        capabilities: capabilities.map((cap) => ({ serviceType: cap.serviceType })),
                    };
                },
            },
            serviceLead: {
                create: async ({ data, include }: any) => {
                    const lead = {
                        id: store.id('lead'),
                        status: 'OPEN',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        ...data,
                    };
                    delete lead.recipients;
                    store.leads.push(lead);

                    for (const input of data.recipients?.create ?? []) {
                        store.recipients.push({
                            id: store.id('recipient'),
                            leadId: lead.id,
                            contractorId: input.contractorId,
                            status: input.status ?? 'NEW',
                            headline: null,
                            message: null,
                            productName: null,
                            indicativePricePence: null,
                            representativeApr: null,
                            termMonths: null,
                            viewedAt: null,
                            respondedAt: null,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        });
                    }

                    return include?._count
                        ? {
                            ...clone(lead),
                            _count: {
                                recipients: store.recipients.filter((row) => row.leadId === lead.id).length,
                            },
                        }
                        : clone(lead);
                },
                updateMany: async ({ where, data }: any) => {
                    const rows = store.leads.filter((lead) => store.matchesLead(lead, where));
                    rows.forEach((lead) => Object.assign(lead, data, { updatedAt: new Date() }));
                    return { count: rows.length };
                },
                findMany: async ({ where = {}, include, select, orderBy }: any) => {
                    let rows = store.leads.filter((lead) => store.matchesLead(lead, where));
                    if (orderBy?.createdAt === 'desc') {
                        rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                    }
                    return rows.map((lead) => {
                        if (select?.id) return { id: lead.id };

                        const out: Row = clone(lead);
                        if (include?._count) {
                            out._count = {
                                recipients: store.recipients.filter((row) => row.leadId === lead.id).length,
                            };
                        }
                        if (include?.recipients) {
                            let recipients = store.recipients.filter((row) => row.leadId === lead.id);
                            if (include.recipients.where?.status) {
                                recipients = recipients.filter((row) => row.status === include.recipients.where.status);
                            }
                            out.recipients = recipients.map((row) =>
                                include.recipients.select?.id ? { id: row.id } : clone(row),
                            );
                        }
                        return out;
                    });
                },
                findFirst: async ({ where, include }: any) => {
                    const lead = store.leads.find((row) => store.matchesLead(row, where));
                    if (!lead) return null;

                    let recipients = store.recipients.filter((row) => row.leadId === lead.id);
                    if (include?.recipients?.where?.status) {
                        recipients = recipients.filter((row) => row.status === include.recipients.where.status);
                    }
                    if (include?.recipients?.orderBy) {
                        recipients = [...recipients].sort((a, b) => {
                            const aTime = a.respondedAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
                            const bTime = b.respondedAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
                            return aTime - bTime || a.createdAt.getTime() - b.createdAt.getTime();
                        });
                    }

                    return {
                        ...clone(lead),
                        _count: include?._count
                            ? { recipients: store.recipients.filter((row) => row.leadId === lead.id).length }
                            : undefined,
                        recipients: include?.recipients
                            ? recipients.map((row) => {
                                const profile = store.profiles.find((p) => p.id === row.contractorId);
                                return {
                                    ...clone(row),
                                    contractor: include.recipients.include?.contractor
                                        ? {
                                            businessName: profile?.businessName ?? null,
                                            rating: profile?.rating ?? 0,
                                            totalReviews: profile?.totalReviews ?? 0,
                                            serviceArea: profile?.serviceArea ?? null,
                                        }
                                        : undefined,
                                };
                            })
                            : undefined,
                    };
                },
                findUnique: async ({ where, select }: any) => {
                    const lead = store.leads.find((row) => row.id === where.id);
                    if (!lead) return null;
                    if (!select) return clone(lead);
                    return Object.fromEntries(
                        Object.entries(select)
                            .filter(([, enabled]) => enabled)
                            .map(([key]) => [key, lead[key]]),
                    );
                },
            },
            serviceLeadRecipient: {
                createMany: async ({ data, skipDuplicates }: any) => {
                    let count = 0;
                    for (const input of data) {
                        const exists = store.recipients.some((row) =>
                            row.leadId === input.leadId && row.contractorId === input.contractorId,
                        );
                        if (exists && skipDuplicates) continue;
                        store.recipients.push({
                            id: store.id('recipient'),
                            status: 'NEW',
                            headline: null,
                            message: null,
                            productName: null,
                            indicativePricePence: null,
                            representativeApr: null,
                            termMonths: null,
                            viewedAt: null,
                            respondedAt: null,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            ...input,
                        });
                        count += 1;
                    }
                    return { count };
                },
                findMany: async ({ where, include }: any) => {
                    let rows = store.recipients.filter((row) => {
                        if (where.contractorId && row.contractorId !== where.contractorId) return false;
                        const lead = store.leads.find((candidate) => candidate.id === row.leadId);
                        if (!lead) return false;
                        return where.lead ? store.matchesLead(lead, where.lead) : true;
                    });
                    rows = [...rows].sort((a, b) => {
                        const aLead = store.leads.find((lead) => lead.id === a.leadId)!;
                        const bLead = store.leads.find((lead) => lead.id === b.leadId)!;
                        return bLead.createdAt.getTime() - aLead.createdAt.getTime();
                    });
                    return rows.map((row) => ({
                        ...clone(row),
                        lead: include?.lead
                            ? clone(store.leads.find((lead) => lead.id === row.leadId)!)
                            : undefined,
                    }));
                },
                updateMany: async ({ where, data }: any) => {
                    const rows = store.recipients.filter((row) => {
                        if (where.leadId && row.leadId !== where.leadId) return false;
                        if (where.contractorId && row.contractorId !== where.contractorId) return false;
                        if (where.status && !store.matchesScalar(row.status, where.status)) return false;
                        return true;
                    });
                    rows.forEach((row) => Object.assign(row, data, { updatedAt: new Date() }));
                    return { count: rows.length };
                },
                findUnique: async ({ where }: any) => {
                    const compound = where.leadId_contractorId;
                    const row = store.recipients.find((candidate) =>
                        candidate.leadId === compound.leadId
                        && candidate.contractorId === compound.contractorId,
                    );
                    return row ? clone(row) : null;
                },
                update: async ({ where, data }: any) => {
                    const compound = where.leadId_contractorId;
                    const row = store.recipients.find((candidate) =>
                        candidate.leadId === compound.leadId
                        && candidate.contractorId === compound.contractorId,
                    );
                    if (!row) throw new Error('recipient not found');
                    Object.assign(row, data, { updatedAt: new Date() });
                    return clone(row);
                },
            },
        };

        prisma.$transaction = async (work: any) =>
            typeof work === 'function' ? work(prisma) : Promise.all(work);

        return prisma;
    }
}

function buildJourney() {
    const store = new LeadStore();
    store.users.push({
        id: 'customer',
        email: 'customer@example.com',
        firstName: 'Cara',
        lastName: 'Customer',
        phone: '07000000001',
        postcode: 'B1 1AA',
    });
    store.profiles.push(
        {
            id: 'finance-profile',
            userId: 'finance-user',
            businessName: 'Midlands Vehicle Finance',
            rating: 4.8,
            totalReviews: 31,
            serviceArea: 'UK',
            deletedAt: null,
        },
        {
            id: 'warranty-profile',
            userId: 'warranty-user',
            businessName: 'CarMazium Warranty Partner',
            rating: 4.6,
            totalReviews: 18,
            serviceArea: 'UK',
            deletedAt: null,
        },
    );
    store.capabilities.push(
        {
            id: 'finance-cap',
            contractorId: 'finance-profile',
            serviceType: ServiceType.FINANCE,
            status: CapabilityStatus.APPROVED,
        },
        {
            id: 'warranty-cap',
            contractorId: 'warranty-profile',
            serviceType: ServiceType.WARRANTY,
            status: CapabilityStatus.APPROVED,
        },
    );

    const notifications = { create: jest.fn().mockResolvedValue({}) };
    const service = new ServiceLeadsService(store.prisma(), notifications as any);
    return { store, notifications, service };
}

describe('Finance enquiry — end to end', () => {
    it('matches only Finance providers, receives a response, exposes it to the customer and closes safely', async () => {
        const { store, notifications, service } = buildJourney();

        const lead = await service.create('customer', {
            serviceType: ServiceType.FINANCE,
            vehicleRegistration: 'ab12 cde',
            vehicleMake: 'BMW',
            vehicleModel: '320d',
            vehicleYear: 2019,
            vehicleValuePence: 1_500_000,
            depositPence: 200_000,
            termMonths: 48,
            monthlyBudgetPence: 35_000,
            employmentStatus: 'Employed',
            annualIncomePence: 3_600_000,
            consentToProviderContact: true,
        } as any);

        expect(lead.recipientCount).toBe(1);
        expect(lead.vehicleRegistration).toBe('AB12CDE');
        expect(store.recipients).toHaveLength(1);
        expect(store.recipients[0].contractorId).toBe('finance-profile');
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'finance-user',
            type: 'SERVICE_LEAD_NEW',
            entityId: lead.id,
        }));

        const inbox = await service.inbox('finance-user', ServiceType.FINANCE);
        expect(inbox).toHaveLength(1);
        expect(inbox[0]).toMatchObject({
            id: lead.id,
            serviceType: ServiceType.FINANCE,
            recipientStatus: 'NEW',
        });

        await expect(
            service.inbox('warranty-user', ServiceType.FINANCE),
        ).rejects.toBeInstanceOf(ForbiddenException);

        const response = await service.respond('finance-user', lead.id, {
            headline: 'Finance option available',
            message: 'Subject to status and lender approval.',
            productName: 'Hire Purchase',
            indicativePricePence: 34_900,
            representativeApr: 7.9,
            termMonths: 48,
        } as any);

        expect(response).toMatchObject({
            status: 'RESPONDED',
            headline: 'Finance option available',
            productName: 'Hire Purchase',
            indicativePricePence: 34_900,
            representativeApr: 7.9,
            termMonths: 48,
        });
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'customer',
            type: 'SERVICE_LEAD_RESPONSE',
            entityId: lead.id,
        }));

        const customerView = await service.customerLead('customer', lead.id);
        expect(customerView.recipientCount).toBe(1);
        expect(customerView.responseCount).toBe(1);
        expect(customerView.responses).toHaveLength(1);
        expect(customerView.responses[0]).toMatchObject({
            businessName: 'Midlands Vehicle Finance',
            representativeApr: 7.9,
            termMonths: 48,
        });

        const closed = await service.close('customer', lead.id);
        expect(closed.status).toBe('CLOSED');
        expect((await service.inbox('finance-user', ServiceType.FINANCE))).toEqual([]);
    });
});

describe('Warranty enquiry — end to end', () => {
    it('matches only Warranty providers, returns a warranty response and creates no paid-job record', async () => {
        const { store, notifications, service } = buildJourney();

        const lead = await service.create('customer', {
            serviceType: ServiceType.WARRANTY,
            vehicleRegistration: 'wx19 abc',
            vehicleMake: 'Audi',
            vehicleModel: 'A4',
            vehicleYear: 2019,
            vehicleMileage: 62_000,
            vehicleValuePence: 1_250_000,
            warrantyMonths: 24,
            warrantyLevel: 'Comprehensive',
            summary: 'Looking for engine, gearbox and electrical cover.',
            consentToProviderContact: true,
        } as any);

        expect(lead.recipientCount).toBe(1);
        expect(store.recipients).toHaveLength(1);
        expect(store.recipients[0].contractorId).toBe('warranty-profile');

        const inbox = await service.inbox('warranty-user', ServiceType.WARRANTY);
        expect(inbox).toHaveLength(1);
        expect(inbox[0].warrantyMonths).toBe(24);
        expect(inbox[0].warrantyLevel).toBe('Comprehensive');

        await expect(
            service.inbox('finance-user', ServiceType.WARRANTY),
        ).rejects.toBeInstanceOf(ForbiddenException);

        const response = await service.respond('warranty-user', lead.id, {
            headline: '24-month comprehensive cover',
            message: 'Includes engine and gearbox subject to our policy wording.',
            productName: 'Comprehensive 24',
            indicativePricePence: 59_900,
        } as any);

        expect(response).toMatchObject({
            status: 'RESPONDED',
            productName: 'Comprehensive 24',
            indicativePricePence: 59_900,
            representativeApr: null,
        });

        const customerView = await service.customerLead('customer', lead.id);
        expect(customerView.responseCount).toBe(1);
        expect(customerView.responses[0]).toMatchObject({
            businessName: 'CarMazium Warranty Partner',
            productName: 'Comprehensive 24',
            indicativePricePence: 59_900,
        });

        // Finance/Warranty use matched enquiries, not ServicePayment/Stripe.
        expect((store as any).servicePayments).toBeUndefined();

        const closed = await service.close('customer', lead.id);
        expect(closed.status).toBe('CLOSED');
        expect((await service.inbox('warranty-user', ServiceType.WARRANTY))).toEqual([]);
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'customer',
            type: 'SERVICE_LEAD_RESPONSE',
        }));
    });
});
