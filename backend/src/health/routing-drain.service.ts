import { Injectable } from '@nestjs/common';

// Four 5-second Fly health-check intervals let routing converge while the
// HTTP listener and database remain available to requests already in flight.
export const ROUTING_DRAIN_MS = 20_000;

@Injectable()
export class RoutingDrainService {
    private draining = false;
    private activeRequests = 0;
    private onIdle?: () => void;

    get isDraining(): boolean { return this.draining; }

    trackRequest(): () => void {
        this.activeRequests++;
        let finished = false;
        return () => {
            if (finished) return;
            finished = true;
            this.activeRequests--;
            if (this.activeRequests === 0) this.onIdle?.();
        };
    }

    async begin(): Promise<void> {
        this.draining = true;
        await new Promise<void>(resolve => setTimeout(resolve, ROUTING_DRAIN_MS));
        // Keep Prisma alive until HTTP requests finish. Nest's app.close()
        // invokes database destruction hooks before closing its HTTP adapter.
        if (this.activeRequests > 0) {
            await new Promise<void>(resolve => {
                const finish = () => {
                    clearTimeout(timer);
                    this.onIdle = undefined;
                    resolve();
                };
                const timer = setTimeout(finish, 25_000);
                this.onIdle = finish;
            });
        }
    }
}
