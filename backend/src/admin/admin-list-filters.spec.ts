import { dealerArchiveWhere, ledgerWhere } from './admin-list-filters';

describe('Admin archive filters', () => {
    it('uses an inclusive UTC end date and validates impossible or reversed dates', () => {
        expect(ledgerWhere({ from: '2026-11-01', to: '2026-11-07', status: 'COMPLETED' })).toMatchObject({ status: 'COMPLETED', createdAt: { gte: new Date('2026-11-01Z'), lt: new Date('2026-11-08Z') } });
        for (const filters of [{ from: '2026-02-30' }, { from: '2026-11-08', to: '2026-11-07' }, { status: 'UNKNOWN' }, { type: 'UNKNOWN' }]) expect(() => ledgerWhere(filters)).toThrow();
    });
    it('searches payment references, users and normalized registrations with the same status filter', () => {
        const where = ledgerWhere({ q: 'DK66 UVU', type: 'COMMISSION', status: 'PENDING' });
        expect(where).toMatchObject({ status: 'PENDING', type: 'COMMISSION' });
        expect(where.OR).toEqual(expect.arrayContaining([{ stripePaymentId: { contains: 'DK66 UVU', mode: 'insensitive' } }]));
        expect(JSON.stringify(where)).toContain('DK66UVU');
    });
    it('distinguishes unpaid drafts from reviewable pending applications', () => {
        expect(dealerArchiveWhere({ status: 'DRAFT' }).AND).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'PENDING', NOT: expect.any(Object) })]));
        expect(dealerArchiveWhere({ status: 'READY' }).AND).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'PENDING', OR: expect.any(Array) })]));
        expect(() => dealerArchiveWhere({ status: 'INVALID' })).toThrow();
    });
});
