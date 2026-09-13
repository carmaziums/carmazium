import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CapabilityStatus, Prisma, ServiceJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';

export type ServiceCaseScope = 'CAPABILITY' | 'DISPUTE';
export type ServiceCaseEntryKind = 'DOCUMENT' | 'PHOTO' | 'NOTE' | 'RESOLUTION';

export interface ServiceCaseEntryInput {
    kind?: ServiceCaseEntryKind;
    label?: string;
    url?: string;
    note?: string;
}

@Injectable()
export class ServiceOperationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly services: ServicesService,
    ) { }

    private cleanText(value: unknown, max = 1000): string | null {
        if (typeof value !== 'string') return null;
        const text = value.trim();
        return text ? text.slice(0, max) : null;
    }

    private cleanUrl(value: unknown): string | null {
        const raw = this.cleanText(value, 1500);
        if (!raw) return null;
        let parsed: URL;
        try {
            parsed = new URL(raw);
        } catch {
            throw new BadRequestException('Attachment URL is invalid.');
        }
        if (parsed.protocol !== 'https:') {
            throw new BadRequestException('Attachment URL must use HTTPS.');
        }
        return parsed.toString();
    }

    private async listEntries(scope: ServiceCaseScope, entityId: string) {
        return this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT
                e."id", e."scope", e."entityId", e."submittedById", e."kind",
                e."label", e."url", e."note", e."createdAt",
                u."firstName" AS "submittedByFirstName",
                u."lastName" AS "submittedByLastName",
                u."email" AS "submittedByEmail",
                u."role"::text AS "submittedByRole"
            FROM "service_case_entries" e
            LEFT JOIN "users" u ON u."id" = e."submittedById"
            WHERE e."scope" = ${scope} AND e."entityId" = ${entityId}
            ORDER BY e."createdAt" ASC
        `);
    }

    private async insertEntry(
        scope: ServiceCaseScope,
        entityId: string,
        submittedById: string,
        input: ServiceCaseEntryInput,
        allowedKinds: readonly ServiceCaseEntryKind[],
    ) {
        const kind = (input.kind ?? 'DOCUMENT') as ServiceCaseEntryKind;
        if (!allowedKinds.includes(kind)) throw new BadRequestException('Unsupported case entry type.');

        const label = this.cleanText(input.label, 160);
        const url = this.cleanUrl(input.url);
        const note = this.cleanText(input.note, 4000);
        if (!url && !note) throw new BadRequestException('Add a file or a note.');
        if ((kind === 'DOCUMENT' || kind === 'PHOTO') && !url) {
            throw new BadRequestException('This entry requires an uploaded file.');
        }

        const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
            INSERT INTO "service_case_entries" (
                "id", "scope", "entityId", "submittedById", "kind", "label", "url", "note", "createdAt"
            ) VALUES (
                gen_random_uuid()::text, ${scope}, ${entityId}, ${submittedById}, ${kind},
                ${label}, ${url}, ${note}, CURRENT_TIMESTAMP
            )
            RETURNING *
        `);
        return rows[0];
    }

    private async ownedCapability(userId: string, capabilityId: string) {
        const capability = await this.prisma.contractorCapability.findUnique({
            where: { id: capabilityId },
            include: { contractor: { select: { userId: true } } },
        });
        if (!capability) throw new NotFoundException('Provider application not found.');
        if (capability.contractor.userId !== userId) {
            throw new ForbiddenException('This provider application does not belong to your account.');
        }
        return capability;
    }

    async providerCapabilityEntries(userId: string, capabilityId: string) {
        await this.ownedCapability(userId, capabilityId);
        return this.listEntries('CAPABILITY', capabilityId);
    }

    async addProviderCapabilityEntry(userId: string, capabilityId: string, input: ServiceCaseEntryInput) {
        await this.ownedCapability(userId, capabilityId);
        const existing = await this.listEntries('CAPABILITY', capabilityId);
        if (existing.filter((e) => e.kind === 'DOCUMENT' || e.kind === 'PHOTO').length >= 10) {
            throw new BadRequestException('A maximum of 10 verification documents can be attached to one service application.');
        }
        return this.insertEntry('CAPABILITY', capabilityId, userId, input, ['DOCUMENT', 'PHOTO']);
    }

    async adminCapabilityDetail(capabilityId: string) {
        const capability = await this.prisma.contractorCapability.findUnique({
            where: { id: capabilityId },
            include: {
                contractor: {
                    select: {
                        id: true,
                        businessName: true,
                        phone: true,
                        serviceArea: true,
                        rating: true,
                        totalReviews: true,
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                phone: true,
                                stripeConnectAccountId: true,
                                stripeConnectOnboardingComplete: true,
                            },
                        },
                    },
                },
                reviewedBy: { select: { firstName: true, lastName: true } },
            },
        });
        if (!capability) throw new NotFoundException('Provider application not found.');
        return { ...capability, attachments: await this.listEntries('CAPABILITY', capabilityId) };
    }

    async adminJobDetail(jobId: string) {
        const job = await this.prisma.serviceJob.findUnique({
            where: { id: jobId },
            include: {
                vehicles: { include: { listing: { select: { id: true, slug: true, title: true } } } },
                customer: {
                    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
                },
                contractor: {
                    select: {
                        id: true,
                        businessName: true,
                        phone: true,
                        rating: true,
                        totalReviews: true,
                        serviceArea: true,
                        user: {
                            select: { firstName: true, lastName: true, email: true, phone: true },
                        },
                    },
                },
                quotes: {
                    orderBy: { amountPence: 'asc' },
                    include: {
                        contractor: {
                            select: {
                                id: true,
                                businessName: true,
                                phone: true,
                                rating: true,
                                totalReviews: true,
                                serviceArea: true,
                                user: { select: { firstName: true, lastName: true, email: true, phone: true } },
                            },
                        },
                    },
                },
                payment: true,
            },
        });
        if (!job) throw new NotFoundException('Service job not found.');
        return { ...job, caseEntries: await this.listEntries('DISPUTE', jobId) };
    }

    async adminLeadDetail(leadId: string) {
        await this.prisma.$executeRaw(Prisma.sql`
            UPDATE "service_leads"
            SET "status" = 'EXPIRED', "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${leadId} AND "status" = 'OPEN' AND "expiresAt" <= CURRENT_TIMESTAMP
        `);

        const leads = await this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT * FROM "service_leads" WHERE "id" = ${leadId} LIMIT 1
        `);
        const lead = leads[0];
        if (!lead) throw new NotFoundException('Finance / Warranty enquiry not found.');

        const recipients = await this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT
                r.*, cp."businessName", cp."serviceArea", cp."rating", cp."totalReviews",
                u."firstName" AS "providerFirstName", u."lastName" AS "providerLastName",
                u."email" AS "providerEmail", u."phone" AS "providerPhone"
            FROM "service_lead_recipients" r
            JOIN "contractor_profiles" cp ON cp."id" = r."contractorId"
            JOIN "users" u ON u."id" = cp."userId"
            WHERE r."leadId" = ${leadId}
            ORDER BY r."createdAt" ASC
        `);
        return {
            ...lead,
            recipientCount: recipients.length,
            responseCount: recipients.filter((r) => r.status === 'RESPONDED').length,
            recipients: recipients.map((r) => ({
                ...r,
                representativeApr: r.representativeApr == null ? null : Number(r.representativeApr),
            })),
        };
    }

    async adminAddDisputeEntry(adminId: string, jobId: string, input: ServiceCaseEntryInput) {
        const job = await this.prisma.serviceJob.findUnique({
            where: { id: jobId },
            select: { status: true },
        });
        if (!job) throw new NotFoundException('Service job not found.');
        if (job.status !== ServiceJobStatus.DISPUTED) {
            throw new BadRequestException('Case notes and evidence can only be added while the job is disputed.');
        }
        return this.insertEntry('DISPUTE', jobId, adminId, input, ['DOCUMENT', 'PHOTO', 'NOTE']);
    }

    async adminResolveDispute(
        adminId: string,
        jobId: string,
        input: { outcome: 'RELEASE' | 'REFUND'; note?: string },
    ) {
        if (input.outcome !== 'RELEASE' && input.outcome !== 'REFUND') {
            throw new BadRequestException('Resolution must be RELEASE or REFUND.');
        }
        const result = await this.services.adminResolveDispute(adminId, jobId, input as any);
        const decision = input.outcome === 'RELEASE' ? 'Released payment to provider.' : 'Refunded customer in full.';
        await this.insertEntry(
            'DISPUTE',
            jobId,
            adminId,
            { kind: 'RESOLUTION', note: [decision, this.cleanText(input.note, 4000)].filter(Boolean).join(' ') },
            ['RESOLUTION'],
        );
        return result;
    }
}
