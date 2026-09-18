import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AdminMessagingService } from './admin-messaging.service';

@Injectable()
export class AdminBroadcastSchedulerService {
    private readonly logger = new Logger(AdminBroadcastSchedulerService.name);
    private running = false;

    constructor(private readonly messaging: AdminMessagingService) {}

    @Interval(30_000)
    async dispatchDueBroadcasts() {
        // Prevent overlapping ticks inside one process. Cross-process
        // concurrency is handled by the atomic SCHEDULED -> SENDING claim.
        if (this.running) return;
        this.running = true;

        try {
            const recovery = await this.messaging.recoverStaleSendingBroadcasts(5);
            if (recovery.recovered > 0) {
                this.logger.warn(
                    `Recovered ${recovery.recovered}/${recovery.found} stale sending broadcast(s)`,
                );
            }

            const result = await this.messaging.processDueScheduledBroadcasts(5);
            if (result.claimed > 0) {
                this.logger.log(
                    `Claimed ${result.claimed}/${result.due} due scheduled broadcast(s)`,
                );
            }
        } catch (error: any) {
            this.logger.error(
                `Scheduled broadcast worker failed: ${error?.message || error}`,
            );
        } finally {
            this.running = false;
        }
    }
}
