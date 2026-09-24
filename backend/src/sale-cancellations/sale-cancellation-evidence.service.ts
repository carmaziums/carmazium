import {
    BadRequestException,
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const SALE_CANCELLATION_EVIDENCE_BUCKET = 'sale-cancellation-evidence';
export const SALE_CANCELLATION_EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;
export const SALE_CANCELLATION_EVIDENCE_MAX_FILES = 5;

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
]);

export interface StoredCancellationEvidence {
    storagePath: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
}

@Injectable()
export class SaleCancellationEvidenceService {
    private readonly logger = new Logger(SaleCancellationEvidenceService.name);
    private readonly supabase: SupabaseClient | null;

    constructor() {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        this.supabase = url && serviceKey
            ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
            : null;

        if (!this.supabase) {
            this.logger.error('Private sale-cancellation evidence storage is not configured.');
        }
    }

    private storage(): SupabaseClient {
        if (!this.supabase) {
            throw new ServiceUnavailableException('Evidence storage is temporarily unavailable.');
        }
        return this.supabase;
    }

    private extensionForMime(mime: string): string {
        switch (mime) {
            case 'image/png': return 'png';
            case 'image/webp': return 'webp';
            case 'image/heic':
            case 'image/heif': return 'heic';
            case 'video/mp4': return 'mp4';
            case 'video/quicktime': return 'mov';
            case 'video/webm': return 'webm';
            case 'image/jpeg':
            default: return 'jpg';
        }
    }

    private hasExpectedSignature(buffer: Buffer, mime: string): boolean {
        if (mime === 'image/jpeg') {
            return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        }
        if (mime === 'image/png') {
            const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
            return buffer.length >= sig.length && sig.every((b, i) => buffer[i] === b);
        }
        if (mime === 'image/webp') {
            return buffer.length >= 12
                && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
                && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
        }
        if (mime === 'video/webm') {
            return buffer.length >= 4
                && buffer[0] === 0x1a && buffer[1] === 0x45
                && buffer[2] === 0xdf && buffer[3] === 0xa3;
        }
        if (['video/mp4', 'video/quicktime', 'image/heic', 'image/heif'].includes(mime)) {
            if (buffer.length < 12 || buffer.subarray(4, 8).toString('ascii') !== 'ftyp') return false;
            if (mime === 'image/heic' || mime === 'image/heif') {
                const brand = buffer.subarray(8, 24).toString('ascii').toLowerCase();
                return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].some((value) => brand.includes(value));
            }
            return true;
        }
        return false;
    }

    validateFile(file: any): void {
        if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
            throw new BadRequestException('Evidence file is missing.');
        }
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            throw new BadRequestException(
                'Evidence must be a JPEG, PNG, WebP, HEIC photo or an MP4, MOV or WebM video.',
            );
        }
        if (!Number.isInteger(file.size) || file.size < 1 || file.size > SALE_CANCELLATION_EVIDENCE_MAX_BYTES) {
            throw new BadRequestException('Each evidence file must be 25 MB or smaller.');
        }
        if (!this.hasExpectedSignature(file.buffer.subarray(0, 32), file.mimetype)) {
            throw new BadRequestException('One of the evidence files does not match its declared file type.');
        }
    }

    async storeFiles(
        requestId: string,
        userId: string,
        files: any[],
    ): Promise<StoredCancellationEvidence[]> {
        if (files.length > SALE_CANCELLATION_EVIDENCE_MAX_FILES) {
            throw new BadRequestException('Upload no more than 5 evidence files.');
        }

        files.forEach((file) => this.validateFile(file));
        const stored: StoredCancellationEvidence[] = [];

        try {
            for (const file of files) {
                const path = `${requestId}/${userId}/${randomUUID()}.${this.extensionForMime(file.mimetype)}`;
                const { error } = await this.storage()
                    .storage
                    .from(SALE_CANCELLATION_EVIDENCE_BUCKET)
                    .upload(path, file.buffer, {
                        contentType: file.mimetype,
                        cacheControl: 'no-store',
                        upsert: false,
                    });

                if (error) throw new Error(error.message);

                stored.push({
                    storagePath: path,
                    fileName: String(file.originalname || 'evidence').slice(0, 255),
                    mimeType: file.mimetype,
                    sizeBytes: file.size,
                });
            }
            return stored;
        } catch (error: any) {
            await this.deletePaths(stored.map((item) => item.storagePath));
            this.logger.error(`Sale cancellation evidence upload failed: ${error?.message || error}`);
            throw new ServiceUnavailableException('Could not store the evidence. Please try again.');
        }
    }

    async deletePaths(paths: string[]): Promise<void> {
        if (!paths.length) return;
        try {
            await this.storage().storage.from(SALE_CANCELLATION_EVIDENCE_BUCKET).remove(paths);
        } catch {
            // Best-effort cleanup; the database record remains the source of truth.
        }
    }

    async signPath(path: string): Promise<string | null> {
        try {
            const { data, error } = await this.storage()
                .storage
                .from(SALE_CANCELLATION_EVIDENCE_BUCKET)
                .createSignedUrl(path, 10 * 60);
            if (error || !data?.signedUrl) return null;
            return data.signedUrl;
        } catch {
            return null;
        }
    }

    async hydrateEvidence<T extends { storagePath: string }>(items: T[]) {
        return Promise.all(items.map(async (item) => ({
            ...item,
            url: await this.signPath(item.storagePath),
            storagePath: undefined,
        })));
    }
}
