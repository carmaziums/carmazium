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
     * Lightweight process liveness probe used by Fly for routing health.
     *
     * This deliberately performs no outbound/self HTTP call and no database
     * work. A transient PostgreSQL/session-store slowdown must not make Fly
     * remove CarMazium's only API machine from routing and turn a dependency
     * issue into an upstream ECONNRESET/ETIMEDOUT outage.
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
     * Dependency readiness probe retained for explicit operational monitoring.
     *
     * This checks PostgreSQL without making a recursive HTTP call back through
     * the public Fly route. It is intentionally separate from Fly's routing
     * health check so a short database stall remains observable without taking
     * the live API process out of service.
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
