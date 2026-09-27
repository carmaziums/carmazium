import {
    BUY_IT_NOW_RESPONSE_WINDOW_MS,
    calculateBuyItNowResponseDeadline,
} from './auction-pricing';

describe('Buy It Now response deadline', () => {
    it('uses the auction end when the auction closes before request + 24 hours', () => {
        const pendingAt = new Date('2026-09-27T10:00:00.000Z');
        const auctionEnd = new Date('2026-09-27T18:00:00.000Z');

        expect(
            calculateBuyItNowResponseDeadline(pendingAt, auctionEnd).toISOString(),
        ).toBe(auctionEnd.toISOString());
    });

    it('caps the seller response window at 24 hours even if the auction end is later', () => {
        const pendingAt = new Date('2026-09-27T10:00:00.000Z');
        const auctionEnd = new Date('2026-09-29T10:00:00.000Z');

        expect(
            calculateBuyItNowResponseDeadline(pendingAt, auctionEnd).getTime(),
        ).toBe(pendingAt.getTime() + BUY_IT_NOW_RESPONSE_WINDOW_MS);
    });

    it('honours a later persisted auction end such as an anti-snipe extension without exceeding 24 hours', () => {
        const pendingAt = new Date('2026-09-27T17:55:00.000Z');
        const originalEnd = new Date('2026-09-27T18:00:00.000Z');
        const extendedEnd = new Date('2026-09-27T18:03:00.000Z');

        const beforeExtension = calculateBuyItNowResponseDeadline(pendingAt, originalEnd);
        const afterExtension = calculateBuyItNowResponseDeadline(pendingAt, extendedEnd);

        expect(beforeExtension.toISOString()).toBe(originalEnd.toISOString());
        expect(afterExtension.toISOString()).toBe(extendedEnd.toISOString());
        expect(afterExtension.getTime()).toBeLessThanOrEqual(
            pendingAt.getTime() + BUY_IT_NOW_RESPONSE_WINDOW_MS,
        );
    });
});
