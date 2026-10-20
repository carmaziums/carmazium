import { ValuationHistoryService } from './valuation-history.service';

describe('Twelve-month quotation archive', () => {
    it('includes genuinely unmatched historic server price locks and protects the canonical receipts', async () => {
        const prisma: any = {
            $queryRawUnsafe: jest.fn()
                .mockResolvedValueOnce([{
                    id: 'legacy-lock-1',
                    createdAt: new Date('2026-10-15T12:00:00Z'),
                    registration: null,
                    make: 'Test',
                    model: 'Car',
                    year: 2020,
                    mileage: 25000,
                    auction: 3400,
                    retail: 4080,
                    source: 'legacy_market',
                    type: 'valuation_price_lock',
                }])
                .mockResolvedValueOnce([]),
        };
        const result = await new ValuationHistoryService(prisma).getHistory();
        expect(result.months).toBe(12);
        expect(result.rows).toMatchObject([{
            id: 'legacy-lock-1',
            auctionPrice: 3400,
            retailPrice: 4080,
            origin: 'valuation_price_lock',
        }]);
        const sql = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
        expect(sql).toContain("e.type IN ('valuation_quote_issued','valuation_requested','valuation_price_lock')");
        expect(sql).toContain("a.type = 'valuation_price_lock'");
        expect(sql).toContain("s.type='valuation_quote_issued'");
        expect(sql).toContain("s.type='valuation_requested' AND s.auction > 0 AND s.retail > 0");
        expect(sql).toContain("interval '25 hours'");
        expect(sql).toContain("interval '15 minutes'");
        expect(sql).toContain('AND e."createdAt" >= $1');
        expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it('keeps search terms as SQL parameters and caps pagination without truncating valid quotes', async () => {
        const prisma: any = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
        const userSearch = "Mercedes%' OR true --";
        const result = await new ValuationHistoryService(prisma).getHistory(userSearch, 1000);
        expect(result.page).toBe(100);
        const [sql, cutoff, pattern, offset] = prisma.$queryRawUnsafe.mock.calls[0];
        expect(sql).not.toContain(userSearch);
        expect(sql).toContain("CONCAT_WS(' ',a.registration,a.make,a.model,a.year::text) ILIKE $2");
        expect(cutoff).toBeInstanceOf(Date);
        expect(pattern).toBe('%' + userSearch + '%');
        expect(offset).toBe(9900);
        expect(result.rows).toEqual([]);
    });
});
