import { HttpException } from '@nestjs/common';
import { ChatRateLimitService } from './chat-rate-limit.service';

describe('ChatRateLimitService', () => {
    const originalRedisUrl = process.env.REDIS_URL;

    beforeEach(() => {
        delete process.env.REDIS_URL;
    });

    afterAll(() => {
        if (originalRedisUrl) process.env.REDIS_URL = originalRedisUrl;
        else delete process.env.REDIS_URL;
    });

    it('allows the normal message allowance and rejects the next message', async () => {
        const limiter = new ChatRateLimitService();

        for (let i = 0; i < 30; i += 1) {
            await expect(limiter.consumeMessage('user-1')).resolves.toBeUndefined();
        }

        await expect(limiter.consumeMessage('user-1')).rejects.toBeInstanceOf(HttpException);
        try {
            await limiter.consumeMessage('user-1');
        } catch (error: any) {
            expect(error.getStatus()).toBe(429);
            expect(error.code).toBe('RATE_LIMITED');
        }
    });

    it('rate-limits anonymous AI reports by source key', async () => {
        const limiter = new ChatRateLimitService();

        for (let i = 0; i < 10; i += 1) {
            await expect(limiter.consumeAiReport('203.0.113.10')).resolves.toBeUndefined();
        }

        await expect(limiter.consumeAiReport('203.0.113.10')).rejects.toBeInstanceOf(HttpException);
        await expect(limiter.consumeAiReport('203.0.113.11')).resolves.toBeUndefined();
    });

    it('keeps message limits isolated between users', async () => {
        const limiter = new ChatRateLimitService();
        for (let i = 0; i < 30; i += 1) {
            await limiter.consumeMessage('user-1');
        }

        await expect(limiter.consumeMessage('user-2')).resolves.toBeUndefined();
    });

    it('uses a shared Redis counter when Redis is available', async () => {
        const limiter = new ChatRateLimitService();
        const evalMock = jest.fn()
            .mockResolvedValueOnce(30)
            .mockResolvedValueOnce(31);
        (limiter as any).redis = { eval: evalMock };

        await expect(limiter.consumeMessage('shared-user')).resolves.toBeUndefined();
        await expect(limiter.consumeMessage('shared-user')).rejects.toBeInstanceOf(HttpException);

        expect(evalMock).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining("redis.call('INCR'"),
            1,
            'carmazium:chat:rate:message:shared-user',
            '60000',
        );
    });
});
