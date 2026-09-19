import { BadRequestException } from '@nestjs/common';
import {
    boundedServiceLimit,
    decodeServiceCursor,
    encodeServiceCursor,
    makeServicePage,
} from './service-pagination';

describe('TradeXchange cursor pagination', () => {
    it('round-trips an opaque cursor including recovery priority', () => {
        const encoded = encodeServiceCursor({
            at: '2026-09-19T12:00:00.000Z',
            id: 'job-123',
            priority: true,
        });
        expect(decodeServiceCursor(encoded)).toEqual({
            at: '2026-09-19T12:00:00.000Z',
            id: 'job-123',
            priority: true,
        });
    });

    it('rejects malformed cursors instead of silently restarting at page one', () => {
        expect(() => decodeServiceCursor('not-a-valid-cursor')).toThrow(BadRequestException);
    });

    it('bounds requested page size to 1..50', () => {
        expect(boundedServiceLimit(undefined)).toBe(20);
        expect(boundedServiceLimit(0)).toBe(1);
        expect(boundedServiceLimit(1000)).toBe(50);
        expect(boundedServiceLimit(17)).toBe(17);
    });

    it('returns a next cursor only when an extra row proves another page exists', () => {
        const rows = [
            { id: '3', createdAt: new Date('2026-09-19T12:00:00Z') },
            { id: '2', createdAt: new Date('2026-09-19T11:00:00Z') },
            { id: '1', createdAt: new Date('2026-09-19T10:00:00Z') },
        ];
        const page = makeServicePage(rows, 2, row => ({
            at: row.createdAt.toISOString(),
            id: row.id,
        }));
        expect(page.items.map(row => row.id)).toEqual(['3', '2']);
        expect(page.nextCursor).toEqual(expect.any(String));
    });
});
