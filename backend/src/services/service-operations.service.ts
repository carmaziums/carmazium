import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { CapabilityStatus, Prisma, ServiceJobStatus, ServiceType } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';
import {
    APPROVABLE_EVIDENCE_STATUSES,
    CapabilityEvidenceStatus,
    CapabilityEvidenceType,
    capabilityEvidenceRequirement,
    getCapabilityVerificationSummary,
    pendingVerificationStatus,
} from './capability-verification';

export type ServiceCaseScope = 'CAPABILITY' | 'DISPUTE';
export type ServiceCaseEntryKind = 'DOCUMENT' | 'PHOTO' | 'NOTE' | 'RESOLUTION';

export interface ServiceCaseEntryInput {
    kind?: ServiceCaseEntryKind;
    label?: string;
    note?: string;
}

export interface CapabilityEvidenceUploadInput {
    evidenceType: CapabilityEvidenceType;
    label?: string;
    issuer?: string;
    reference?: string;
    validFrom?: string;
    expiresAt?: string;
}

export interface CapabilityEvidenceReviewInput {
    status: Extract<CapabilityEvidenceStatus, 'APPROVED' | 'REJECTED'>;
    reviewNote?: string;
    expiresAt?: string;
}

export const TRADEXCHANGE_DOCUMENT_BUCKET = 'tradexchange-documents';
export const TRADEXCHANGE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const TRADEXCHANGE_DOCUMENT_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
] as const;

type TradeXchangeDocumentMime = typeof TRADEXCHANGE_DOCUMENT_MIME_TYPES[number];

export function hasExpectedTradeXchangeDocumentSignature(
    bytes: Uint8Array,
    mime: TradeXchangeDocumentMime,
): boolean {
    if (mime === 'application/pdf') {
        return bytes.length >= 5 &&
            String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
    }
    if (mime === 'image/jpeg') {
        return bytes.length >= 3 &&
            bytes[0] === 0xff &&
            bytes[1] === 0xd8 &&
            bytes[2] === 0xff;
    }
    if (mime === 'image/png') {
        const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        return bytes.length >= signature.length &&
            signature.every((value, index) => bytes[index] === value);
    }
    if (mime === 'image/webp') {
        return bytes.length >= 12 &&
            String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
            String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    }
    return false;
}

