import { readFileSync } from 'fs';
import { join } from 'path';
import { HealthController } from './health.controller';

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
