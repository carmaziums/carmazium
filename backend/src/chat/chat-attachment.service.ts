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

type AllowedMime = typeof CHAT_ATTACHMENT_MIME_TYPES[number];

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

    private extensionForMime(mime: AllowedMime): string {
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

    validateMetadata(name: string, mime: string, size: number): AllowedMime {
        if (!name?.trim() || name.trim().length > 255) {
            throw new BadRequestException('Photo name is invalid.');
        }
        if (!CHAT_ATTACHMENT_MIME_TYPES.includes(mime as AllowedMime)) {
            throw new BadRequestException('Only JPEG, PNG and WebP photos can be sent.');
        }
        if (!Number.isInteger(size) || size < 1 || size > CHAT_ATTACHMENT_MAX_BYTES) {
            throw new BadRequestException('Photos must be 10 MB or smaller.');
        }
        return mime as AllowedMime;
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

    async assertUploaded(path: string): Promise<void> {
        const parts = path.split('/');
        const fileName = parts.pop();
        const folder = parts.join('/');
        if (!fileName || !folder) {
            throw new BadRequestException('Photo upload path is invalid.');
        }

        const { data, error } = await this.client()
            .storage
            .from(CHAT_ATTACHMENT_BUCKET)
            .list(folder, {
                limit: 5,
                search: fileName,
            });

        if (error) {
            this.logger.warn(`Could not verify chat attachment ${path}: ${error.message}`);
            throw new ServiceUnavailableException('Could not verify the uploaded photo.');
        }

        if (!data?.some((item) => item.name === fileName)) {
            throw new BadRequestException('Upload the photo before sending it.');
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
