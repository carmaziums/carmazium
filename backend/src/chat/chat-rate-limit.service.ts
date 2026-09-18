import {
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';

type WindowEntry = {
    startedAt: number;
    count: number;
};

@Injectable()
export class ChatRateLimitService implements OnModuleDestroy {
    private readonly logger = new Logger(ChatRateLimitService.name);
    private readonly windows = new Map<string, WindowEntry>();
    private operations = 0;
    private readonly redis: Redis | null;

    private static readonly REDIS_SCRIPT = `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
            redis.call('PEXPIRE', KEYS[1], ARGV[1])
        end
        return count
    `;

    constructor() {
        const redisUrl = process.env.REDIS_URL;
        this.redis = redisUrl
            ? new Redis(redisUrl, {
                maxRetriesPerRequest: 2,
                retryStrategy: (times) => (times <= 2 ? Math.min(times * 150, 750) : null),
            })
            : null;

        this.redis?.on('error', (error) => {
            this.logger.warn(`Chat rate-limit Redis error: ${error.message}`);
        });
    }

    async onModuleDestroy(): Promise<void> {
        if (!this.redis) return;
        try {
            await this.redis.quit();
        } catch {
            this.redis.disconnect();
        }
    }

    private rateLimitError(message: string) {
        const error: any = new HttpException(
            message,
            HttpStatus.TOO_MANY_REQUESTS,
        );
        error.code = 'RATE_LIMITED';
        return error;
    }

    private consumeLocal(
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
            throw this.rateLimitError(message);
        } else {
            current.count += 1;
        }

        this.operations += 1;
        if (this.operations % 500 === 0 && this.windows.size > 1000) {
            for (const [bucketKey, entry] of this.windows.entries()) {
                if (now - entry.startedAt > 60 * 60 * 1000) {
                    this.windows.delete(bucketKey);
                }
            }
        }
    }

    private async consume(
        key: string,
        limit: number,
        windowMs: number,
        message: string,
    ): Promise<void> {
        if (this.redis) {
            try {
                const namespacedKey = `carmazium:chat:rate:${key}`;
                const rawCount = await this.redis.eval(
                    ChatRateLimitService.REDIS_SCRIPT,
                    1,
                    namespacedKey,
                    String(windowMs),
                );
                const count = Number(rawCount);
                if (Number.isFinite(count) && count > limit) {
                    throw this.rateLimitError(message);
                }
                return;
            } catch (error) {
                if (error instanceof HttpException) throw error;

                // Keep chat available during a transient Redis outage. The
                // bounded in-process limiter is a conservative fallback; once
                // Redis recovers, limits are shared across all backend nodes.
                this.logger.warn(
                    `Falling back to local chat rate limit for ${key}: ${error?.message || error}`,
                );
            }
        }

        this.consumeLocal(key, limit, windowMs, message);
    }

    consumeMessage(userId: string): Promise<void> {
        return this.consume(
            `message:${userId}`,
            30,
            60_000,
            'You are sending messages too quickly. Please try again in a moment.',
        );
    }

    consumeRoomCreate(userId: string): Promise<void> {
        return this.consume(
            `room:${userId}`,
            10,
            10 * 60_000,
            'Too many new conversations were started. Please try again later.',
        );
    }

    consumeTyping(userId: string): Promise<void> {
        return this.consume(
            `typing:${userId}`,
            120,
            60_000,
            'Typing updates are being sent too quickly.',
        );
    }

    consumeAttachmentTicket(userId: string): Promise<void> {
        return this.consume(
            `attachment:${userId}`,
            10,
            60_000,
            'Too many attachment uploads were requested. Please try again shortly.',
        );
    }

    consumeReport(userId: string): Promise<void> {
        return this.consume(
            `report:${userId}`,
            10,
            60 * 60_000,
            'Too many chat reports were submitted. Please try again later.',
        );
    }

    consumeBlockChange(userId: string): Promise<void> {
        return this.consume(
            `block:${userId}`,
            20,
            60 * 60_000,
            'Too many chat block changes were made. Please try again later.',
        );
    }

    consumeAdminBroadcast(userId: string): Promise<void> {
        return this.consume(
            `broadcast:${userId}`,
            10,
            60 * 60_000,
            'Too many broadcasts were started. Please try again later.',
        );
    }
}
