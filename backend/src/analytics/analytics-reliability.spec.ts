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

    it('shares concurrent traffic reads and caches only the exact reporting period', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));
        const service = new AnalyticsService({} as any);
        let finish!: (value: any) => void;
        const pending = new Promise<any>(resolve => { finish = resolve; });
        const query = jest.spyOn(service as any, 'queryTrafficAnalytics')
            .mockReturnValueOnce(pending)
            .mockResolvedValue({ overview: { pageViews: 9 } });

        const from = new Date('2026-10-01T00:00:00Z');
        const until = new Date('2026-10-02T00:00:00Z');
        const first = service.getTrafficAnalytics(from, until);
        const shared = service.getTrafficAnalytics(from, until);
        expect(query).toHaveBeenCalledTimes(1);

        const otherPeriod = await service.getTrafficAnalytics(
            new Date('2026-10-02T00:00:00Z'), new Date('2026-10-03T00:00:00Z'),
        );
        expect(otherPeriod.overview.pageViews).toBe(9);
        expect(query).toHaveBeenCalledTimes(2);

        const original = { overview: { pageViews: 5 } };
        finish(original);
        expect(await first).toBe(original);
        expect(await shared).toBe(original);
        expect(await service.getTrafficAnalytics(from, until)).toBe(original);
        expect(query).toHaveBeenCalledTimes(2);

        jest.advanceTimersByTime(20_001);
        expect((await service.getTrafficAnalytics(from, until)).overview.pageViews).toBe(9);
        expect(query).toHaveBeenCalledTimes(3);
    });

    it('never stores traffic query failures as successful snapshots', async () => {
        const service = new AnalyticsService({} as any);
        const query = jest.spyOn(service as any, 'queryTrafficAnalytics')
            .mockRejectedValueOnce(new Error('traffic database timeout'))
            .mockResolvedValueOnce({ overview: { pageViews: 2 } });
        const from = new Date('2026-10-01T00:00:00Z');
        const until = new Date('2026-10-02T00:00:00Z');
        await expect(service.getTrafficAnalytics(from, until))
            .rejects.toThrow('traffic database timeout');
        await expect(service.getTrafficAnalytics(from, until))
            .resolves.toMatchObject({ overview: { pageViews: 2 } });
        expect(query).toHaveBeenCalledTimes(2);
    });

    it('bounds cached traffic periods to avoid memory growth on custom date exploration', async () => {
        const service = new AnalyticsService({} as any);
        const query = jest.spyOn(service as any, 'queryTrafficAnalytics')
            .mockResolvedValue({ overview: { pageViews: 1 } });
        for (let i = 1; i <= 10; i++) {
            const from = new Date(Date.UTC(2026, 9, i));
            const until = new Date(Date.UTC(2026, 9, i + 1));
            await service.getTrafficAnalytics(from, until);
        }
        expect((service as any).trafficSnapshots.size).toBe(8);
        await service.getTrafficAnalytics(
            new Date('2026-10-01T00:00:00Z'), new Date('2026-10-02T00:00:00Z'),
        );
        expect(query).toHaveBeenCalledTimes(11);
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
