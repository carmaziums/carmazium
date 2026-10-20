import { AnalyticsService } from './analytics.service';

describe('Live valuation dashboard reliability', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('shares concurrent work and reuses a successful snapshot for 30 seconds', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));

        const service = new AnalyticsService({} as any);
        let resolveQuery!: (value: any) => void;
        const pending = new Promise<any>(resolve => { resolveQuery = resolve; });
        const query = jest.spyOn(service as any, 'queryValuationAnalytics').mockReturnValue(pending);

        const first = service.getValuationAnalytics();
        const second = service.getValuationAnalytics();
        expect(query).toHaveBeenCalledTimes(1);

        const initial = { generatedAt: '2026-10-20T12:00:00Z', recent: [] };
        resolveQuery(initial);
        expect(await first).toBe(initial);
        expect(await second).toBe(initial);
        expect(await service.getValuationAnalytics()).toBe(initial);
        expect(query).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(30_001);
        const refreshed = { generatedAt: '2026-10-20T12:00:31Z', recent: [] };
        query.mockResolvedValueOnce(refreshed);
        expect(await service.getValuationAnalytics()).toBe(refreshed);
        expect(query).toHaveBeenCalledTimes(2);
    });

    it('does not cache rejected reads so a subsequent request can recover', async () => {
        const service = new AnalyticsService({} as any);
        const query = jest.spyOn(service as any, 'queryValuationAnalytics')
            .mockRejectedValueOnce(new Error('database temporarily unavailable'))
            .mockResolvedValueOnce({ generatedAt: 'after-recovery' });

        await expect(service.getValuationAnalytics()).rejects.toThrow('database temporarily unavailable');
        await expect(service.getValuationAnalytics()).resolves.toEqual({ generatedAt: 'after-recovery' });
        expect(query).toHaveBeenCalledTimes(2);
    });

    it('limits valuation attribution journeys before expensive lateral joins', async () => {
        const prisma: any = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
        const service = new AnalyticsService(prisma);

        const response = await service.getValuationAnalytics();
        expect(response.recent).toEqual([]);
        const sql = prisma.$queryRawUnsafe.mock.calls[4]?.[0] as string;
        expect(sql).toMatch(/recent_valuations AS \([\s\S]*ORDER BY "createdAt" DESC\s+LIMIT 100\s+\)\s+SELECT\s+v\.id/);
        expect(sql).toContain('LEFT JOIN LATERAL');
    });
});
