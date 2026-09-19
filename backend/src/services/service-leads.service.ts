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
import { assertCapabilityVerificationReady, verifiedCapabilityWhere } from './capability-verification';
import { normaliseUkPostcode, postcodeArea as validatedPostcodeArea } from './service-validation';
import { boundedServiceLimit, decodeServiceCursor, makeServicePage } from './service-pagination';

const LEAD_TYPES = [ServiceType.FINANCE, ServiceType.WARRANTY] as const;
const LEAD_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_LEAD_RECIPIENTS = 5;
export const LEAD_RETENTION_DAYS = 90;
export const MAX_ACTIVE_SERVICE_LEADS_PER_CUSTOMER = 5;

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

    async expireOldLeads(): Promise<number> {
        const now = new Date();
        const stale = await this.prisma.serviceLead.findMany({
            where: { status: 'OPEN', expiresAt: { lte: now } },
            select: { id: true },
            take: 500,
        });

        let expired = 0;
        for (const lead of stale) {
            const claimed = await this.prisma.$transaction(async (tx) => {
                const updated = await tx.serviceLead.updateMany({
                    where: { id: lead.id, status: 'OPEN', expiresAt: { lte: now } },
                    data: { status: 'EXPIRED', closedAt: now, updatedAt: now },
                });
                if (updated.count !== 1) return false;

                await tx.serviceLeadRecipient.updateMany({
                    where: { leadId: lead.id, status: { in: ['NEW', 'VIEWED'] } },
                    data: { status: 'CLOSED', updatedAt: now },
                });
                return true;
            });
            if (claimed) expired += 1;
        }
        return expired;
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
        const area = validatedPostcodeArea(lead.postcode);
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
                ...verifiedCapabilityWhere(new Date()),
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
            !dto.listingId
            && !dto.vehicleRegistration?.trim()
            && !(dto.vehicleMake?.trim() && dto.vehicleModel?.trim())
        ) {
            throw new BadRequestException('Enquiries need a registration or vehicle make and model.');
        }

        const customer = await this.prisma.user.findUnique({
            where: { id: customerId },
            select: { email: true, firstName: true, lastName: true, phone: true, postcode: true },
        });
        if (!customer) throw new NotFoundException('Account not found');

        let listingVehicle: {
            registration: string | null;
            make: string | null;
            model: string | null;
            year: number | null;
            mileage: number | null;
        } | null = null;

        if (dto.listingId) {
            const listing = await this.prisma.listing.findUnique({
                where: { id: dto.listingId },
                include: {
                    vehicle: true,
                    sale: { select: { buyerId: true } },
                    auction: { select: { winnerId: true } },
                    offers: {
                        where: { status: 'ACCEPTED' },
                        select: { buyerId: true },
                    },
                },
            });
            if (!listing || listing.deletedAt) {
                throw new BadRequestException('The linked CarMazium listing is not available.');
            }

            const related =
                listing.sellerId === customerId
                || listing.sale?.buyerId === customerId
                || listing.auction?.winnerId === customerId
                || (listing.offers ?? []).some((offer: any) => offer.buyerId === customerId);
            if (!related && String(listing.status) !== 'ACTIVE') {
                throw new ForbiddenException(
                    'You can only link an active public listing or a vehicle connected to your account.',
                );
            }

            listingVehicle = {
                registration: listing.vehicle?.registration ?? listing.vrm ?? null,
                make: listing.vehicle?.make ?? listing.make ?? null,
                model: listing.vehicle?.model ?? listing.model ?? null,
                year: listing.vehicle?.year ?? listing.year ?? null,
                mileage: listing.vehicle?.mileage ?? listing.mileage ?? null,
            };
        }

        const registration = (
            listingVehicle?.registration
            ?? dto.vehicleRegistration
            ?? ''
        ).toUpperCase().replace(/\s+/g, '') || null;
        const vehicleMake = listingVehicle?.make?.trim() || dto.vehicleMake?.trim() || null;
        const vehicleModel = listingVehicle?.model?.trim() || dto.vehicleModel?.trim() || null;
        const vehicleYear = listingVehicle?.year ?? dto.vehicleYear ?? null;
        const vehicleMileage = listingVehicle?.mileage ?? dto.vehicleMileage ?? null;

        if (!registration && !(vehicleMake && vehicleModel)) {
            throw new BadRequestException('Enquiries need a registration or vehicle make and model.');
        }

        const rawPostcode = dto.postcode?.trim() || customer.postcode?.trim() || null;
        const postcode = normaliseUkPostcode(rawPostcode);
        if (rawPostcode && !postcode) {
            throw new BadRequestException('Postcode must be a valid UK postcode.');
        }

        const serviceType = dto.serviceType;
        if (serviceType === ServiceType.FINANCE) {
            if (!postcode) {
                throw new BadRequestException('Finance enquiries need a valid UK postcode.');
            }
            if (!dto.vehicleValuePence || dto.vehicleValuePence <= 0) {
                throw new BadRequestException('Finance enquiries need the approximate vehicle value.');
            }
            if (!dto.termMonths) {
                throw new BadRequestException('Finance enquiries need a preferred finance term.');
            }
            if (!dto.employmentStatus?.trim()) {
                throw new BadRequestException('Finance enquiries need an employment status.');
            }
            if (
                (!dto.monthlyBudgetPence || dto.monthlyBudgetPence <= 0)
                && (!dto.annualIncomePence || dto.annualIncomePence <= 0)
            ) {
                throw new BadRequestException(
                    'Finance enquiries need a monthly budget or annual income so providers can assess suitability.',
                );
            }
        }

        const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
            || customer.email.split('@')[0];
        const phone = dto.phone?.trim() || customer.phone || null;
        const now = new Date();
        const leadMatchInput = {
            serviceType,
            postcode,
            vehicleValuePence: dto.vehicleValuePence ?? null,
            vehicleYear,
            vehicleMileage,
            annualIncomePence: serviceType === ServiceType.FINANCE ? dto.annualIncomePence ?? null : null,
            termMonths: serviceType === ServiceType.FINANCE ? dto.termMonths ?? null : null,
            warrantyMonths: serviceType === ServiceType.WARRANTY ? dto.warrantyMonths ?? null : null,
            warrantyLevel: serviceType === ServiceType.WARRANTY ? dto.warrantyLevel?.trim() || null : null,
        };

        const transaction = await this.prisma.$transaction(async (tx) => {
            if (typeof tx.$executeRaw === 'function') {
                await tx.$executeRaw(Prisma.sql`
                    SELECT pg_advisory_xact_lock(hashtextextended(${`service-lead:${customerId}`}, 0))
                `);
            }
            const activeCount = typeof tx.serviceLead.count === 'function'
                ? await tx.serviceLead.count({
                    where: {
                        customerId,
                        status: 'OPEN',
                        expiresAt: { gt: now },
                    },
                })
                : 0;
            if (activeCount >= MAX_ACTIVE_SERVICE_LEADS_PER_CUSTOMER) {
                throw new BadRequestException(
                    `You can have up to ${MAX_ACTIVE_SERVICE_LEADS_PER_CUSTOMER} active Finance/Warranty enquiries at one time. Close an existing enquiry before creating another.`,
                );
            }

            const matching = await this.matchingProviders(tx, leadMatchInput);
            const created = await tx.serviceLead.create({
                data: {
                    customerId,
                    serviceType,
                    status: 'OPEN',
                    listingId: dto.listingId ?? null,
                    vehicleRegistration: registration,
                    vehicleMake,
                    vehicleModel,
                    vehicleYear,
                    vehicleMileage,
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

    async myLeadsPage(
        customerId: string,
        options: { limit?: number; cursor?: string } = {},
    ) {
        await this.expireOldLeads();

        const limit = boundedServiceLimit(options.limit);
        const cursor = decodeServiceCursor(options.cursor);
        const cursorDate = cursor ? new Date(cursor.at) : null;
        const leads = await this.prisma.serviceLead.findMany({
            where: {
                customerId,
                ...(cursorDate ? {
                    OR: [
                        { createdAt: { lt: cursorDate } },
                        { createdAt: cursorDate, id: { lt: cursor!.id } },
                    ],
                } : {}),
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
            include: {
                _count: { select: { recipients: true } },
                recipients: {
                    where: { status: 'RESPONDED' },
                    select: { id: true },
                },
            },
        });

        const page = makeServicePage(leads, limit, (lead) => ({
            at: lead.createdAt.toISOString(),
            id: lead.id,
        }));
        return {
            ...page,
            items: page.items.map((lead) => this.leadWithCounts(lead)),
        };
    }

    /** Compatibility helper for internal/tests; HTTP list routes use cursor pages. */
    async myLeads(customerId: string) {
        return (await this.myLeadsPage(customerId, { limit: 50 })).items;
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
                        ...verifiedCapabilityWhere(new Date()),
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

    async inboxPage(
        userId: string,
        serviceType?: ServiceType,
        options: { limit?: number; cursor?: string } = {},
    ) {
        const profile = await this.providerProfile(userId, serviceType);
        await this.expireOldLeads();

        const limit = boundedServiceLimit(options.limit);
        const cursor = decodeServiceCursor(options.cursor);
        const cursorDate = cursor ? new Date(cursor.at) : null;
        const now = new Date();

        const recipients = await this.prisma.serviceLeadRecipient.findMany({
            where: {
                contractorId: profile.id,
                lead: {
                    status: 'OPEN',
                    expiresAt: { gt: now },
                    ...(serviceType ? { serviceType } : {}),
                    ...(cursorDate ? {
                        OR: [
                            { createdAt: { lt: cursorDate } },
                            { createdAt: cursorDate, id: { lt: cursor!.id } },
                        ],
                    } : {}),
                },
            },
            orderBy: [
                { lead: { createdAt: 'desc' } },
                { leadId: 'desc' },
            ],
            take: limit + 1,
            include: { lead: true },
        });

        const mapped = recipients.map(({ lead, ...recipient }) => ({
            id: lead.id,
            serviceType: lead.serviceType,
            status: lead.status,
            vehicleRegistration: lead.vehicleRegistration,
            vehicleMake: lead.vehicleMake,
            vehicleModel: lead.vehicleModel,
            vehicleYear: lead.vehicleYear,
            vehicleMileage: lead.vehicleMileage,
            vehicleValuePence: lead.vehicleValuePence,
            // Inbox only needs the broad UK postcode area. Contact details and
            // sensitive finance fields are disclosed only after deliberate open.
            postcode: validatedPostcodeArea(lead.postcode),
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

        const page = makeServicePage(mapped, limit, (row) => ({
            at: row.createdAt.toISOString(),
            id: row.id,
        }));
        return page;
    }

    /** Compatibility helper for internal/tests; HTTP inbox uses cursor pages. */
    async inbox(userId: string, serviceType?: ServiceType) {
        return (await this.inboxPage(userId, serviceType, { limit: 50 })).items;
    }

    async providerLead(userId: string, leadId: string) {
        await this.expireOldLeads();

        const lead = await this.prisma.serviceLead.findUnique({
            where: { id: leadId },
        });
        if (!lead) throw new NotFoundException('Enquiry not found');

        this.assertLeadType(lead.serviceType);
        if (lead.status !== 'OPEN' || lead.expiresAt <= new Date() || lead.anonymizedAt) {
            throw new BadRequestException('This enquiry is no longer open.');
        }

        const profile = await this.providerProfile(userId, lead.serviceType);
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
        let displayedRecipient = {
            ...recipient,
            status: recipient.status === 'NEW' ? 'VIEWED' : recipient.status,
            viewedAt: recipient.viewedAt ?? now,
            contactDisclosedAt: recipient.contactDisclosedAt ?? now,
        };
        if (recipient.status === 'NEW') {
            // Claim NEW -> VIEWED atomically. A simultaneous provider response
            // may already have moved the row to RESPONDED, in which case we
            // must never downgrade it back to VIEWED.
            await this.prisma.serviceLeadRecipient.updateMany({
                where: { id: recipient.id, status: 'NEW' },
                data: {
                    status: 'VIEWED',
                    viewedAt: recipient.viewedAt ?? now,
                    contactDisclosedAt: recipient.contactDisclosedAt ?? now,
                },
            });
        } else if (!recipient.viewedAt || !recipient.contactDisclosedAt) {
            await this.prisma.serviceLeadRecipient.updateMany({
                where: { id: recipient.id },
                data: {
                    ...(recipient.viewedAt ? {} : { viewedAt: now }),
                    ...(recipient.contactDisclosedAt ? {} : { contactDisclosedAt: now }),
                },
            });
        }


        // Deliberately construct the disclosure payload instead of spreading
        // the database row. This prevents future internal lead fields from
        // becoming provider-visible by accident.
        return {
            id: lead.id,
            serviceType: lead.serviceType,
            status: lead.status,
            fullName: lead.fullName,
            email: lead.email,
            phone: lead.phone,
            postcode: lead.postcode,
            vehicleRegistration: lead.vehicleRegistration,
            vehicleMake: lead.vehicleMake,
            vehicleModel: lead.vehicleModel,
            vehicleYear: lead.vehicleYear,
            vehicleMileage: lead.vehicleMileage,
            vehicleValuePence: lead.vehicleValuePence,
            summary: lead.summary,
            depositPence: lead.serviceType === ServiceType.FINANCE ? lead.depositPence : null,
            termMonths: lead.serviceType === ServiceType.FINANCE ? lead.termMonths : null,
            monthlyBudgetPence: lead.serviceType === ServiceType.FINANCE ? lead.monthlyBudgetPence : null,
            employmentStatus: lead.serviceType === ServiceType.FINANCE ? lead.employmentStatus : null,
            annualIncomePence: lead.serviceType === ServiceType.FINANCE ? lead.annualIncomePence : null,
            warrantyMonths: lead.serviceType === ServiceType.WARRANTY ? lead.warrantyMonths : null,
            warrantyLevel: lead.serviceType === ServiceType.WARRANTY ? lead.warrantyLevel : null,
            expiresAt: lead.expiresAt,
            createdAt: lead.createdAt,
            recipientId: displayedRecipient.id,
            recipientStatus: displayedRecipient.status,
            headline: displayedRecipient.headline,
            message: displayedRecipient.message,
            productName: displayedRecipient.productName,
            indicativePricePence: displayedRecipient.indicativePricePence,
            representativeApr: displayedRecipient.representativeApr == null ? null : Number(displayedRecipient.representativeApr),
            responseTermMonths: displayedRecipient.termMonths,
            matchedAt: displayedRecipient.matchedAt,
            matchSource: displayedRecipient.matchSource,
            matchReason: displayedRecipient.matchReason,
            viewedAt: displayedRecipient.viewedAt,
            contactDisclosedAt: displayedRecipient.contactDisclosedAt,
            respondedAt: displayedRecipient.respondedAt,
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
                respondedAt: now,
            },
        });

        if (!lead.customerId) {
            throw new BadRequestException('This enquiry has been anonymised and can no longer receive responses.');
        }

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

        let verification: Awaited<ReturnType<typeof assertCapabilityVerificationReady>> | null = null;
        if (dto.status === CapabilityStatus.APPROVED) {
            if (!cap.leadNationwide && (cap.leadPostcodeAreas?.length ?? 0) === 0) {
                throw new BadRequestException(
                    'Configure nationwide coverage or at least one postcode area before approving this lead capability.',
                );
            }
            verification = await assertCapabilityVerificationReady(this.prisma, id, cap.serviceType);
        }

        const now = new Date();
        const updated = await this.prisma.contractorCapability.update({
            where: { id },
            data: {
                status: dto.status,
                reviewedAt: now,
                reviewedById: adminId,
                reviewNote: dto.reviewNote ?? null,
                ...(dto.status === CapabilityStatus.APPROVED && verification?.recommendedExpiresAt
                    ? {
                        verificationStatus: 'VERIFIED',
                        verificationCompletedAt: now,
                        verificationExpiresAt: verification.recommendedExpiresAt,
                        verificationReminder30SentAt: null,
                        verificationReminder7SentAt: null,
                    }
                    : dto.status === CapabilityStatus.REJECTED
                        ? { verificationStatus: 'REJECTED' }
                        : {}),
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

        if (approved) {
            await this.rematchOpenLeads(cap.serviceType).catch(() => null);
        }

        return updated;
    }

    async adminRematch(leadId: string, matchSource: 'ADMIN_REMATCH' | 'AUTO_REMATCH' = 'ADMIN_REMATCH') {
        await this.expireOldLeads();

        const result = await this.prisma.$transaction(async (tx) => {
            const lead = await tx.serviceLead.findUnique({
                where: { id: leadId },
                include: {
                    recipients: {
                        select: { contractorId: true },
                    },
                },
            });
            if (!lead) throw new NotFoundException('Enquiry not found');
            this.assertLeadType(lead.serviceType);
            if (
                lead.status !== 'OPEN'
                || lead.expiresAt <= new Date()
                || lead.anonymizedAt
                || !lead.consentToProviderContact
            ) {
                throw new BadRequestException('Only an open, consented enquiry can be rematched.');
            }

            const existingIds = lead.recipients.map((recipient) => recipient.contractorId);
            const slots = MAX_LEAD_RECIPIENTS - existingIds.length;
            if (slots <= 0) {
                return { lead, matching: [] as any[], total: existingIds.length };
            }

            const matching = await this.matchingProviders(tx, {
                serviceType: lead.serviceType,
                postcode: lead.postcode,
                vehicleValuePence: lead.vehicleValuePence,
                vehicleYear: lead.vehicleYear,
                vehicleMileage: lead.vehicleMileage,
                annualIncomePence: lead.annualIncomePence,
                termMonths: lead.termMonths,
                warrantyMonths: lead.warrantyMonths,
                warrantyLevel: lead.warrantyLevel,
            }, existingIds, slots);

            if (matching.length) {
                const now = new Date();
                await tx.serviceLeadRecipient.createMany({
                    data: matching.map((provider: any) => ({
                        leadId: lead.id,
                        contractorId: provider.contractorId,
                        status: 'NEW',
                        matchedAt: now,
                        matchSource,
                        matchReason: provider.matchReason,
                    })),
                    skipDuplicates: true,
                });
            }

            return {
                lead,
                matching,
                total: Math.min(MAX_LEAD_RECIPIENTS, existingIds.length + matching.length),
            };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        await Promise.allSettled(result.matching.map((provider: any) => this.notifications.create({
            userId: provider.contractor.userId,
            type: 'SERVICE_LEAD_NEW',
            title: result.lead.serviceType === ServiceType.FINANCE ? 'New finance enquiry' : 'New warranty enquiry',
            message: matchSource === 'AUTO_REMATCH'
                ? 'A relevant open CarMazium enquiry has been matched to your provider account.'
                : 'A CarMazium administrator matched a relevant enquiry to your provider account.',
            link: '/dashboard/service/leads',
            entityType: 'ServiceLead',
            entityId: result.lead.id,
            actionType: matchSource,
        })));

        return {
            added: result.matching.length,
            recipientCount: result.total,
            recipientLimit: MAX_LEAD_RECIPIENTS,
        };
    }

    /**
     * Revisit still-open, consented enquiries so newly approved providers or
     * updated matching coverage can receive work that was posted before they
     * became eligible. The unique lead/provider constraint keeps this
     * idempotent and every lead still caps at MAX_LEAD_RECIPIENTS.
     */
    async rematchOpenLeads(serviceType?: ServiceType, limit = 250) {
        if (serviceType) this.assertLeadType(serviceType);
        const now = new Date();
        const leads = await this.prisma.serviceLead.findMany({
            where: {
                status: 'OPEN',
                expiresAt: { gt: now },
                anonymizedAt: null,
                consentToProviderContact: true,
                ...(serviceType ? { serviceType } : { serviceType: { in: [...LEAD_TYPES] } }),
            },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
            take: Math.min(Math.max(limit, 1), 500),
        });

        let recipientsAdded = 0;
        let leadsUpdated = 0;
        for (const lead of leads) {
            try {
                const result = await this.adminRematch(lead.id, 'AUTO_REMATCH');
                if (result.added > 0) {
                    recipientsAdded += result.added;
                    leadsUpdated += 1;
                }
            } catch (error: any) {
                // A lead can close/expire between the list and its serializable
                // rematch transaction. That race is harmless; the next hourly
                // lifecycle pass will revisit remaining open enquiries.
                if (!(error instanceof BadRequestException || error instanceof NotFoundException)) {
                    throw error;
                }
            }
        }
        return { scanned: leads.length, leadsUpdated, recipientsAdded };
    }

    async adminList(serviceType?: ServiceType, status?: string, query?: string) {
        if (serviceType) this.assertLeadType(serviceType);
        const q = query?.trim().slice(0, 100) || undefined;

        const leads = await this.prisma.serviceLead.findMany({
            where: {
                ...(serviceType ? { serviceType } : {}),
                ...(status ? { status } : {}),
                ...(q ? {
                    OR: [
                        { vehicleRegistration: { contains: q, mode: 'insensitive' } },
                        { vehicleMake: { contains: q, mode: 'insensitive' } },
                        { vehicleModel: { contains: q, mode: 'insensitive' } },
                        { fullName: { contains: q, mode: 'insensitive' } },
                        { email: { contains: q, mode: 'insensitive' } },
                        { phone: { contains: q } },
                        { postcode: { contains: q, mode: 'insensitive' } },
                    ],
                } : {}),
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
