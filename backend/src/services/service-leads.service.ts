import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CapabilityStatus, Prisma, ServiceType } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateServiceLeadDto, RespondToServiceLeadDto } from './service-leads.dto';
import { ReviewCapabilityDto } from './dto';
import { assertServiceAcceptingNewRequests } from './service-availability';

const LEAD_TYPES = [ServiceType.FINANCE, ServiceType.WARRANTY] as const;
const LEAD_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_LEAD_RECIPIENTS = 5;
export const LEAD_RETENTION_DAYS = 90;

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
        return this.prisma.serviceLead.updateMany({
            where: {
                status: 'OPEN',
                expiresAt: { lte: now },
            },
            data: {
                status: 'EXPIRED',
                closedAt: now,
                updatedAt: now,
            },
        });
    }

    private async anonymizeRetainedLeads() {
        const cutoff = new Date(Date.now() - LEAD_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const stale = await this.prisma.serviceLead.findMany({
            where: {
                status: { in: ['CLOSED', 'EXPIRED'] },
                closedAt: { lte: cutoff },
                anonymizedAt: null,
            },
            select: { id: true },
            take: 500,
        });
        if (stale.length === 0) return 0;

        const ids = stale.map((lead) => lead.id);
        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.serviceLeadRecipient.updateMany({
                where: { leadId: { in: ids } },
                data: {
                    headline: null,
                    message: null,
                },
            }),
            this.prisma.serviceLead.updateMany({
                where: { id: { in: ids }, anonymizedAt: null },
                data: {
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
                    anonymizedAt: now,
                    updatedAt: now,
                },
            }),
        ]);
        return ids.length;
    }

    @Cron('23 3 * * *')
    async privacyMaintenance() {
        await this.expireOldLeads();
        return this.anonymizeRetainedLeads();
    }

    private providerMatchReason(
        candidate: any,
        lead: {
            postcode: string | null;
            vehicleValuePence: number | null;
            vehicleYear: number | null;
            vehicleMileage: number | null;
            annualIncomePence: number | null;
            termMonths: number | null;
            warrantyMonths: number | null;
            warrantyLevel: string | null;
            serviceType: ServiceType;
        },
    ): string | null {
        const area = postcodeArea(lead.postcode);
        const areas = (candidate.leadPostcodeAreas ?? []).map((value: string) => value.toUpperCase());
        if (!candidate.leadNationwide) {
            if (!area || !areas.includes(area)) return null;
        }

        const requiredNumber = (rule: number | null | undefined, value: number | null, compare: (a: number, b: number) => boolean) =>
            rule == null || (value != null && compare(value, rule));

        if (!requiredNumber(candidate.leadMinVehicleValuePence, lead.vehicleValuePence, (value, min) => value >= min)) return null;
        if (!requiredNumber(candidate.leadMaxVehicleValuePence, lead.vehicleValuePence, (value, max) => value <= max)) return null;
        if (!requiredNumber(candidate.leadMinVehicleYear, lead.vehicleYear, (value, min) => value >= min)) return null;
        if (!requiredNumber(candidate.leadMaxVehicleMileage, lead.vehicleMileage, (value, max) => value <= max)) return null;

        if (lead.serviceType === ServiceType.FINANCE) {
            if (!requiredNumber(candidate.leadMinAnnualIncomePence, lead.annualIncomePence, (value, min) => value >= min)) return null;
            if (!requiredNumber(candidate.leadFinanceTermMinMonths, lead.termMonths, (value, min) => value >= min)) return null;
            if (!requiredNumber(candidate.leadFinanceTermMaxMonths, lead.termMonths, (value, max) => value <= max)) return null;
        }

        if (lead.serviceType === ServiceType.WARRANTY) {
            const levels = (candidate.leadWarrantyLevels ?? [])
                .map((value: string) => value.trim().toLowerCase())
                .filter(Boolean);
            if (levels.length > 0 && (!lead.warrantyLevel || !levels.includes(lead.warrantyLevel.trim().toLowerCase()))) {
                return null;
            }
            if (!requiredNumber(candidate.leadWarrantyMinMonths, lead.warrantyMonths, (value, min) => value >= min)) return null;
            if (!requiredNumber(candidate.leadWarrantyMaxMonths, lead.warrantyMonths, (value, max) => value <= max)) return null;
        }

        return candidate.leadNationwide
            ? 'Nationwide coverage and configured eligibility matched'
            : `Postcode area ${area} and configured eligibility matched`;
    }

    private async matchingProviders(
        db: any,
        lead: {
            serviceType: ServiceType;
            postcode: string | null;
            vehicleValuePence: number | null;
            vehicleYear: number | null;
            vehicleMileage: number | null;
            annualIncomePence: number | null;
            termMonths: number | null;
            warrantyMonths: number | null;
            warrantyLevel: string | null;
        },
        excludeContractorIds: string[] = [],
        limit = MAX_LEAD_RECIPIENTS,
    ) {
        this.assertLeadType(lead.serviceType);
        if (limit <= 0) return [];

        const candidates = await db.contractorCapability.findMany({
            where: {
                serviceType: lead.serviceType,
                status: CapabilityStatus.APPROVED,
                contractor: {
                    deletedAt: null,
                    ...(excludeContractorIds.length ? { id: { notIn: excludeContractorIds } } : {}),
                },
            },
            select: {
                contractorId: true,
                reviewedAt: true,
                leadNationwide: true,
                leadPostcodeAreas: true,
                leadMinVehicleValuePence: true,
                leadMaxVehicleValuePence: true,
                leadMinVehicleYear: true,
                leadMaxVehicleMileage: true,
                leadMinAnnualIncomePence: true,
                leadFinanceTermMinMonths: true,
                leadFinanceTermMaxMonths: true,
                leadWarrantyLevels: true,
                leadWarrantyMinMonths: true,
                leadWarrantyMaxMonths: true,
                contractor: {
                    select: {
                        userId: true,
                        rating: true,
                        totalReviews: true,
                    },
                },
            },
        });

        const matched = candidates
            .map((candidate: any) => ({
                ...candidate,
                matchReason: this.providerMatchReason(candidate, lead),
                areaSpecific: !candidate.leadNationwide,
            }))
            .filter((candidate: any) => candidate.matchReason)
            .sort((a: any, b: any) =>
                Number(b.areaSpecific) - Number(a.areaSpecific)
                || (b.contractor.rating ?? 0) - (a.contractor.rating ?? 0)
                || (b.contractor.totalReviews ?? 0) - (a.contractor.totalReviews ?? 0)
                || String(a.contractorId).localeCompare(String(b.contractorId)),
            );

        return matched.slice(0, limit);
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
        const leadMatchInput = {
            serviceType,
            postcode,
            vehicleValuePence: dto.vehicleValuePence ?? null,
            vehicleYear: dto.vehicleYear ?? null,
            vehicleMileage: dto.vehicleMileage ?? null,
            annualIncomePence: serviceType === ServiceType.FINANCE ? dto.annualIncomePence ?? null : null,
            termMonths: serviceType === ServiceType.FINANCE ? dto.termMonths ?? null : null,
            warrantyMonths: serviceType === ServiceType.WARRANTY ? dto.warrantyMonths ?? null : null,
            warrantyLevel: serviceType === ServiceType.WARRANTY ? dto.warrantyLevel?.trim() || null : null,
        };

        const transaction = await this.prisma.$transaction(async (tx) => {
            const matching = await this.matchingProviders(tx, leadMatchInput);

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
                            create: matching.map((provider: any) => ({
                                contractorId: provider.contractorId,
                                status: 'NEW',
                                matchedAt: now,
                                matchSource: 'AUTO',
                                matchReason: provider.matchReason,
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
                data: { status: 'CLOSED', closedAt: new Date() },
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

    async inbox(userId: string, serviceType?: ServiceType) {
        const profile = await this.providerProfile(userId, serviceType);
        await this.expireOldLeads();

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

        return recipients.map(({ lead, ...recipient }) => ({
            id: lead.id,
            serviceType: lead.serviceType,
            status: lead.status,
            vehicleRegistration: lead.vehicleRegistration,
            vehicleMake: lead.vehicleMake,
            vehicleModel: lead.vehicleModel,
            vehicleYear: lead.vehicleYear,
            vehicleMileage: lead.vehicleMileage,
            vehicleValuePence: lead.vehicleValuePence,
            // Inbox only needs a broad routing area. Full postcode/contact and
            // financial-employment detail are disclosed only after the matched
            // provider deliberately opens this enquiry.
            postcode: postcodeArea(lead.postcode),
            depositPence: lead.serviceType === ServiceType.FINANCE ? lead.depositPence : null,
            termMonths: lead.serviceType === ServiceType.FINANCE ? lead.termMonths : null,
            monthlyBudgetPence: lead.serviceType === ServiceType.FINANCE ? lead.monthlyBudgetPence : null,
            warrantyMonths: lead.serviceType === ServiceType.WARRANTY ? lead.warrantyMonths : null,
            warrantyLevel: lead.serviceType === ServiceType.WARRANTY ? lead.warrantyLevel : null,
            expiresAt: lead.expiresAt,
            createdAt: lead.createdAt,
            recipientId: recipient.id,
            recipientStatus: recipient.status,
            headline: recipient.headline,
            message: recipient.message,
            productName: recipient.productName,
            indicativePricePence: recipient.indicativePricePence,
            representativeApr: recipient.representativeApr == null ? null : Number(recipient.representativeApr),
            responseTermMonths: recipient.termMonths,
            matchedAt: recipient.matchedAt,
            matchSource: recipient.matchSource,
            viewedAt: recipient.viewedAt,
            respondedAt: recipient.respondedAt,
        }));
    }

    async providerLead(userId: string, leadId: string) {
        await this.expireOldLeads();

        const lead = await this.prisma.serviceLead.findUnique({
            where: { id: leadId },
        });
        if (!lead) throw new NotFoundException('Enquiry not found');

        this.assertLeadType(lead.serviceType);
        if (lead.status !== 'OPEN' || lead.expiresAt <= new Date()) {
            throw new BadRequestException('This enquiry is no longer open.');
        }

        const profile = await this.providerProfile(userId, lead.serviceType);
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
        if (recipient.status === 'NEW') {
            await this.prisma.serviceLeadRecipient.update({
                where: {
                    leadId_contractorId: {
                        leadId,
                        contractorId: profile.id,
                    },
                },
                data: {
                    status: 'VIEWED',
                    viewedAt: recipient.viewedAt ?? now,
                },
            });
        }

        return {
            ...lead,
            recipientId: recipient.id,
            recipientStatus: recipient.status === 'NEW' ? 'VIEWED' : recipient.status,
            headline: recipient.headline,
            message: recipient.message,
            productName: recipient.productName,
            indicativePricePence: recipient.indicativePricePence,
            representativeApr: recipient.representativeApr == null ? null : Number(recipient.representativeApr),
            responseTermMonths: recipient.termMonths,
            viewedAt: recipient.viewedAt ?? (recipient.status === 'NEW' ? now : null),
            respondedAt: recipient.respondedAt,
        };
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

        const headline = dto.headline.trim();
        const message = dto.message.trim();
        if (!headline || !message) {
            throw new BadRequestException('A response needs both a headline and message.');
        }
        if (
            lead.serviceType === ServiceType.WARRANTY
            && (dto.representativeApr !== undefined || dto.termMonths !== undefined)
        ) {
            throw new BadRequestException('APR and finance term fields are only valid for Finance responses.');
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
                headline,
                message,
                productName: dto.productName?.trim() || null,
                indicativePricePence: dto.indicativePricePence ?? null,
                representativeApr: lead.serviceType === ServiceType.FINANCE
                    ? dto.representativeApr ?? null
                    : null,
                termMonths: lead.serviceType === ServiceType.FINANCE
                    ? dto.termMonths ?? null
                    : null,
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
