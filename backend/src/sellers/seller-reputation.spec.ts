import { computeReliabilityScore, computeResponseStats, RESPONSE_GRACE_MS } from './seller-reputation';

const now = Date.UTC(2026, 10, 4, 12);
const at = (msAgo: number) => new Date(now - msAgo);
const H = 3_600_000;

describe('computeResponseStats', () => {
    it('is null when the seller has had nothing to answer', () => {
        expect(computeResponseStats([], now)).toEqual({ responseRate: null, avgResponseHours: null, offersConsidered: 0 });
    });

    it('counts answered offers against answered + overdue ones', () => {
        const stats = computeResponseStats([
            { status: 'ACCEPTED', createdAt: at(10 * H), updatedAt: at(8 * H) },
            { status: 'REJECTED', createdAt: at(10 * H), updatedAt: at(6 * H) },
            { status: 'COUNTERED', createdAt: at(10 * H), updatedAt: at(10 * H) },
            { status: 'PENDING', createdAt: at(RESPONSE_GRACE_MS + H), updatedAt: at(RESPONSE_GRACE_MS + H) },
        ], now);
        expect(stats.responseRate).toBe(75);
        expect(stats.avgResponseHours).toBe(2);
        expect(stats.offersConsidered).toBe(4);
    });

    it('ignores fresh pending, withdrawn and cancelled offers', () => {
        const stats = computeResponseStats([
            { status: 'ACCEPTED', createdAt: at(5 * H), updatedAt: at(4 * H) },
            { status: 'PENDING', createdAt: at(H), updatedAt: at(H) },
            { status: 'WITHDRAWN', createdAt: at(100 * H), updatedAt: at(99 * H) },
            { status: 'CANCELLED', createdAt: at(100 * H), updatedAt: at(99 * H) },
        ], now);
        expect(stats.responseRate).toBe(100);
        expect(stats.offersConsidered).toBe(1);
    });
});

describe('computeReliabilityScore', () => {
    it('keeps the documented weights', () => {
        expect(computeReliabilityScore({ ratings: [5, 5], responseRate: 100, totalSales: 10, totalListings: 10 })).toBe(5);
        expect(computeReliabilityScore({ ratings: [4], responseRate: 50, totalSales: 1, totalListings: 4 })).toBe(3);
        expect(computeReliabilityScore({ ratings: [], responseRate: null, totalSales: 0, totalListings: 0 })).toBe(0);
    });
});
