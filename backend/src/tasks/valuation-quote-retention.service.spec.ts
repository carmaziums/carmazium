import { ValuationQuoteRetentionService } from './valuation-quote-retention.service';

describe('12-month quote retention', () => {
    it('deletes only expired issued quote receipts in bounded batches', async () => {
        const prisma: any = {
            analyticsEvent: {
                findMany: jest.fn().mockResolvedValue([{ id: 'old-1' }, { id: 'old-2' }]),
                deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
        };
        const service = new ValuationQuoteRetentionService(prisma);
        const count = await service.deleteExpiredQuoteReceipts(new Date('2026-10-17T12:00:00.000Z'));
        expect(count).toBe(2);
        expect(prisma.analyticsEvent.findMany).toHaveBeenCalledWith({
            where: {
                type: 'valuation_quote_issued',
                createdAt: { lt: new Date('2025-10-17T12:00:00.000Z') },
            },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
            take: 1000,
        });
        expect(prisma.analyticsEvent.deleteMany).toHaveBeenCalledWith({
            where: {
                type: 'valuation_quote_issued',
                createdAt: { lt: new Date('2025-10-17T12:00:00.000Z') },
                id: { in: ['old-1', 'old-2'] },
            },
        });
    });

    it('leaves all data untouched when nothing has expired', async () => {
        const prisma: any = {
            analyticsEvent: {
                findMany: jest.fn().mockResolvedValue([]),
                deleteMany: jest.fn(),
            },
        };
        expect(await new ValuationQuoteRetentionService(prisma)
            .deleteExpiredQuoteReceipts(new Date('2026-10-17'))).toBe(0);
        expect(prisma.analyticsEvent.deleteMany).not.toHaveBeenCalled();
    });
});
