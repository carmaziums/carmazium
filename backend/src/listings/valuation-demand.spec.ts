import { assessFirstPartyMarketDemand } from './valuation-demand';

describe('observed first-party demand', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    it('does not invent demand from empty or sparse inventory', () => {
        expect(assessFirstPartyMarketDemand([], now)).toEqual({
            status: 'INSUFFICIENT_DATA',
            activeComparableSupply: 0,
            observedTransactions90d: 0,
            retailAdjustment: 1,
            tradeAdjustment: 1,
        });
        const sparse = [
            { status: 'ACTIVE' },
            { status: 'SOLD', sale: { createdAt: '2026-10-17T12:00:00Z' } },
        ];
        expect(assessFirstPartyMarketDemand(sparse, now).status).toBe('INSUFFICIENT_DATA');
    });

    it('does not count old or merely marked-sold stock as a recent transaction', () => {
        const rows: Array<{ status: string; sale?: { createdAt: string } }> = Array.from({ length: 10 }, () => ({ status: 'ACTIVE' }));
        rows.push(...Array.from({ length: 10 }, () => ({
            status: 'SOLD',
            sale: { createdAt: '2025-10-17T12:00:00Z' },
        })));
        expect(assessFirstPartyMarketDemand(rows, now).observedTransactions90d).toBe(0);
    });

    it('uses an observed recent sell-through signal only with sufficient samples', () => {
        const active = Array.from({ length: 5 }, () => ({ status: 'ACTIVE' }));
        const sold = Array.from({ length: 12 }, () => ({
            status: 'SOLD', sale: { createdAt: '2026-10-17T12:00:00Z' },
        }));
        const demand = assessFirstPartyMarketDemand([...active, ...sold], now);
        expect(demand.status).toBe('HIGH_DEMAND');
        expect(demand.retailAdjustment).toBe(1.02);
        expect(demand.tradeAdjustment).toBe(1.01);
    });
});
