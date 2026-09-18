import {
    BadRequestException,
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const CHAT_ATTACHMENT_BUCKET = 'chat-attachments';
export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_ATTACHMENT_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
] as const;

export type AllowedChatAttachmentMime = typeof CHAT_ATTACHMENT_MIME_TYPES[number];

export function hasExpectedImageSignature(
    bytes: Uint8Array,
    mime: AllowedChatAttachmentMime,
): boolean {
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
export class ChatAttachmentService {
    private readonly logger = new Logger(ChatAttachmentService.name);
    private readonly supabase: SupabaseClient | null;

    constructor() {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_KEY;

        if (!url || !serviceKey) {
            this.logger.error(
                'Private chat attachments require SUPABASE_URL and SUPABASE_SERVICE_KEY.',
            );
            this.supabase = null;
            return;
        }

        this.supabase = createClient(url, serviceKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
    }

    private client(): SupabaseClient {
        if (!this.supabase) {
            throw new ServiceUnavailableException(
                'Private chat attachments are not configured right now.',
            );
        }
        return this.supabase;
    }

    private extensionForMime(mime: AllowedChatAttachmentMime): string {
        switch (mime) {
            case 'image/png':
                return 'png';
            case 'image/webp':
                return 'webp';
            case 'image/jpeg':
            default:
                return 'jpg';
        }
    }

    validateMetadata(name: string, mime: string, size: number): AllowedChatAttachmentMime {
        if (!name?.trim() || name.trim().length > 255) {
            throw new BadRequestException('Photo name is invalid.');
        }
        if (!CHAT_ATTACHMENT_MIME_TYPES.includes(mime as AllowedChatAttachmentMime)) {
            throw new BadRequestException('Only JPEG, PNG and WebP photos can be sent.');
        }
        if (!Number.isInteger(size) || size < 1 || size > CHAT_ATTACHMENT_MAX_BYTES) {
            throw new BadRequestException('Photos must be 10 MB or smaller.');
        }
        return mime as AllowedChatAttachmentMime;
    }

    async createUploadTicket(
        roomId: string,
        userId: string,
        name: string,
        mime: string,
        size: number,
    ) {
        const allowedMime = this.validateMetadata(name, mime, size);
        const extension = this.extensionForMime(allowedMime);
        const path = `${roomId}/${userId}/${randomUUID()}.${extension}`;

        const { data, error } = await this.client()
            .storage
            .from(CHAT_ATTACHMENT_BUCKET)
            .createSignedUploadUrl(path);

        if (error || !data?.token) {
            this.logger.error(
                `Could not create chat upload ticket for ${userId}: ${error?.message || 'missing token'}`,
            );
            throw new ServiceUnavailableException('Could not prepare the photo upload.');
        }

        return {
            bucket: CHAT_ATTACHMENT_BUCKET,
            path,
            token: data.token,
            expiresInSeconds: 2 * 60 * 60,
        };
    }

    assertPathOwnership(path: string, roomId: string, userId: string): void {
        const expectedPrefix = `${roomId}/${userId}/`;
        if (!path || !path.startsWith(expectedPrefix) || path.includes('..')) {
            throw new BadRequestException('Photo upload path is invalid for this conversation.');
        }
    }

    private async removeInvalidUpload(path: string): Promise<void> {
        try {
            await this.client()
                .storage
                .from(CHAT_ATTACHMENT_BUCKET)
                .remove([path]);
        } catch {
            // Best-effort cleanup only. Validation failure remains authoritative.
        }
    }

    async assertUploaded(
        path: string,
        expectedMime: string,
        expectedSize: number,
    ): Promise<void> {
        const allowedMime = this.validateMetadata('attachment', expectedMime, expectedSize);
        const parts = path.split('/');
        const fileName = parts.pop();
        const folder = parts.join('/');
        if (!fileName || !folder) {
            throw new BadRequestException('Photo upload path is invalid.');
        }

        const bucket = this.client().storage.from(CHAT_ATTACHMENT_BUCKET);
        const { data, error } = await bucket.list(folder, {
            limit: 5,
            search: fileName,
        });

        if (error) {
            this.logger.warn(`Could not verify chat attachment ${path}: ${error.message}`);
            throw new ServiceUnavailableException('Could not verify the uploaded photo.');
        }

        const stored = data?.find((item) => item.name === fileName);
        if (!stored) {
            throw new BadRequestException('Upload the photo before sending it.');
        }

        const metadata = (stored.metadata || {}) as Record<string, unknown>;
        const storedSize = Number(metadata.size || 0);
        const storedMime = String(
            metadata.mimetype ||
            metadata.mimeType ||
            metadata.contentType ||
            '',
        ).toLowerCase();

        if (
            (storedSize > 0 && storedSize !== expectedSize) ||
            storedSize > CHAT_ATTACHMENT_MAX_BYTES ||
            (storedMime && storedMime !== allowedMime)
        ) {
            await this.removeInvalidUpload(path);
            throw new BadRequestException('Uploaded photo metadata does not match the message.');
        }

        const { data: file, error: downloadError } = await bucket.download(path);
        if (downloadError || !file) {
            this.logger.warn(
                `Could not inspect chat attachment ${path}: ${downloadError?.message || 'missing file'}`,
            );
            throw new ServiceUnavailableException('Could not verify the uploaded photo.');
        }

        if (file.size !== expectedSize || file.size > CHAT_ATTACHMENT_MAX_BYTES) {
            await this.removeInvalidUpload(path);
            throw new BadRequestException('Uploaded photo size does not match the message.');
        }

        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!hasExpectedImageSignature(bytes.subarray(0, 16), allowedMime)) {
            await this.removeInvalidUpload(path);
            throw new BadRequestException('Uploaded file is not a valid JPEG, PNG or WebP photo.');
        }
    }

    async signPath(path: string): Promise<string> {
        const { data, error } = await this.client()
            .storage
            .from(CHAT_ATTACHMENT_BUCKET)
            .createSignedUrl(path, 60 * 60);

        if (error || !data?.signedUrl) {
            this.logger.warn(`Could not sign chat attachment ${path}: ${error?.message || 'missing URL'}`);
            throw new ServiceUnavailableException('Could not open the private photo.');
        }

        return data.signedUrl;
    }

    async hydrateMessage<T extends { attachmentPath?: string | null }>(message: T): Promise<T & { attachmentUrl?: string | null }> {
        if (!message.attachmentPath) {
            return { ...message, attachmentUrl: null };
        }

        try {
            const attachmentUrl = await this.signPath(message.attachmentPath);
            return { ...message, attachmentUrl };
        } catch {
            // Transcript text should remain readable even if Storage is
            // temporarily unavailable. The client can show the photo as
            // unavailable instead of failing the whole conversation.
            return { ...message, attachmentUrl: null };
        }
    }

    async hydrateMessages<T extends { attachmentPath?: string | null }>(messages: T[]) {
        return Promise.all(messages.map((message) => this.hydrateMessage(message)));
    }
}
