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

const LEAD_TYPES = [ServiceType.FINANCE, ServiceType.WARRANTY] as const;

type LeadType = (typeof LEAD_TYPES)[number];

type RawLead = {
    id: string;
    customerId: string;
    serviceType: ServiceType;
    status: string;
    listingId: string | null;
    vehicleRegistration: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehicleYear: number | null;
    vehicleMileage: number | null;
    vehicleValuePence: number | null;
    fullName: string;
    email: string;
    phone: string | null;
    postcode: string | null;
    summary: string | null;
    depositPence: number | null;
    termMonths: number | null;
    monthlyBudgetPence: number | null;
    employmentStatus: string | null;
    annualIncomePence: number | null;
    warrantyMonths: number | null;
    warrantyLevel: string | null;
    consentToProviderContact: boolean;
    consentRecordedAt: Date | null;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    recipientCount?: number | bigint;
    responseCount?: number | bigint;
};

type RawRecipient = {
    id: string;
    leadId: string;
    contractorId: string;
    status: string;
    headline: string | null;
    message: string | null;
    productName: string | null;
    indicativePricePence: number | null;
    representativeApr: Prisma.Decimal | number | string | null;
    termMonths: number | null;
    viewedAt: Date | null;
    respondedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    businessName?: string | null;
    rating?: number | null;
    totalReviews?: number | null;
    serviceArea?: string | null;
};

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

    private cleanLead<T extends RawLead>(lead: T) {
        return {
            ...lead,
            recipientCount: lead.recipientCount === undefined ? undefined : Number(lead.recipientCount),
            responseCount: lead.responseCount === undefined ? undefined : Number(lead.responseCount),
        };
    }

    private cleanRecipient<T extends RawRecipient>(recipient: T) {
        return {
            ...recipient,
            representativeApr: recipient.representativeApr === null || recipient.representativeApr === undefined
                ? null
                : Number(recipient.representativeApr),
        };
    }

    private async expireOldLeads() {
        await this.prisma.$executeRaw(Prisma.sql`
            UPDATE "service_leads"
            SET "status" = 'EXPIRED', "updatedAt" = CURRENT_TIMESTAMP
            WHERE "status" = 'OPEN' AND "expiresAt" <= CURRENT_TIMESTAMP
        `);
    }

    async create(customerId: string, dto: CreateServiceLeadDto) {
        this.assertLeadType(dto.serviceType);
        if (!dto.consentToProviderContact) {
            throw new BadRequestException(
                'Consent is required before CarMazium can share this enquiry with approved providers.',
            );
        }

        if (dto.serviceType === ServiceType.WARRANTY &&
            !dto.vehicleRegistration && !(dto.vehicleMake && dto.vehicleModel)) {
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

        const lead = await this.prisma.$transaction(async (tx) => {
            const rows = await tx.$queryRaw<RawLead[]>(Prisma.sql`
                INSERT INTO "service_leads" (
                    "customerId", "serviceType", "status", "listingId",
                    "vehicleRegistration", "vehicleMake", "vehicleModel", "vehicleYear", "vehicleMileage", "vehicleValuePence",
                    "fullName", "email", "phone", "postcode", "summary",
                    "depositPence", "termMonths", "monthlyBudgetPence", "employmentStatus", "annualIncomePence",
                    "warrantyMonths", "warrantyLevel", "consentToProviderContact", "consentRecordedAt",
                    "expiresAt", "createdAt", "updatedAt"
                ) VALUES (
                    ${customerId}, CAST(${serviceType} AS service_type), 'OPEN', ${dto.listingId ?? null},
                    ${registration}, ${dto.vehicleMake?.trim() || null}, ${dto.vehicleModel?.trim() || null}, ${dto.vehicleYear ?? null},
                    ${dto.vehicleMileage ?? null}, ${dto.vehicleValuePence ?? null},
                    ${fullName}, ${customer.email}, ${phone}, ${postcode}, ${dto.summary?.trim() || null},
                    ${serviceType === ServiceType.FINANCE ? dto.depositPence ?? null : null},
                    ${serviceType === ServiceType.FINANCE ? dto.termMonths ?? null : null},
                    ${serviceType === ServiceType.FINANCE ? dto.monthlyBudgetPence ?? null : null},
                    ${serviceType === ServiceType.FINANCE ? dto.employmentStatus?.trim() || null : null},
                    ${serviceType === ServiceType.FINANCE ? dto.annualIncomePence ?? null : null},
                    ${serviceType === ServiceType.WARRANTY ? dto.warrantyMonths ?? null : null},
                    ${serviceType === ServiceType.WARRANTY ? dto.warrantyLevel?.trim() || null : null},
                    TRUE, CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP + INTERVAL '14 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                RETURNING *
            `);
            const created = rows[0];
            if (!created) throw new Error('Lead insert returned no row');

            await tx.$executeRaw(Prisma.sql`
                INSERT INTO "service_lead_recipients" (
                    "id", "leadId", "contractorId", "status", "createdAt", "updatedAt"
                )
                SELECT gen_random_uuid()::text, ${created.id}, cc."contractorId", 'NEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                FROM "contractor_capabilities" cc
                JOIN "contractor_profiles" cp ON cp."id" = cc."contractorId"
                WHERE cc."serviceType" = CAST(${serviceType} AS service_type)
                  AND cc."status" = CAST('APPROVED' AS capability_status)
                  AND cp."deletedAt" IS NULL
                ON CONFLICT ("leadId", "contractorId") DO NOTHING
            `);

            const count = await tx.$queryRaw<{ count: bigint }[]>(Prisma.sql`
                SELECT COUNT(*)::bigint AS count
                FROM "service_lead_recipients"
                WHERE "leadId" = ${created.id}
            `);
            return { ...created, recipientCount: count[0]?.count ?? 0n };
        });

        // Best-effort in-app alert. The database transaction above is already
        // complete, so a notification failure can never lose the enquiry.
        const matching = await this.prisma.contractorCapability.findMany({
            where: {
                serviceType,
                status: CapabilityStatus.APPROVED,
                contractor: { deletedAt: null },
            },
            select: { contractor: { select: { userId: true } } },
        });
        await Promise.allSettled(matching.map((m) => this.notifications.create({
            userId: m.contractor.userId,
            type: 'SERVICE_LEAD_NEW',
            title: serviceType === ServiceType.FINANCE ? 'New finance enquiry' : 'New warranty enquiry',
            message: 'A new matched CarMazium enquiry is available in your provider inbox.',
            link: '/dashboard/service/leads',
            entityType: 'ServiceLead',
            entityId: lead.id,
            actionType: 'CREATED',
        })));

        return this.cleanLead(lead);
    }

    async myLeads(customerId: string) {
        await this.expireOldLeads();
        const rows = await this.prisma.$queryRaw<RawLead[]>(Prisma.sql`
            SELECT l.*,
                (SELECT COUNT(*) FROM "service_lead_recipients" r WHERE r."leadId" = l."id") AS "recipientCount",
                (SELECT COUNT(*) FROM "service_lead_recipients" r WHERE r."leadId" = l."id" AND r."status" = 'RESPONDED') AS "responseCount"
            FROM "service_leads" l
            WHERE l."customerId" = ${customerId}
            ORDER BY l."createdAt" DESC
        `);
        return rows.map((r) => this.cleanLead(r));
    }

    async customerLead(customerId: string, id: string) {
        await this.expireOldLeads();
        const rows = await this.prisma.$queryRaw<RawLead[]>(Prisma.sql`
            SELECT l.*,
                (SELECT COUNT(*) FROM "service_lead_recipients" r WHERE r."leadId" = l."id") AS "recipientCount",
                (SELECT COUNT(*) FROM "service_lead_recipients" r WHERE r."leadId" = l."id" AND r."status" = 'RESPONDED') AS "responseCount"
            FROM "service_leads" l
            WHERE l."id" = ${id} AND l."customerId" = ${customerId}
            LIMIT 1
        `);
        const lead = rows[0];
        if (!lead) throw new NotFoundException('Enquiry not found');

        const responses = await this.prisma.$queryRaw<RawRecipient[]>(Prisma.sql`
            SELECT r.*, cp."businessName", cp."rating", cp."totalReviews", cp."serviceArea"
            FROM "service_lead_recipients" r
            JOIN "contractor_profiles" cp ON cp."id" = r."contractorId"
            WHERE r."leadId" = ${id} AND r."status" = 'RESPONDED'
            ORDER BY r."respondedAt" ASC NULLS LAST, r."createdAt" ASC
        `);
        return { ...this.cleanLead(lead), responses: responses.map((r) => this.cleanRecipient(r)) };
    }

    async close(customerId: string, id: string) {
        const rows = await this.prisma.$queryRaw<RawLead[]>(Prisma.sql`
            UPDATE "service_leads"
            SET "status" = 'CLOSED', "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${id} AND "customerId" = ${customerId} AND "status" = 'OPEN'
            RETURNING *
        `);
        if (!rows[0]) throw new BadRequestException('Only an open enquiry can be closed.');
        await this.prisma.$executeRaw(Prisma.sql`
            UPDATE "service_lead_recipients"
            SET "status" = CASE WHEN "status" = 'RESPONDED' THEN 'RESPONDED' ELSE 'CLOSED' END,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "leadId" = ${id}
        `);
        return this.cleanLead(rows[0]);
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
        for (const type of types) {
            this.assertLeadType(type);
            await this.prisma.$executeRaw(Prisma.sql`
                INSERT INTO "service_lead_recipients" (
                    "id", "leadId", "contractorId", "status", "createdAt", "updatedAt"
                )
                SELECT gen_random_uuid()::text, l."id", ${contractorId}, 'NEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                FROM "service_leads" l
                WHERE l."serviceType" = CAST(${type} AS service_type)
                  AND l."status" = 'OPEN'
                  AND l."expiresAt" > CURRENT_TIMESTAMP
                  AND l."consentToProviderContact" = TRUE
                ON CONFLICT ("leadId", "contractorId") DO NOTHING
            `);
        }
    }

    async inbox(userId: string, serviceType?: ServiceType) {
        const profile = await this.providerProfile(userId, serviceType);
        const types = profile.capabilities.map((c) => c.serviceType);
        await this.ensureRecipients(profile.id, types);

        const typeFilter = serviceType
            ? Prisma.sql`AND l."serviceType" = CAST(${serviceType} AS service_type)`
            : Prisma.empty;
        const rows = await this.prisma.$queryRaw<Array<RawLead & RawRecipient>>(Prisma.sql`
            SELECT l.*,
                r."id" AS "recipientId", r."status" AS "recipientStatus",
                r."headline", r."message", r."productName", r."indicativePricePence",
                r."representativeApr", r."termMonths" AS "responseTermMonths",
                r."viewedAt", r."respondedAt"
            FROM "service_lead_recipients" r
            JOIN "service_leads" l ON l."id" = r."leadId"
            WHERE r."contractorId" = ${profile.id}
              AND l."status" = 'OPEN'
              AND l."expiresAt" > CURRENT_TIMESTAMP
              ${typeFilter}
            ORDER BY l."createdAt" DESC
        `);

        // Viewing the inbox is enough to mark unseen rows as VIEWED. This does
        // not expose or alter the customer enquiry itself.
        await this.prisma.$executeRaw(Prisma.sql`
            UPDATE "service_lead_recipients"
            SET "status" = 'VIEWED', "viewedAt" = COALESCE("viewedAt", CURRENT_TIMESTAMP), "updatedAt" = CURRENT_TIMESTAMP
            WHERE "contractorId" = ${profile.id} AND "status" = 'NEW'
        `);

        return rows.map((r: any) => ({
            ...this.cleanLead(r),
            representativeApr: r.representativeApr == null ? null : Number(r.representativeApr),
        }));
    }

    async respond(userId: string, leadId: string, dto: RespondToServiceLeadDto) {
        const profile = await this.providerProfile(userId);
        const leadRows = await this.prisma.$queryRaw<Pick<RawLead, 'id' | 'customerId' | 'serviceType' | 'status' | 'expiresAt'>[]>(Prisma.sql`
            SELECT "id", "customerId", "serviceType", "status", "expiresAt"
            FROM "service_leads"
            WHERE "id" = ${leadId}
            LIMIT 1
        `);
        const lead = leadRows[0];
        if (!lead) throw new NotFoundException('Enquiry not found');
        this.assertLeadType(lead.serviceType);
        if (lead.status !== 'OPEN' || lead.expiresAt <= new Date()) {
            throw new BadRequestException('This enquiry is no longer open.');
        }
        if (!profile.capabilities.some((c) => c.serviceType === lead.serviceType)) {
            throw new ForbiddenException('You are not approved for this type of enquiry.');
        }
        await this.ensureRecipients(profile.id, [lead.serviceType]);

        const rows = await this.prisma.$queryRaw<RawRecipient[]>(Prisma.sql`
            UPDATE "service_lead_recipients"
            SET "status" = 'RESPONDED',
                "headline" = ${dto.headline.trim()},
                "message" = ${dto.message.trim()},
                "productName" = ${dto.productName?.trim() || null},
                "indicativePricePence" = ${dto.indicativePricePence ?? null},
                "representativeApr" = ${dto.representativeApr ?? null},
                "termMonths" = ${dto.termMonths ?? null},
                "viewedAt" = COALESCE("viewedAt", CURRENT_TIMESTAMP),
                "respondedAt" = CURRENT_TIMESTAMP,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "leadId" = ${leadId} AND "contractorId" = ${profile.id}
            RETURNING *
        `);
        const response = rows[0];
        if (!response) throw new ForbiddenException('This enquiry was not matched to your provider account.');

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
        const typeFilter = serviceType
            ? Prisma.sql`AND l."serviceType" = CAST(${serviceType} AS service_type)`
            : Prisma.empty;
        const statusFilter = status ? Prisma.sql`AND l."status" = ${status}` : Prisma.empty;
        const rows = await this.prisma.$queryRaw<RawLead[]>(Prisma.sql`
            SELECT l.*,
                (SELECT COUNT(*) FROM "service_lead_recipients" r WHERE r."leadId" = l."id") AS "recipientCount",
                (SELECT COUNT(*) FROM "service_lead_recipients" r WHERE r."leadId" = l."id" AND r."status" = 'RESPONDED') AS "responseCount"
            FROM "service_leads" l
            WHERE 1=1 ${typeFilter} ${statusFilter}
            ORDER BY l."createdAt" DESC
            LIMIT 250
        `);
        return rows.map((r) => this.cleanLead(r));
    }
}

function normPostcode(value?: string | null): string | null {
    const p = value?.trim().toUpperCase().replace(/\s+/g, '');
    if (!p) return null;
    return p.length > 3 ? `${p.slice(0, -3)} ${p.slice(-3)}` : p;
}