@Injectable()
export class ServiceOperationsService {
    private readonly logger = new Logger(ServiceOperationsService.name);
    private readonly supabase: SupabaseClient | null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly services: ServicesService,
    ) {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_KEY;
        if (!url || !serviceKey) {
            this.logger.error('Private TradeXchange documents require SUPABASE_URL and SUPABASE_SERVICE_KEY.');
            this.supabase = null;
            return;
        }
        this.supabase = createClient(url, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }

    private cleanText(value: unknown, max = 1000): string | null {
        if (typeof value !== 'string') return null;
        const text = value.trim();
        return text ? text.slice(0, max) : null;
    }

    private storageClient(): SupabaseClient {
        if (!this.supabase) {
            throw new ServiceUnavailableException('Private TradeXchange document storage is not configured.');
        }
        return this.supabase;
    }

    private extensionForMime(mime: TradeXchangeDocumentMime): string {
        if (mime === 'application/pdf') return 'pdf';
        if (mime === 'image/png') return 'png';
        if (mime === 'image/webp') return 'webp';
        return 'jpg';
    }

    private validateDocumentFile(file: any): TradeXchangeDocumentMime {
        const name = typeof file?.originalname === 'string' ? file.originalname.trim() : '';
        const mime = typeof file?.mimetype === 'string' ? file.mimetype.toLowerCase() : '';
        const size = Number(file?.size || 0);
        const buffer: Buffer | undefined = file?.buffer;

        if (!name || name.length > 255) {
            throw new BadRequestException('Document name is invalid.');
        }
        if (!TRADEXCHANGE_DOCUMENT_MIME_TYPES.includes(mime as TradeXchangeDocumentMime)) {
            throw new BadRequestException('Only PDF, JPEG, PNG and WebP documents are allowed.');
        }
        if (!Number.isInteger(size) || size < 1 || size > TRADEXCHANGE_DOCUMENT_MAX_BYTES) {
            throw new BadRequestException('Documents must be 10 MB or smaller.');
        }
        if (!buffer || buffer.length !== size) {
            throw new BadRequestException('Uploaded document data is incomplete.');
        }

        const allowedMime = mime as TradeXchangeDocumentMime;
        const expectedExtension = this.extensionForMime(allowedMime);
        const suppliedExtension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
        const extensionMatches = allowedMime === 'image/jpeg'
            ? suppliedExtension === 'jpg' || suppliedExtension === 'jpeg'
            : suppliedExtension === expectedExtension;
        if (!extensionMatches) {
            throw new BadRequestException('Document extension does not match its file type.');
        }

        if (!hasExpectedTradeXchangeDocumentSignature(
            new Uint8Array(buffer.subarray(0, 16)),
            allowedMime,
        )) {
            throw new BadRequestException('Uploaded file content does not match its declared type.');
        }
        return allowedMime;
    }

    private async signStoragePath(path: string): Promise<string | null> {
        const { data, error } = await this.storageClient()
            .storage
            .from(TRADEXCHANGE_DOCUMENT_BUCKET)
            .createSignedUrl(path, 10 * 60);
        if (error || !data?.signedUrl) {
            this.logger.warn(`Could not sign private TradeXchange document ${path}: ${error?.message || 'missing URL'}`);
            return null;
        }
        return data.signedUrl;
    }

    private async hydrateEntry(entry: any) {
        const { storagePath, ...safeEntry } = entry;
        return {
            ...safeEntry,
            url: storagePath ? await this.signStoragePath(storagePath) : null,
        };
    }

    private async listEntries(scope: ServiceCaseScope, entityId: string) {
        const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT
                e."id", e."scope", e."entityId", e."submittedById", e."kind",
                e."label", e."storagePath", e."note", e."createdAt",
                e."evidenceType", e."evidenceStatus", e."evidenceIssuer",
                e."evidenceReference", e."evidenceValidFrom", e."evidenceExpiresAt",
                e."evidenceReviewedAt", e."evidenceReviewedById", e."evidenceReviewNote",
                u."firstName" AS "submittedByFirstName",
                u."lastName" AS "submittedByLastName",
                u."email" AS "submittedByEmail",
                u."role"::text AS "submittedByRole",
                reviewer."firstName" AS "evidenceReviewedByFirstName",
                reviewer."lastName" AS "evidenceReviewedByLastName"
            FROM "service_case_entries" e
            LEFT JOIN "users" u ON u."id" = e."submittedById"
            LEFT JOIN "users" reviewer ON reviewer."id" = e."evidenceReviewedById"
            WHERE e."scope" = ${scope} AND e."entityId" = ${entityId}
            ORDER BY e."createdAt" ASC
        `);
        return Promise.all(rows.map((entry) => this.hydrateEntry(entry)));
    }

    private async insertEntry(
        scope: ServiceCaseScope,
        entityId: string,
        submittedById: string,
        input: ServiceCaseEntryInput,
        allowedKinds: readonly ServiceCaseEntryKind[],
        storagePath: string | null = null,
        evidence?: {
            type: CapabilityEvidenceType;
            status: CapabilityEvidenceStatus;
            issuer: string | null;
            reference: string | null;
            validFrom: Date | null;
            expiresAt: Date | null;
        },
    ) {
        const rawInput = input as ServiceCaseEntryInput & { url?: unknown; storagePath?: unknown };
        if (rawInput.url != null || rawInput.storagePath != null) {
            throw new BadRequestException('External attachment URLs and client-supplied storage paths are not accepted.');
        }

        const kind = (input.kind ?? 'DOCUMENT') as ServiceCaseEntryKind;
        if (!allowedKinds.includes(kind)) throw new BadRequestException('Unsupported case entry type.');

        const label = this.cleanText(input.label, 160);
        const note = this.cleanText(input.note, 4000);
        if (!storagePath && !note) throw new BadRequestException('Add a file or a note.');
        if ((kind === 'DOCUMENT' || kind === 'PHOTO') && !storagePath) {
            throw new BadRequestException('This entry requires an uploaded file.');
        }

        const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
            INSERT INTO "service_case_entries" (
                "id", "scope", "entityId", "submittedById", "kind", "label",
                "storagePath", "url", "note",
                "evidenceType", "evidenceStatus", "evidenceIssuer", "evidenceReference",
                "evidenceValidFrom", "evidenceExpiresAt", "createdAt"
            ) VALUES (
                gen_random_uuid()::text, ${scope}, ${entityId}, ${submittedById}, ${kind}, ${label},
                ${storagePath}, NULL, ${note},
                ${evidence?.type ?? null}, ${evidence?.status ?? null},
                ${evidence?.issuer ?? null}, ${evidence?.reference ?? null},
                ${evidence?.validFrom ?? null}, ${evidence?.expiresAt ?? null}, CURRENT_TIMESTAMP
            )
            RETURNING *
        `);
        return rows[0];
    }

    private async uploadDocument(
        scope: ServiceCaseScope,
        entityId: string,
        submittedById: string,
        file: any,
        label?: string,
        evidence?: {
            type: CapabilityEvidenceType;
            status: CapabilityEvidenceStatus;
            issuer: string | null;
            reference: string | null;
            validFrom: Date | null;
            expiresAt: Date | null;
        },
    ) {
        const mime = this.validateDocumentFile(file);
        const kind: ServiceCaseEntryKind = mime === 'application/pdf' ? 'DOCUMENT' : 'PHOTO';
        const scopeFolder = scope === 'CAPABILITY' ? 'capabilities' : 'disputes';
        const path = `${scopeFolder}/${entityId}/${submittedById}/${randomUUID()}.${this.extensionForMime(mime)}`;
        const bucket = this.storageClient().storage.from(TRADEXCHANGE_DOCUMENT_BUCKET);

        const { error } = await bucket.upload(path, file.buffer, {
            contentType: mime,
            cacheControl: '0',
            upsert: false,
        });
        if (error) {
            this.logger.error(`Could not upload private TradeXchange document for ${submittedById}: ${error.message}`);
            throw new ServiceUnavailableException('Could not store the document securely.');
        }

        try {
            const entry = await this.insertEntry(
                scope,
                entityId,
                submittedById,
                { kind, label: this.cleanText(label, 160) || file.originalname },
                [kind],
                path,
                evidence,
            );
            return this.hydrateEntry(entry);
        } catch (error) {
            await bucket.remove([path]).catch(() => undefined);
            throw error;
        }
    }

    private async deleteStoredEntry(
        scope: ServiceCaseScope,
        entityId: string,
        entryId: string,
        submittedById?: string,
    ) {
        const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT "id", "storagePath", "submittedById", "kind"
            FROM "service_case_entries"
            WHERE "id" = ${entryId}
              AND "scope" = ${scope}
              AND "entityId" = ${entityId}
            LIMIT 1
        `);
        const entry = rows[0];
        if (!entry) throw new NotFoundException('Document entry not found.');
        if (submittedById && entry.submittedById !== submittedById) {
            throw new ForbiddenException('You can only remove documents uploaded by your account.');
        }
        if (!entry.storagePath || (entry.kind !== 'DOCUMENT' && entry.kind !== 'PHOTO')) {
            throw new BadRequestException('Only stored document entries can be removed.');
        }

        const { error } = await this.storageClient()
            .storage
            .from(TRADEXCHANGE_DOCUMENT_BUCKET)
            .remove([entry.storagePath]);
        if (error) {
            this.logger.error(`Could not remove private TradeXchange document ${entry.storagePath}: ${error.message}`);
            throw new ServiceUnavailableException('Could not remove the stored document.');
        }

        await this.prisma.$executeRaw(Prisma.sql`
            DELETE FROM "service_case_entries"
            WHERE "id" = ${entryId} AND "scope" = ${scope} AND "entityId" = ${entityId}
        `);
        return { deleted: true };
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

    async uploadProviderCapabilityDocument(
        userId: string,
        capabilityId: string,
        file: any,
        label?: string,
    ) {
        await this.ownedCapability(userId, capabilityId);
        const existing = await this.listEntries('CAPABILITY', capabilityId);
        if (existing.filter((e) => e.kind === 'DOCUMENT' || e.kind === 'PHOTO').length >= 10) {
            throw new BadRequestException('A maximum of 10 verification documents can be attached to one service application.');
        }
        if (!file) throw new BadRequestException('Choose a document to upload.');
        return this.uploadDocument('CAPABILITY', capabilityId, userId, file, label);
    }

    async deleteProviderCapabilityDocument(userId: string, capabilityId: string, entryId: string) {
        await this.ownedCapability(userId, capabilityId);
        return this.deleteStoredEntry('CAPABILITY', capabilityId, entryId, userId);
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
        return this.insertEntry('DISPUTE', jobId, adminId, input, ['NOTE']);
    }

    async adminUploadDisputeDocument(adminId: string, jobId: string, file: any, label?: string) {
        const job = await this.prisma.serviceJob.findUnique({
            where: { id: jobId },
            select: { status: true },
        });
        if (!job) throw new NotFoundException('Service job not found.');
        if (job.status !== ServiceJobStatus.DISPUTED) {
            throw new BadRequestException('Evidence can only be added while the job is disputed.');
        }
        if (!file) throw new BadRequestException('Choose an evidence file to upload.');
        return this.uploadDocument('DISPUTE', jobId, adminId, file, label);
    }

    async adminDeleteDisputeDocument(jobId: string, entryId: string) {
        const job = await this.prisma.serviceJob.findUnique({
            where: { id: jobId },
            select: { status: true },
        });
        if (!job) throw new NotFoundException('Service job not found.');
        return this.deleteStoredEntry('DISPUTE', jobId, entryId);
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
