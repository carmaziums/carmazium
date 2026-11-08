import { readFileSync } from 'fs';
import { join } from 'path';
import { HealthController } from './health.controller';
import { RoutingDrainService, ROUTING_DRAIN_MS } from './routing-drain.service';

describe('HealthController reliability probes', () => {
    const prismaService = {} as any;
    const prisma = {
        pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    };
    const health = {
        check: jest.fn(async (checks: Array<() => Promise<any>>) => {
            const results = await Promise.all(checks.map((check) => check()));
            return { status: 'ok', details: results };
        }),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('keeps liveness dependency-free', () => {
        const controller = new HealthController(
            health as any,
            prisma as any,
            prismaService,
            new RoutingDrainService(),
        );

        const result = controller.live();

        expect(result.status).toBe('ok');
        expect(result.service).toBe('carmazium-api');
        expect(prisma.pingCheck).not.toHaveBeenCalled();
        expect(health.check).not.toHaveBeenCalled();
    });

    it('checks only PostgreSQL readiness and does not self-ping the public API', async () => {
        const controller = new HealthController(
            health as any,
            prisma as any,
            prismaService,
            new RoutingDrainService(),
        );

        await controller.ready();

        expect(health.check).toHaveBeenCalledTimes(1);
        expect(prisma.pingCheck).toHaveBeenCalledTimes(1);
        expect(prisma.pingCheck).toHaveBeenCalledWith('database', prismaService);
    });

    it('/health remains a backwards-compatible readiness alias', async () => {
        const controller = new HealthController(
            health as any,
            prisma as any,
            prismaService,
            new RoutingDrainService(),
        );

        await controller.check();

        expect(health.check).toHaveBeenCalledTimes(1);
        expect(prisma.pingCheck).toHaveBeenCalledTimes(1);
    });

    it('keeps Fly routing health independent from PostgreSQL readiness', () => {
        const flyConfig = readFileSync(join(process.cwd(), 'fly.toml'), 'utf8');

        expect(flyConfig).toMatch(/auto_stop_machines\s*=\s*['"]stop['"]/);
        expect(flyConfig).toMatch(/auto_start_machines\s*=\s*true/);
        expect(flyConfig).toMatch(/min_machines_running\s*=\s*1/);
        expect(flyConfig).toMatch(/path\s*=\s*['"]\/health\/live['"]/);
        expect(flyConfig).not.toMatch(/path\s*=\s*['"]\/health\/ready['"]/);
    });
});


describe('routing drain before HTTP shutdown', () => {
    afterEach(() => jest.useRealTimers());
    it('withdraws routing immediately but waits for load-balancer convergence', async () => {
        jest.useFakeTimers();
        const drain = new RoutingDrainService();
        const health = new HealthController({} as any, {} as any, {} as any, drain);
        expect(health.live().status).toBe('ok');
        let readyToClose = false;
        const pending = drain.begin().then(() => { readyToClose = true; });
        expect(() => health.live()).toThrow('API is draining for shutdown');
        await jest.advanceTimersByTimeAsync(ROUTING_DRAIN_MS - 1);
        expect(readyToClose).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        await pending;
        expect(readyToClose).toBe(true);
    });
});

describe('in-flight request protection', () => {
    afterEach(() => jest.useRealTimers());
    it('keeps dependencies alive until an active request finishes and counts close only once', async () => {
        jest.useFakeTimers();
        const drain = new RoutingDrainService();
        const finish = drain.trackRequest();
        let closed = false;
        const pending = drain.begin().then(() => { closed = true; });
        await jest.advanceTimersByTimeAsync(ROUTING_DRAIN_MS);
        expect(closed).toBe(false);
        finish();
        finish();
        await pending;
        expect(closed).toBe(true);
    });
    it('bounds a hung request inside the Fly shutdown budget', async () => {
        jest.useFakeTimers();
        const drain = new RoutingDrainService();
        drain.trackRequest();
        let closed = false;
        const pending = drain.begin().then(() => { closed = true; });
        await jest.advanceTimersByTimeAsync(ROUTING_DRAIN_MS + 24_999);
        expect(closed).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        await pending;
        expect(closed).toBe(true);
    });
});
