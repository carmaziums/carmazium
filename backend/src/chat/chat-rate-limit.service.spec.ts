import { HttpException } from '@nestjs/common';
import { ChatRateLimitService } from './chat-rate-limit.service';

describe('ChatRateLimitService', () => {
    it('allows the normal message allowance and rejects the next message', () => {
        const limiter = new ChatRateLimitService();

        for (let i = 0; i < 30; i += 1) {
            expect(() => limiter.consumeMessage('user-1')).not.toThrow();
        }

        expect(() => limiter.consumeMessage('user-1')).toThrow(HttpException);
        try {
            limiter.consumeMessage('user-1');
        } catch (error: any) {
            expect(error.getStatus()).toBe(429);
            expect(error.code).toBe('RATE_LIMITED');
        }
    });

    it('keeps message limits isolated between users', () => {
        const limiter = new ChatRateLimitService();
        for (let i = 0; i < 30; i += 1) limiter.consumeMessage('user-1');

        expect(() => limiter.consumeMessage('user-2')).not.toThrow();
    });
});
