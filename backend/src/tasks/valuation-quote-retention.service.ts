import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { QUOTE_HISTORY_MONTHS } from '../listings/valuation-quote-history';

/**
 * Fixed 12-month retention for individually issued vehicle quote receipts.
 * Price-lock records are separate; their 24-hour reuse/expiry is unchanged.
 * Never remove sale, buyer, listing, or unrelated analytics records here.
 */
@Injectable()
export class ValuationQuoteRetentionService {
    private readonly logger = new Logger(ValuationQuoteRetentionService.name);

    constructor(private readonly prisma: PrismaService) {}

    @Cron('15 3 * * *') // 03:15 UTC daily; safe on multiple API instances
    async runRetention(): Promise<void> {
        try {
            const count = await this.deleteExpiredQuoteReceipts();
            if (count > 0) this.logger.log(`Deleted ${count} expired quote receipts beyond ${QUOTE_HISTORY_MONTHS} months`);
        } catch (error) {
            this.logger.error(`Valuation quote retention cleanup failed: ${error}`);
        }
    }

    async deleteExpiredQuoteReceipts(now = new Date()): Promise<number> {
        const cutoff = new Date(now);
        cutoff.setUTCMonth(cutoff.getUTCMonth() - QUOTE_HISTORY_MONTHS);
        // Small bounded batches keep cron non-disruptive on production databases.
        const expired = await this.prisma.analyticsEvent.findMany({
            where: { type: 'valuation_quote_issued', createdAt: { lt: cutoff } },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
            take: 1000,
        });
        if (!expired.length) return 0;
        const result = await this.prisma.analyticsEvent.deleteMany({
            where: {
                type: 'valuation_quote_issued',
                createdAt: { lt: cutoff },
                id: { in: expired.map(row => row.id) },
            },
        });
        return result.count;
    }
}
