import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type WindowEntry = {
    startedAt: number;
    count: number;
};

@Injectable()
export class ChatRateLimitService {
    private readonly windows = new Map<string, WindowEntry>();
    private operations = 0;

    private consume(
        key: string,
        limit: number,
        windowMs: number,
        message: string,
    ): void {
        const now = Date.now();
        const current = this.windows.get(key);

        if (!current || now - current.startedAt >= windowMs) {
            this.windows.set(key, { startedAt: now, count: 1 });
        } else if (current.count >= limit) {
            const error: any = new HttpException(
                message,
                HttpStatus.TOO_MANY_REQUESTS,
            );
            error.code = 'RATE_LIMITED';
            throw error;
        } else {
            current.count += 1;
        }

        // Keep this process-local limiter bounded. It deliberately avoids
        // becoming a second persistence layer; production currently runs chat
        // through the single Fly backend process, and DB/business authorization
        // remains authoritative.
        this.operations += 1;
        if (this.operations % 500 === 0 && this.windows.size > 1000) {
            for (const [bucketKey, entry] of this.windows.entries()) {
                if (now - entry.startedAt > 60 * 60 * 1000) {
                    this.windows.delete(bucketKey);
                }
            }
        }
    }

    consumeMessage(userId: string): void {
        this.consume(
            `message:${userId}`,
            30,
            60_000,
            'You are sending messages too quickly. Please try again in a moment.',
        );
    }

    consumeRoomCreate(userId: string): void {
        this.consume(
            `room:${userId}`,
            10,
            10 * 60_000,
            'Too many new conversations were started. Please try again later.',
        );
    }

    consumeTyping(userId: string): void {
        this.consume(
            `typing:${userId}`,
            120,
            60_000,
            'Typing updates are being sent too quickly.',
        );
    }

    consumeAttachmentTicket(userId: string): void {
        this.consume(
            `attachment:${userId}`,
            10,
            60_000,
            'Too many attachment uploads were requested. Please try again shortly.',
        );
    }

    consumeReport(userId: string): void {
        this.consume(
            `report:${userId}`,
            10,
            60 * 60_000,
            'Too many chat reports were submitted. Please try again later.',
        );
    }

    consumeBlockChange(userId: string): void {
        this.consume(
            `block:${userId}`,
            20,
            60 * 60_000,
            'Too many chat block changes were made. Please try again later.',
        );
    }

    consumeAdminBroadcast(userId: string): void {
        this.consume(
            `broadcast:${userId}`,
            10,
            60 * 60_000,
            'Too many broadcasts were started. Please try again later.',
        );
    }
}
