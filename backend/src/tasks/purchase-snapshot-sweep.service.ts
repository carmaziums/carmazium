import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { purchaseSnapshotsEnabled, sweepMissingPurchaseSnapshots } from '../dealers/purchase-listing-record';

/**
 * Backstop for purchase-time snapshots: the post-commit capture retries
 * in-process, and this catches anything lost to a crash or deploy. Does
 * nothing while PURCHASE_SNAPSHOTS_ENABLED is off. Idempotent, so it is safe
 * on several API instances.
 */
@Injectable()
export class PurchaseSnapshotSweepService {
    private readonly logger = new Logger(PurchaseSnapshotSweepService.name);

    constructor(private readonly prisma: PrismaService) {}

    @Cron('*/10 * * * *')
    async run(): Promise<void> {
        if (!purchaseSnapshotsEnabled()) return;
        try {
            const captured = await sweepMissingPurchaseSnapshots(this.prisma);
            if (captured > 0) this.logger.log(`Saved ${captured} missing purchase snapshot(s)`);
        } catch (error) {
            this.logger.error(`Purchase snapshot sweep failed: ${(error as Error)?.message ?? error}`);
        }
    }
}
