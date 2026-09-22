import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { CapabilityStatus, Prisma, ServiceJobStatus, ServicePaymentStatus, ServiceType } from '@prisma/client';
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

export interface AdminProviderDetailsUpdateInput {
    businessName: string;
    phone?: string;
    serviceArea?: string;
}

export interface AdminCapabilityEvidenceMetadataInput extends CapabilityEvidenceUploadInput {}

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

    private parseOptionalDate(value: unknown, field: string): Date | null {
        if (value === undefined || value === null || value === '') return null;
        if (typeof value !== 'string') throw new BadRequestException(`${field} must be a date.`);
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} is invalid.`);
        return date;
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

    private async listCapabilityEvidence(capabilityId: string) {
        const entries = await this.listEntries('CAPABILITY', capabilityId);
        return entries.filter((entry) => entry.kind === 'DOCUMENT' || entry.kind === 'PHOTO');
    }

    private async addCapabilityAuditNote(
        adminId: string,
        capabilityId: string,
        note: string,
    ) {
        return this.insertEntry(
            'CAPABILITY',
            capabilityId,
            adminId,
            { kind: 'NOTE', note },
            ['NOTE'],
        );
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
            SELECT "id", "storagePath", "submittedById", "kind", "evidenceStatus"
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
        if (scope === 'CAPABILITY' && submittedById && entry.evidenceStatus && entry.evidenceStatus !== 'PENDING') {
            throw new BadRequestException('Reviewed verification evidence is retained for audit and cannot be deleted by the provider.');
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
        return this.listCapabilityEvidence(capabilityId);
    }

    async providerCapabilityVerification(userId: string, capabilityId: string) {
        const capability = await this.ownedCapability(userId, capabilityId);
        const [verification, attachments] = await Promise.all([
            getCapabilityVerificationSummary(this.prisma, capabilityId),
            this.listCapabilityEvidence(capabilityId),
        ]);
        return {
            capabilityId,
            serviceType: capability.serviceType,
            verification,
            attachments,
        };
    }

    async uploadProviderCapabilityDocument(
        userId: string,
        capabilityId: string,
        file: any,
        input: CapabilityEvidenceUploadInput,
    ) {
        const capability = await this.ownedCapability(userId, capabilityId);
        const requirement = capabilityEvidenceRequirement(capability.serviceType, input?.evidenceType);
        if (!requirement) {
            throw new BadRequestException('Choose a verification evidence type required for this service.');
        }

        const validFrom = this.parseOptionalDate(input?.validFrom, 'Valid-from date');
        const expiresAt = this.parseOptionalDate(input?.expiresAt, 'Expiry date');
        if (requirement.expiryRequired && !expiresAt) {
            throw new BadRequestException(`${requirement.title} requires an expiry date.`);
        }
        if (expiresAt && expiresAt <= new Date()) {
            throw new BadRequestException('Verification evidence must be current and not already expired.');
        }
        if (validFrom && expiresAt && validFrom > expiresAt) {
            throw new BadRequestException('Valid-from date cannot be after the expiry date.');
        }

        const existing = await this.listCapabilityEvidence(capabilityId);
        if (existing.filter((e) => e.kind === 'DOCUMENT' || e.kind === 'PHOTO').length >= 30) {
            throw new BadRequestException('A maximum of 30 verification evidence files can be retained on one service application.');
        }
        if (!file) throw new BadRequestException('Choose a document to upload.');

        const entry = await this.uploadDocument(
            'CAPABILITY',
            capabilityId,
            userId,
            file,
            input?.label,
            {
                type: input.evidenceType,
                status: 'PENDING',
                issuer: this.cleanText(input?.issuer, 160),
                reference: this.cleanText(input?.reference, 160),
                validFrom,
                expiresAt,
            },
        );

        if (capability.status !== CapabilityStatus.APPROVED) {
            await this.prisma.contractorCapability.update({
                where: { id: capabilityId },
                data: {
                    verificationStatus: 'IN_REVIEW',
                    verificationCompletedAt: null,
                    verificationExpiresAt: null,
                    verificationReminder30SentAt: null,
                    verificationReminder7SentAt: null,
                },
            });
        }
        return entry;
    }

    async deleteProviderCapabilityDocument(userId: string, capabilityId: string, entryId: string) {
        const capability = await this.ownedCapability(userId, capabilityId);
        const result = await this.deleteStoredEntry('CAPABILITY', capabilityId, entryId, userId);
        if (capability.status !== CapabilityStatus.APPROVED) {
            const summary = await getCapabilityVerificationSummary(this.prisma, capabilityId);
            await this.prisma.contractorCapability.update({
                where: { id: capabilityId },
                data: { verificationStatus: pendingVerificationStatus(summary.requirements) },
            });
        }
        return result;
    }

    private async refreshCapabilityVerificationAfterMutation(
        capabilityId: string,
        capabilityStatus: CapabilityStatus,
        adminId: string,
        now = new Date(),
    ) {
        const summary = await getCapabilityVerificationSummary(this.prisma, capabilityId);
        if (capabilityStatus === CapabilityStatus.APPROVED && summary.ready && summary.recommendedExpiresAt) {
            await this.prisma.contractorCapability.update({
                where: { id: capabilityId },
                data: {
                    verificationStatus: 'VERIFIED',
                    verificationExpiresAt: summary.recommendedExpiresAt,
                    verificationReminder30SentAt: null,
                    verificationReminder7SentAt: null,
                },
            });
        } else if (capabilityStatus === CapabilityStatus.APPROVED) {
            await this.prisma.contractorCapability.update({
                where: { id: capabilityId },
                data: {
                    status: CapabilityStatus.PENDING,
                    appliedAt: now,
                    reviewedAt: now,
                    reviewedById: adminId,
                    verificationStatus: 'REVERIFICATION_REQUIRED',
                    verificationCompletedAt: null,
                    verificationExpiresAt: null,
                    verificationReminder30SentAt: null,
                    verificationReminder7SentAt: null,
                    reviewNote: 'Verification evidence changed and must be reviewed again before taking new work.',
                },
            });
        } else {
            await this.prisma.contractorCapability.update({
                where: { id: capabilityId },
                data: {
                    verificationStatus: pendingVerificationStatus(summary.requirements),
                    verificationCompletedAt: null,
                    verificationExpiresAt: null,
                    verificationReminder30SentAt: null,
                    verificationReminder7SentAt: null,
                },
            });
        }
        return getCapabilityVerificationSummary(this.prisma, capabilityId);
    }

    async adminUpdateProviderDetails(
        adminId: string,
        capabilityId: string,
        input: AdminProviderDetailsUpdateInput,
    ) {
        const businessName = this.cleanText(input?.businessName, 120);
        if (!businessName) throw new BadRequestException('Business name is required.');
        const phone = this.cleanText(input?.phone, 30);
        const serviceArea = this.cleanText(input?.serviceArea, 200);

        const capability = await this.prisma.contractorCapability.findUnique({
            where: { id: capabilityId },
            include: {
                contractor: {
                    include: {
                        user: {
                            select: {
                                dealerProfile: { select: { id: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!capability) throw new NotFoundException('Provider application not found.');

        await this.prisma.$transaction(async (tx) => {
            await tx.contractorProfile.update({
                where: { id: capability.contractor.id },
                data: { businessName, phone, serviceArea },
            });
            const dealerProfileId = capability.contractor.user?.dealerProfile?.id;
            if (dealerProfileId) {
                await tx.dealerProfile.update({
                    where: { id: dealerProfileId },
                    data: {
                        companyName: businessName,
                        phone,
                        businessAddress: serviceArea,
                    },
                });
            }
        });

        await this.addCapabilityAuditNote(
            adminId,
            capabilityId,
            'Admin corrected provider business details (business name, phone and/or service area).',
        );

        return this.adminCapabilityDetail(capabilityId);
    }

    async adminUploadCapabilityDocument(
        adminId: string,
        capabilityId: string,
        file: any,
        input: CapabilityEvidenceUploadInput,
    ) {
        const capability = await this.prisma.contractorCapability.findUnique({
            where: { id: capabilityId },
            select: { id: true, serviceType: true, status: true },
        });
        if (!capability) throw new NotFoundException('Provider application not found.');

        const requirement = capabilityEvidenceRequirement(capability.serviceType, input?.evidenceType);
        if (!requirement) {
            throw new BadRequestException('Choose a verification evidence type required for this service.');
        }
        const validFrom = this.parseOptionalDate(input?.validFrom, 'Valid-from date');
        const expiresAt = this.parseOptionalDate(input?.expiresAt, 'Expiry date');
        if (requirement.expiryRequired && !expiresAt) {
            throw new BadRequestException(`${requirement.title} requires an expiry date.`);
        }
        if (expiresAt && expiresAt <= new Date()) {
            throw new BadRequestException('Verification evidence must be current and not already expired.');
        }
        if (validFrom && expiresAt && validFrom > expiresAt) {
            throw new BadRequestException('Valid-from date cannot be after the expiry date.');
        }
        if (!file) throw new BadRequestException('Choose a document to upload.');

        const existing = await this.listEntries('CAPABILITY', capabilityId);
        if (existing.filter((e) => e.kind === 'DOCUMENT' || e.kind === 'PHOTO').length >= 30) {
            throw new BadRequestException('A maximum of 30 verification evidence files can be retained on one service application.');
        }

        const evidence = await this.uploadDocument(
            'CAPABILITY',
            capabilityId,
            adminId,
            file,
            input?.label,
            {
                type: input.evidenceType,
                status: 'PENDING',
                issuer: this.cleanText(input?.issuer, 160),
                reference: this.cleanText(input?.reference, 160),
                validFrom,
                expiresAt,
            },
        );
        const verification = await this.refreshCapabilityVerificationAfterMutation(
            capabilityId,
            capability.status,
            adminId,
        );
        return { evidence, verification };
    }

    async adminUpdateCapabilityEvidenceMetadata(
        adminId: string,
        capabilityId: string,
        entryId: string,
        input: AdminCapabilityEvidenceMetadataInput,
    ) {
        const capability = await this.prisma.contractorCapability.findUnique({
            where: { id: capabilityId },
            select: { id: true, serviceType: true, status: true },
        });
        if (!capability) throw new NotFoundException('Provider application not found.');

        const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT "id", "kind", "evidenceType", "evidenceStatus"
            FROM "service_case_entries"
            WHERE "id" = ${entryId}
              AND "scope" = 'CAPABILITY'
              AND "entityId" = ${capabilityId}
            LIMIT 1
        `);
        const entry = rows[0];
        if (!entry) throw new NotFoundException('Verification evidence not found.');
        if (entry.kind !== 'DOCUMENT' && entry.kind !== 'PHOTO') {
            throw new BadRequestException('Only verification document metadata can be edited.');
        }
        if (entry.evidenceStatus === 'SUPERSEDED') {
            throw new BadRequestException('Superseded evidence is retained for audit and cannot be edited.');
        }

        const evidenceType = input?.evidenceType || entry.evidenceType;
        const requirement = capabilityEvidenceRequirement(capability.serviceType, evidenceType);
        if (!requirement) {
            throw new BadRequestException('Choose a verification evidence type required for this service.');
        }
        const validFrom = this.parseOptionalDate(input?.validFrom, 'Valid-from date');
        const expiresAt = this.parseOptionalDate(input?.expiresAt, 'Expiry date');
        if (requirement.expiryRequired && !expiresAt) {
            throw new BadRequestException(`${requirement.title} requires an expiry date.`);
        }
        if (expiresAt && expiresAt <= new Date()) {
            throw new BadRequestException('Verification evidence must be current and not already expired.');
        }
        if (validFrom && expiresAt && validFrom > expiresAt) {
            throw new BadRequestException('Valid-from date cannot be after the expiry date.');
        }

        const label = this.cleanText(input?.label, 160);
        const issuer = this.cleanText(input?.issuer, 160);
        const reference = this.cleanText(input?.reference, 160);
        const resetReview = entry.evidenceStatus !== 'PENDING';

        await this.prisma.$executeRaw(Prisma.sql`
            UPDATE "service_case_entries"
            SET
                "label" = ${label},
                "evidenceType" = ${evidenceType},
                "evidenceIssuer" = ${issuer},
                "evidenceReference" = ${reference},
                "evidenceValidFrom" = ${validFrom},
                "evidenceExpiresAt" = ${expiresAt},
                "evidenceStatus" = 'PENDING',
                "evidenceReviewedAt" = NULL,
                "evidenceReviewedById" = NULL,
                "evidenceReviewNote" = ${resetReview ? 'Metadata changed by admin; evidence requires re-review.' : null}
            WHERE "id" = ${entryId}
              AND "scope" = 'CAPABILITY'
              AND "entityId" = ${capabilityId}
        `);

        const verification = await this.refreshCapabilityVerificationAfterMutation(
            capabilityId,
            capability.status,
            adminId,
        );
        await this.addCapabilityAuditNote(
            adminId,
            capabilityId,
            `Admin edited verification evidence metadata for entry ${entryId}; the evidence was returned to pending review.`,
        );
        const evidence = (await this.listCapabilityEvidence(capabilityId))
            .find((item) => item.id === entryId) ?? null;
        return { evidence, verification, editedByAdminId: adminId };
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
        const [caseEntries, verification, statusHistory] = await Promise.all([
            this.listEntries('CAPABILITY', capabilityId),
            getCapabilityVerificationSummary(this.prisma, capabilityId),
            this.prisma.$queryRaw<any[]>(Prisma.sql`
                SELECT
                    h."id", h."capabilityId", h."fromStatus"::text AS "fromStatus",
                    h."toStatus"::text AS "toStatus", h."adminId", h."note", h."createdAt",
                    u."firstName" AS "adminFirstName",
                    u."lastName" AS "adminLastName",
                    u."email" AS "adminEmail"
                FROM "service_capability_status_history" h
                LEFT JOIN "users" u ON u."id" = h."adminId"
                WHERE h."capabilityId" = ${capabilityId}
                ORDER BY h."createdAt" ASC, h."id" ASC
            `),
        ]);
        const attachments = caseEntries.filter((entry) => entry.kind === 'DOCUMENT' || entry.kind === 'PHOTO');
        const auditEntries = caseEntries.filter((entry) => entry.kind === 'NOTE');
        return { ...capability, attachments, auditEntries, verification, statusHistory };
    }

    async adminReviewCapabilityEvidence(
        adminId: string,
        capabilityId: string,
        entryId: string,
        input: CapabilityEvidenceReviewInput,
    ) {
        if (!APPROVABLE_EVIDENCE_STATUSES.includes(input.status as any)) {
            throw new BadRequestException('Evidence review status must be APPROVED or REJECTED.');
        }

        const capability = await this.prisma.contractorCapability.findUnique({
            where: { id: capabilityId },
            select: { id: true, serviceType: true, status: true },
        });
        if (!capability) throw new NotFoundException('Provider application not found.');

        const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT
                "id", "evidenceType", "evidenceStatus", "evidenceExpiresAt",
                "submittedById", "kind"
            FROM "service_case_entries"
            WHERE "id" = ${entryId}
              AND "scope" = 'CAPABILITY'
              AND "entityId" = ${capabilityId}
            LIMIT 1
        `);
        const entry = rows[0];
        if (!entry) throw new NotFoundException('Verification evidence not found.');
        if (!entry.evidenceType) throw new BadRequestException('This file is not classified verification evidence.');

        const requirement = capabilityEvidenceRequirement(capability.serviceType, entry.evidenceType);
        if (!requirement) throw new BadRequestException('This evidence type does not belong to this service.');

        const reviewedExpiry = input.expiresAt !== undefined
            ? this.parseOptionalDate(input.expiresAt, 'Expiry date')
            : entry.evidenceExpiresAt
                ? new Date(entry.evidenceExpiresAt)
                : null;

        if (input.status === 'APPROVED') {
            if (requirement.expiryRequired && !reviewedExpiry) {
                throw new BadRequestException(`${requirement.title} requires an expiry date before approval.`);
            }
            if (reviewedExpiry && reviewedExpiry <= new Date()) {
                throw new BadRequestException('Expired evidence cannot be approved.');
            }
        }

        const note = this.cleanText(input.reviewNote, 1000);
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            if (input.status === 'APPROVED') {
                await tx.$executeRaw(Prisma.sql`
                    UPDATE "service_case_entries"
                    SET
                        "evidenceStatus" = 'SUPERSEDED',
                        "evidenceReviewNote" = COALESCE("evidenceReviewNote", 'Superseded by newer approved evidence.')
                    WHERE "scope" = 'CAPABILITY'
                      AND "entityId" = ${capabilityId}
                      AND "evidenceType" = ${entry.evidenceType}
                      AND "evidenceStatus" = 'APPROVED'
                      AND "id" <> ${entryId}
                `);
            }

            await tx.$executeRaw(Prisma.sql`
                UPDATE "service_case_entries"
                SET
                    "evidenceStatus" = ${input.status},
                    "evidenceExpiresAt" = ${reviewedExpiry},
                    "evidenceReviewedAt" = ${now},
                    "evidenceReviewedById" = ${adminId},
                    "evidenceReviewNote" = ${note}
                WHERE "id" = ${entryId}
                  AND "scope" = 'CAPABILITY'
                  AND "entityId" = ${capabilityId}
            `);
        });

        const summary = await getCapabilityVerificationSummary(this.prisma, capabilityId);
        const approvedAndReady = capability.status === CapabilityStatus.APPROVED
            && summary.ready
            && !!summary.recommendedExpiresAt;

        await this.prisma.contractorCapability.update({
            where: { id: capabilityId },
            data: approvedAndReady
                ? {
                    verificationStatus: 'VERIFIED',
                    verificationCompletedAt: now,
                    verificationExpiresAt: summary.recommendedExpiresAt,
                    verificationReminder30SentAt: null,
                    verificationReminder7SentAt: null,
                }
                : capability.status === CapabilityStatus.APPROVED
                    ? {
                        status: CapabilityStatus.PENDING,
                        appliedAt: now,
                        verificationStatus: 'REVERIFICATION_REQUIRED',
                        verificationCompletedAt: null,
                        verificationExpiresAt: null,
                        verificationReminder30SentAt: null,
                        verificationReminder7SentAt: null,
                        reviewNote: 'Verification evidence is no longer sufficient. Re-verification is required before taking new work.',
                    }
                    : {
                        verificationStatus: pendingVerificationStatus(summary.requirements),
                        verificationCompletedAt: null,
                        verificationExpiresAt: null,
                        verificationReminder30SentAt: null,
                        verificationReminder7SentAt: null,
                    },
        });

        return {
            evidence: (await this.listCapabilityEvidence(capabilityId)).find((item) => item.id === entryId) ?? null,
            verification: await getCapabilityVerificationSummary(this.prisma, capabilityId),
        };
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
        const [caseEntries, settlementOperations, paymentAuditEvents] = await Promise.all([
            this.listEntries('DISPUTE', jobId),
            this.prisma.$queryRaw<any[]>(Prisma.sql`
                SELECT
                    s."id", s."jobId", s."paymentId", s."adminId", s."outcome",
                    s."status", s."note", s."externalReference", s."error",
                    s."attemptCount", s."completedAt", s."createdAt", s."updatedAt",
                    u."firstName" AS "adminFirstName",
                    u."lastName" AS "adminLastName",
                    u."email" AS "adminEmail"
                FROM "service_settlement_operations" s
                LEFT JOIN "users" u ON u."id" = s."adminId"
                WHERE s."jobId" = ${jobId}
                ORDER BY s."createdAt" ASC, s."id" ASC
            `),
            this.prisma.$queryRaw<any[]>(Prisma.sql`
                SELECT
                    a."id", a."paymentId", a."jobId",
                    a."fromStatus"::text AS "fromStatus",
                    a."toStatus"::text AS "toStatus",
                    a."stripeTransferId", a."stripePaymentIntentId", a."createdAt"
                FROM "service_payment_audit_events" a
                WHERE a."jobId" = ${jobId}
                ORDER BY a."createdAt" ASC, a."id" ASC
            `),
        ]);
        return { ...job, caseEntries, settlementOperations, paymentAuditEvents };
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
        if (job.status !== ServiceJobStatus.DISPUTED) {
            throw new BadRequestException('Resolved dispute evidence is immutable.');
        }
        return this.deleteStoredEntry('DISPUTE', jobId, entryId);
    }

    private async ensureResolutionCaseEntry(
        adminId: string,
        jobId: string,
        outcome: 'RELEASE' | 'REFUND',
        note?: string | null,
    ) {
        const existing = await this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT "id"
            FROM "service_case_entries"
            WHERE "scope" = 'DISPUTE'
              AND "entityId" = ${jobId}
              AND "kind" = 'RESOLUTION'
            LIMIT 1
        `);
        if (existing.length) return;

        const decision = outcome === 'RELEASE'
            ? 'Released payment to provider.'
            : 'Refunded customer in full.';
        await this.insertEntry(
            'DISPUTE',
            jobId,
            adminId,
            {
                kind: 'RESOLUTION',
                note: [decision, this.cleanText(note, 4000)].filter(Boolean).join(' '),
            },
            ['RESOLUTION'],
        );
    }

    async adminResolveDispute(
        adminId: string,
        jobId: string,
        input: { outcome: 'RELEASE' | 'REFUND'; note?: string },
    ) {
        if (input.outcome !== 'RELEASE' && input.outcome !== 'REFUND') {
            throw new BadRequestException('Resolution must be RELEASE or REFUND.');
        }

        const note = this.cleanText(input.note, 4000);
        const job = await this.prisma.serviceJob.findUnique({
            where: { id: jobId },
            include: { payment: true },
        });
        if (!job) throw new NotFoundException('Service job not found.');
        if (!job.payment) throw new BadRequestException('This job has no payment to settle.');

        const existing = await this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT *
            FROM "service_settlement_operations"
            WHERE "jobId" = ${jobId}
              AND "paymentId" = ${job.payment.id}
              AND "outcome" = ${input.outcome}
            LIMIT 1
        `);
        const prior = existing[0];

        if (prior?.status === 'SUCCEEDED') {
            try {
                await this.ensureResolutionCaseEntry(adminId, jobId, input.outcome, note);
            } catch (error: any) {
                this.logger.warn(`Settlement ${prior.id} is complete but its case-entry mirror could not be restored: ${error?.message}`);
            }
            return {
                success: true,
                alreadyResolved: true,
                settlementOperationId: prior.id,
                externalReference: prior.externalReference ?? null,
            };
        }

        const terminalMatchesOutcome =
            input.outcome === 'RELEASE'
                ? job.status === ServiceJobStatus.RELEASED && job.payment.status === ServicePaymentStatus.RELEASED
                : job.status === ServiceJobStatus.CANCELLED && job.payment.status === ServicePaymentStatus.REFUNDED;

        if (!terminalMatchesOutcome) {
            if (job.status !== ServiceJobStatus.DISPUTED) {
                throw new BadRequestException('Job is not disputed.');
            }
            if (job.payment.status !== ServicePaymentStatus.PAID) {
                throw new BadRequestException('No held payment to resolve.');
            }
        }

        const operationRows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
            INSERT INTO "service_settlement_operations"
                ("jobId", "paymentId", "adminId", "outcome", "status", "note", "attemptCount", "updatedAt")
            VALUES (
                ${jobId},
                ${job.payment.id},
                ${adminId},
                ${input.outcome},
                'STARTED',
                ${note},
                1,
                CURRENT_TIMESTAMP
            )
            ON CONFLICT ("jobId", "paymentId", "outcome")
            DO UPDATE SET
                "adminId" = EXCLUDED."adminId",
                "note" = EXCLUDED."note",
                "status" = CASE
                    WHEN "service_settlement_operations"."status" = 'SUCCEEDED'
                        THEN 'SUCCEEDED'
                    ELSE 'STARTED'
                END,
                "error" = CASE
                    WHEN "service_settlement_operations"."status" = 'SUCCEEDED'
                        THEN "service_settlement_operations"."error"
                    ELSE NULL
                END,
                "attemptCount" = CASE
                    WHEN "service_settlement_operations"."status" = 'SUCCEEDED'
                        THEN "service_settlement_operations"."attemptCount"
                    ELSE "service_settlement_operations"."attemptCount" + 1
                END,
                "updatedAt" = CURRENT_TIMESTAMP
            RETURNING *
        `);
        const operation = operationRows[0];

        if (terminalMatchesOutcome) {
            const externalReference = input.outcome === 'RELEASE'
                ? job.payment.stripeTransferId
                : job.payment.stripePaymentIntentId
                    ? `refund:${job.payment.stripePaymentIntentId}`
                    : 'refund:completed';
            await this.prisma.$executeRaw(Prisma.sql`
                UPDATE "service_settlement_operations"
                SET "status" = 'SUCCEEDED',
                    "externalReference" = ${externalReference},
                    "error" = NULL,
                    "completedAt" = COALESCE("completedAt", CURRENT_TIMESTAMP),
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = ${operation.id}
            `);
            try {
                await this.ensureResolutionCaseEntry(adminId, jobId, input.outcome, note);
            } catch (error: any) {
                this.logger.warn(`Recovered settlement ${operation.id} but could not restore its case-entry mirror: ${error?.message}`);
            }
            return {
                success: true,
                alreadyResolved: true,
                settlementOperationId: operation.id,
                externalReference,
            };
        }

        try {
            const result = await this.services.adminResolveDispute(adminId, jobId, {
                outcome: input.outcome,
                note: note ?? undefined,
            } as any);
            const externalReference =
                (result as any)?.transferId
                ?? (result as any)?.refundId
                ?? null;

            await this.prisma.$executeRaw(Prisma.sql`
                UPDATE "service_settlement_operations"
                SET "status" = 'SUCCEEDED',
                    "externalReference" = ${externalReference},
                    "error" = NULL,
                    "completedAt" = CURRENT_TIMESTAMP,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = ${operation.id}
            `);

            try {
                await this.ensureResolutionCaseEntry(adminId, jobId, input.outcome, note);
            } catch (error: any) {
                this.logger.warn(`Settlement ${operation.id} succeeded but its case-entry mirror failed: ${error?.message}`);
            }

            return {
                ...result,
                settlementOperationId: operation.id,
                externalReference,
            };
        } catch (error: any) {
            const current = await this.prisma.serviceJob.findUnique({
                where: { id: jobId },
                include: { payment: true },
            });
            const claim = current?.payment?.stripeTransferId;
            const expectedClaim = `claim:${input.outcome.toLowerCase()}:${job.payment.id}`;
            const recoveredSuccess =
                input.outcome === 'RELEASE'
                    ? current?.status === ServiceJobStatus.RELEASED
                        && current?.payment?.status === ServicePaymentStatus.RELEASED
                    : current?.status === ServiceJobStatus.CANCELLED
                        && current?.payment?.status === ServicePaymentStatus.REFUNDED;
            const status = recoveredSuccess
                ? 'SUCCEEDED'
                : claim === expectedClaim
                    ? 'REQUIRES_RECONCILIATION'
                    : 'FAILED';
            const externalReference = recoveredSuccess
                ? input.outcome === 'RELEASE'
                    ? current?.payment?.stripeTransferId ?? null
                    : current?.payment?.stripePaymentIntentId
                        ? `refund:${current.payment.stripePaymentIntentId}`
                        : 'refund:completed'
                : null;
            const errorText = this.cleanText(error?.message || String(error), 2000);

            await this.prisma.$executeRaw(Prisma.sql`
                UPDATE "service_settlement_operations"
                SET "status" = ${status},
                    "externalReference" = ${externalReference},
                    "error" = ${errorText},
                    "completedAt" = CASE WHEN ${status} = 'SUCCEEDED' THEN CURRENT_TIMESTAMP ELSE NULL END,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = ${operation.id}
            `);

            if (recoveredSuccess) {
                try {
                    await this.ensureResolutionCaseEntry(adminId, jobId, input.outcome, note);
                } catch (mirrorError: any) {
                    this.logger.warn(`Recovered settlement ${operation.id} but its case-entry mirror failed: ${mirrorError?.message}`);
                }
                return {
                    success: true,
                    recovered: true,
                    settlementOperationId: operation.id,
                    externalReference,
                };
            }

            throw error;
        }
    }
}
