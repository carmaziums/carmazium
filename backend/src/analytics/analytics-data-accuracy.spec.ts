import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { londonDayString, londonTrafficRange, shiftIsoDate } from './london-traffic-range';

describe('London traffic reporting boundaries', () => {
    it('includes exactly seven calendar dates', () => {
        expect(shiftIsoDate('2026-10-20', -6)).toBe('2026-10-14');
        const range = londonTrafficRange('2026-10-14', '2026-10-20');
        expect(range.from.toISOString()).toBe('2026-10-13T23:00:00.000Z');
        expect(range.untilExclusive.toISOString()).toBe('2026-10-20T23:00:00.000Z');
    });

    it('handles the 23-hour spring daylight-saving day', () => {
        const range = londonTrafficRange('2026-03-29', '2026-03-29');
        expect(range.from.toISOString()).toBe('2026-03-29T00:00:00.000Z');
        expect(range.untilExclusive.toISOString()).toBe('2026-03-29T23:00:00.000Z');
    });

    it('handles the 25-hour autumn daylight-saving day', () => {
        const range = londonTrafficRange('2026-10-25', '2026-10-25');
        expect(range.from.toISOString()).toBe('2026-10-24T23:00:00.000Z');
        expect(range.untilExclusive.toISOString()).toBe('2026-10-26T00:00:00.000Z');
    });

    it('uses London calendar dates rather than the host clock', () => {
        expect(londonDayString(new Date('2026-10-20T23:30:00Z'))).toBe('2026-10-21');
        expect(londonDayString(new Date('2026-01-20T23:30:00Z'))).toBe('2026-01-20');
    });

    it.each([
        ['2026-02-30', '2026-03-01'],
        ['2026-10-25', '2026-10-24'],
        ['2026-10-20T00:00', '2026-10-21'],
        ['2025-01-01', '2026-10-20'],
    ])('rejects invalid reporting window %s to %s', (from, to) => {
        expect(() => londonTrafficRange(from, to)).toThrow(BadRequestException);
    });
});

describe('Traffic reporting query integrity', () => {
    it('calculates pages per session using the page-view session count', async () => {
        const prisma: any = { $queryRawUnsafe: jest.fn()
            .mockResolvedValueOnce([{ pageviews: '8', sessions: '4', searches: '2' }])
            .mockResolvedValueOnce([{ pageviews: '1' }])
            .mockResolvedValue([]) };
        const service = new AnalyticsService(prisma);
        const range = londonTrafficRange('2026-10-14', '2026-10-20');
        const result = await service.getTrafficAnalytics(range.from, range.untilExclusive);
        expect(result.overview).toEqual({
            pageViews: 8,
            uniqueVisitors: 4,
            pagesPerVisit: 2,
            searches: 2,
            excludedInternalPageViews: 1,
        });
    });

    it('restricts session-based metrics to recorded public page views', async () => {
        const prisma: any = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
        const service = new AnalyticsService(prisma);
        const range = londonTrafficRange('2026-10-14', '2026-10-20');
        const result = await service.getTrafficAnalytics(range.from, range.untilExclusive);
        expect(result.overview).toEqual({
            pageViews: 0,
            uniqueVisitors: 0,
            pagesPerVisit: 0,
            searches: 0,
            excludedInternalPageViews: 0,
        });
        expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(11);
        const sql = prisma.$queryRawUnsafe.mock.calls.map(([query]: [string]) => query);
        expect(sql[0]).toContain("type = 'page_view' AND");
        expect(sql[0]).toContain("COALESCE(payload->>'url', '') LIKE '/%'");
        for (const query of sql) {
            expect(query).toContain('"createdAt" < $2');
            expect(query).not.toContain('"createdAt" <= $2');
        }
        expect(sql[2]).toContain("AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London'");
        expect(sql[3]).toContain("AND type = 'page_view'");
        expect(sql[4]).toContain("AND type = 'page_view'");
        expect(sql[6]).toContain("AND type = 'page_view'");
        expect(sql[9]).toContain("AND type = 'page_view'");
    });
});
