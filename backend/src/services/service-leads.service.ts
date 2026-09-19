import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CapabilityStatus, Prisma, ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateServiceLeadDto, RespondToServiceLeadDto } from './service-leads.dto';
import { ReviewCapabilityDto } from './dto';
import { assertServiceAcceptingNewRequests } from './service-availability';

const LEAD_TYPES = [ServiceType.FINANCE, ServiceType.WARRANTY] as const;
const LEAD_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

type LeadType = (typeof LEAD_TYPES)[number];

@Injectable()
export class ServiceLeadsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) { }

    private assertLeadType(type: ServiceType): asserts type is LeadType {
        if (!(LEAD_TYPES as readonly ServiceType[]).includes(type)) {
            throw new BadRequestException('Only Vehicle Finance and Warranty Providers use the enquiry flow.');
        }
    }

    private cleanRecipient<T extends { representativeApr: Prisma.Decimal | number | string | null }>(recipient: T) {
        return {
            ...recipient,
            representativeApr: recipient.representativeApr === null || recipient.representativeApr === undefined
                ? null
                : Number(recipient.representativeApr),
        };
    }

    private leadWithCounts<T extends {
        _count: { recipients: number };
        recipients: Array<unknown>;
    }>(lead: T) {
        const { _count, recipients, ...rest } = lead;
        return {
            ...rest,
            recipientCount: _count.recipients,
            responseCount: recipients.length,
        };
    }

    private async expireOldLeads() {
        const now = new Date();
        await this.prisma.serviceLead.updateMany({
            where: {
                status: 'OPEN',
                expiresAt: { lte: now },
            },
            data: {
                status: 'EXPIRED',
                updatedAt: now,
            },
        });
    }

    async create(customerId: string, dto: CreateServiceLeadDto) {
        this.assertLeadType(dto.serviceType);
        assertServiceAcceptingNewRequests(dto.serviceType);

        if (!dto.consentToProviderContact) {
            throw new BadRequestException(
                'Consent is required before CarMazium can share this enquiry with approved providers.',
            );
        }

        if (
            dto.serviceType === ServiceType.WARRANTY
            && !dto.vehicleRegistration
            && !(dto.vehicleMake && dto.vehicleModel)
        ) {
            throw new BadRequestException('Warranty enquiries need a registration or vehicle make and model.');
        }

        const customer = await this.prisma.user.findUnique({
            where: { id: customerId },
            select: { email: true, firstName: true, lastName: true, phone: true, postcode: true },
        });
        if (!customer) throw new NotFoundException('Account not found');

        const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
            || customer.email.split('@')[0];
        const phone = dto.phone?.trim() || customer.phone || null;
        const postcode = normPostcode(dto.postcode) || normPostcode(customer.postcode);
        const registration = dto.vehicleRegistration?.toUpperCase().replace(/\s+/g, '') || null;
        const serviceType = dto.serviceType;
        const now = new Date();

        const transaction = await this.prisma.$transaction(async (tx) => {
            const matching = await tx.contractorCapability.findMany({
                where: {
                    serviceType,
                    status: CapabilityStatus.APPROVED,
                    contractor: { deletedAt: null },
                },
                select: {
                    contractorId: true,
                    contractor: { select: { userId: true } },
                },
            });

            const created = await tx.serviceLead.create({
                data: {
                    customerId,
                    serviceType,
                    status: 'OPEN',
                    listingId: dto.listingId ?? null,
                    vehicleRegistration: registration,
                    vehicleMake: dto.vehicleMake?.trim() || null,
                    vehicleModel: dto.vehicleModel?.trim() || null,
                    vehicleYear: dto.vehicleYear ?? null,
                    vehicleMileage: dto.vehicleMileage ?? null,
                    vehicleValuePence: dto.vehicleValuePence ?? null,
                    fullName,
                    email: customer.email,
                    phone,
                    postcode,
                    summary: dto.summary?.trim() || null,
                    depositPence: serviceType === ServiceType.FINANCE ? dto.depositPence ?? null : null,
                    termMonths: serviceType === ServiceType.FINANCE ? dto.termMonths ?? null : null,
                    monthlyBudgetPence: serviceType === ServiceType.FINANCE ? dto.monthlyBudgetPence ?? null : null,
                    employmentStatus: serviceType === ServiceType.FINANCE
                        ? dto.employmentStatus?.trim() || null
                        : null,
                    annualIncomePence: serviceType === ServiceType.FINANCE ? dto.annualIncomePence ?? null : null,
                    warrantyMonths: serviceType === ServiceType.WARRANTY ? dto.warrantyMonths ?? null : null,
                    warrantyLevel: serviceType === ServiceType.WARRANTY ? dto.warrantyLevel?.trim() || null : null,
                    consentToProviderContact: true,
                    consentRecordedAt: now,
                    expiresAt: new Date(now.getTime() + LEAD_LIFETIME_MS),
                    recipients: matching.length
                        ? {
                            create: matching.map((provider) => ({
                                contractorId: provider.contractorId,
                                status: 'NEW',
                            })),
                        }
                        : undefined,
                },
                include: {
                    _count: { select: { recipients: true } },
                },
            });

            return { created, matching };
        });

        const { _count, ...lead } = transaction.created;

        await Promise.allSettled(transaction.matching.map((provider) => this.notifications.create({
            userId: provider.contractor.userId,
            type: 'SERVICE_LEAD_NEW',
            title: serviceType === ServiceType.FINANCE ? 'New finance enquiry' : 'New warranty enquiry',
            message: 'A new matched CarMazium enquiry is available in your provider inbox.',
            link: '/dashboard/service/leads',
            entityType: 'ServiceLead',
            entityId: lead.id,
            actionType: 'CREATED',
        })));

        return {
            ...lead,
            recipientCount: _count.recipients,
        };
    }

    async myLeads(customerId: string) {
        await this.expireOldLeads();

        const leads = await this.prisma.serviceLead.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { recipients: true } },
                recipients: {
                    where: { status: 'RESPONDED' },
                    select: { id: true },
                },
            },
        });

        return leads.map((lead) => this.leadWithCounts(lead));
    }

    async customerLead(customerId: string, id: string) {
        await this.expireOldLeads();

        const lead = await this.prisma.serviceLead.findFirst({
            where: { id, customerId },
            include: {
                _count: { select: { recipients: true } },
                recipients: {
                    where: { status: 'RESPONDED' },
                    orderBy: [
                        { respondedAt: { sort: 'asc', nulls: 'last' } },
                        { createdAt: 'asc' },
                    ],
                    include: {
                        contractor: {
                            select: {
                                businessName: true,
                                rating: true,
                                totalReviews: true,
                                serviceArea: true,
                            },
                        },
                    },
                },
            },
        });
        if (!lead) throw new NotFoundException('Enquiry not found');

        const responses = lead.recipients.map(({ contractor, ...recipient }) => this.cleanRecipient({
            ...recipient,
            businessName: contractor.businessName,
            rating: contractor.rating,
            totalReviews: contractor.totalReviews,
            serviceArea: contractor.serviceArea,
        }));

        const { _count, recipients, ...base } = lead;
        return {
            ...base,
            recipientCount: _count.recipients,
            responseCount: recipients.length,
            responses,
        };
    }

    async close(customerId: string, id: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.serviceLead.updateMany({
                where: {
                    id,
                    customerId,
                    status: 'OPEN',
                },
                data: { status: 'CLOSED' },
            });
            if (result.count === 0) {
                throw new BadRequestException('Only an open enquiry can be closed.');
            }

            await tx.serviceLeadRecipient.updateMany({
                where: {
                    leadId: id,
                    status: { not: 'RESPONDED' },
                },
                data: { status: 'CLOSED' },
            });

            const lead = await tx.serviceLead.findUnique({ where: { id } });
            if (!lead) throw new NotFoundException('Enquiry not found');
            return lead;
        });
    }

    private async providerProfile(userId: string, requestedType?: ServiceType) {
        if (requestedType) this.assertLeadType(requestedType);

        const profile = await this.prisma.contractorProfile.findUnique({
            where: { userId },
            include: {
                capabilities: {
                    where: {
                        status: CapabilityStatus.APPROVED,
                        serviceType: requestedType
                            ? requestedType
                            : { in: [ServiceType.FINANCE, ServiceType.WARRANTY] },
                    },
                    select: { serviceType: true },
                },
            },
        });

        if (!profile || profile.deletedAt || profile.capabilities.length === 0) {
            throw new ForbiddenException('You need an approved Finance or Warranty provider capability.');
        }
        return profile;
    }

    private async ensureRecipients(contractorId: string, types: ServiceType[]) {
        await this.expireOldLeads();
        types.forEach((type) => this.assertLeadType(type));

        if (types.length === 0) return;

        const openLeads = await this.prisma.serviceLead.findMany({
            where: {
                serviceType: { in: types },
                status: 'OPEN',
                expiresAt: { gt: new Date() },
                consentToProviderContact: true,
            },
            select: { id: true },
        });
        if (openLeads.length === 0) return;

        await this.prisma.serviceLeadRecipient.createMany({
            data: openLeads.map((lead) => ({
                leadId: lead.id,
                contractorId,
                status: 'NEW',
            })),
            skipDuplicates: true,
        });
    }

    async inbox(userId: string, serviceType?: ServiceType) {
        const profile = await this.providerProfile(userId, serviceType);
        const types = profile.capabilities.map((capability) => capability.serviceType);
        await this.ensureRecipients(profile.id, types);

        const now = new Date();
        const recipients = await this.prisma.serviceLeadRecipient.findMany({
            where: {
                contractorId: profile.id,
                lead: {
                    status: 'OPEN',
                    expiresAt: { gt: now },
                    ...(serviceType ? { serviceType } : {}),
                },
            },
            orderBy: { lead: { createdAt: 'desc' } },
            include: { lead: true },
        });

        await this.prisma.serviceLeadRecipient.updateMany({
            where: {
                contractorId: profile.id,
                status: 'NEW',
            },
            data: {
                status: 'VIEWED',
                viewedAt: now,
            },
        });

        return recipients.map(({ lead, ...recipient }) => ({
            ...lead,
            recipientId: recipient.id,
            recipientStatus: recipient.status,
            headline: recipient.headline,
            message: recipient.message,
            productName: recipient.productName,
            indicativePricePence: recipient.indicativePricePence,
            representativeApr: recipient.representativeApr == null ? null : Number(recipient.representativeApr),
            responseTermMonths: recipient.termMonths,
            viewedAt: recipient.viewedAt,
            respondedAt: recipient.respondedAt,
        }));
    }

    async respond(userId: string, leadId: string, dto: RespondToServiceLeadDto) {
        const profile = await this.providerProfile(userId);

        const lead = await this.prisma.serviceLead.findUnique({
            where: { id: leadId },
            select: {
                id: true,
                customerId: true,
                serviceType: true,
                status: true,
                expiresAt: true,
            },
        });
        if (!lead) throw new NotFoundException('Enquiry not found');

        this.assertLeadType(lead.serviceType);
        if (lead.status !== 'OPEN' || lead.expiresAt <= new Date()) {
            throw new BadRequestException('This enquiry is no longer open.');
        }
        if (!profile.capabilities.some((capability) => capability.serviceType === lead.serviceType)) {
            throw new ForbiddenException('You are not approved for this type of enquiry.');
        }

        await this.ensureRecipients(profile.id, [lead.serviceType]);

        const recipient = await this.prisma.serviceLeadRecipient.findUnique({
            where: {
                leadId_contractorId: {
                    leadId,
                    contractorId: profile.id,
                },
            },
        });
        if (!recipient) {
            throw new ForbiddenException('This enquiry was not matched to your provider account.');
        }

        const now = new Date();
        const response = await this.prisma.serviceLeadRecipient.update({
            where: {
                leadId_contractorId: {
                    leadId,
                    contractorId: profile.id,
                },
            },
            data: {
                status: 'RESPONDED',
                headline: dto.headline.trim(),
                message: dto.message.trim(),
                productName: dto.productName?.trim() || null,
                indicativePricePence: dto.indicativePricePence ?? null,
                representativeApr: dto.representativeApr ?? null,
                termMonths: dto.termMonths ?? null,
                viewedAt: recipient.viewedAt ?? now,
                respondedAt: now,
            },
        });

        await this.notifications.create({
            userId: lead.customerId,
            type: 'SERVICE_LEAD_RESPONSE',
            title: lead.serviceType === ServiceType.FINANCE ? 'Finance provider replied' : 'Warranty provider replied',
            message: `${profile.businessName || 'An approved provider'} has responded to your CarMazium enquiry.`,
            link: `/services/leads/${leadId}`,
            entityType: 'ServiceLead',
            entityId: leadId,
            actionType: 'RESPONDED',
        }).catch(() => null);

        return this.cleanRecipient(response);
    }

    async isLeadCapability(id: string) {
        const cap = await this.prisma.contractorCapability.findUnique({
            where: { id },
            select: { serviceType: true },
        });
        return cap && (cap.serviceType === ServiceType.FINANCE || cap.serviceType === ServiceType.WARRANTY)
            ? cap.serviceType
            : null;
    }

    /** Finance/Warranty have no platform payout, so Stripe Connect is not a prerequisite. */
    async reviewLeadCapability(adminId: string, id: string, dto: ReviewCapabilityDto) {
        const cap = await this.prisma.contractorCapability.findUnique({
            where: { id },
            include: { contractor: { include: { user: true } } },
        });
        if (!cap) throw new NotFoundException('Application not found');
        this.assertLeadType(cap.serviceType);

        const updated = await this.prisma.contractorCapability.update({
            where: { id },
            data: {
                status: dto.status,
                reviewedAt: new Date(),
                reviewedById: adminId,
                reviewNote: dto.reviewNote ?? null,
            },
        });

        const approved = dto.status === CapabilityStatus.APPROVED;
        await this.notifications.create({
            userId: cap.contractor.userId,
            type: approved ? 'SERVICE_CAPABILITY_APPROVED' : 'SERVICE_CAPABILITY_REVIEWED',
            title: `${cap.serviceType === ServiceType.FINANCE ? 'Vehicle Finance' : 'Warranty'} provider application ${approved ? 'approved' : 'updated'}`,
            message: approved
                ? 'You can now receive matched customer enquiries in your provider inbox.'
                : (dto.reviewNote || `Your application status is now ${dto.status.toLowerCase()}.`),
            link: approved ? '/dashboard/service/leads' : '/dashboard/service/capabilities',
            entityType: 'ContractorCapability',
            entityId: id,
            actionType: dto.status,
        }).catch(() => null);

        return updated;
    }

    async adminList(serviceType?: ServiceType, status?: string) {
        if (serviceType) this.assertLeadType(serviceType);

        const leads = await this.prisma.serviceLead.findMany({
            where: {
                ...(serviceType ? { serviceType } : {}),
                ...(status ? { status } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 250,
            include: {
                _count: { select: { recipients: true } },
                recipients: {
                    where: { status: 'RESPONDED' },
                    select: { id: true },
                },
            },
        });

        return leads.map((lead) => this.leadWithCounts(lead));
    }
}

function normPostcode(value?: string | null): string | null {
    const p = value?.trim().toUpperCase().replace(/\s+/g, '');
    if (!p) return null;
    return p.length > 3 ? `${p.slice(0, -3)} ${p.slice(-3)}` : p;
}
