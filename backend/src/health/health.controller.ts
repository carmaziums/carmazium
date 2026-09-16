import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, PrismaHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private prisma: PrismaHealthIndicator,
        private prismaService: PrismaService,
    ) { }

    /**
     * Lightweight process liveness probe for Fly. If Nest can serve this
     * response the process is alive; do not make liveness depend on the
     * database or on a self-HTTP request that can amplify transient failures.
     */
    @Get()
    @ApiOperation({ summary: 'Lightweight API liveness check' })
    check() {
        return { status: 'ok' };
    }

    /**
     * Readiness includes the dependency the API needs for normal operation.
     * This endpoint is available to operators without making Fly's liveness
     * check restart/withdraw the only machine during a brief database blip.
     */
    @Get('ready')
    @HealthCheck()
    @ApiOperation({ summary: 'API readiness check including database connectivity' })
    ready() {
        return this.health.check([
            () => this.prisma.pingCheck('database', this.prismaService),
        ]);
    }
}
