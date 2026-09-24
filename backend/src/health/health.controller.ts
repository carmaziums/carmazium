import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HttpHealthIndicator, HealthCheck, PrismaHealthIndicator } from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private http: HttpHealthIndicator,
        private prisma: PrismaHealthIndicator,
        private prismaService: PrismaService,
    ) { }

    @Get('release')
    @ApiOperation({ summary: 'Return the deployed One Product release identity' })
    release() {
        const releaseId = process.env.RELEASE_ID || process.env.FLY_IMAGE_REF || 'unknown';
        return {
            releaseId,
            environment: process.env.NODE_ENV || 'development',
            service: 'backend',
        };
    }

    @Get()
    @HealthCheck()
    @ApiOperation({ summary: 'Check system health' })
    check() {
        return this.health.check([
            // Check database connection
            () => this.prisma.pingCheck('database', this.prismaService),
            // Check if the API itself is responding (self-check). Use HEALTH_SELF_URL in containers/proxy.
            () => this.http.pingCheck(
                'api',
                process.env.HEALTH_SELF_URL || `http://localhost:${process.env.PORT || 3001}/api`,
            ),
        ]);
    }
}
