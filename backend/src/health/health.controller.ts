import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, PrismaHealthIndicator } from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly prisma: PrismaHealthIndicator,
        private readonly prismaService: PrismaService,
    ) { }

    /**
     * Lightweight process liveness probe.
     *
     * This deliberately performs no outbound/self HTTP call and no database
     * work. It answers only whether the Nest process is alive and able to
     * serve HTTP, which is useful for diagnostics without creating a recursive
     * dependency on the public Fly route.
     */
    @Get('live')
    @ApiOperation({ summary: 'Check API process liveness' })
    live() {
        return {
            status: 'ok',
            service: 'carmazium-api',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Readiness probe used by Fly.
     *
     * The old /health implementation pinged the database and then made an HTTP
     * request back into this same API. Under a deploy or short connection
     * stall, that self-call could time out and mark the only Fly machine
     * unhealthy even while the process itself was fine. Readiness now checks
     * the one dependency every auction request actually needs: PostgreSQL.
     */
    @Get('ready')
    @HealthCheck()
    @ApiOperation({ summary: 'Check API readiness and database connectivity' })
    ready() {
        return this.health.check([
            () => this.prisma.pingCheck('database', this.prismaService),
        ]);
    }

    /**
     * Keep /health as a backwards-compatible readiness alias for monitors and
     * existing operational links.
     */
    @Get()
    @HealthCheck()
    @ApiOperation({ summary: 'Check system readiness' })
    check() {
        return this.ready();
    }
}
