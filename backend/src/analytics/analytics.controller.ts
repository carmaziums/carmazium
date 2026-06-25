import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CaptureEmailDto } from './dto/capture-email.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { subDays } from 'date-fns';

// Lazy-load geoip-lite so a missing native module doesn't crash startup
let geoip: typeof import('geoip-lite') | null = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    geoip = require('geoip-lite');
} catch {
    // geoip-lite unavailable — city/country fields will be omitted
}

function extractIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return req.ip ?? null;
}

@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    // ─── Public Endpoints ──────────────────────────────────────────────────────

    @Post('event')
    async trackEvent(@Body() dto: CreateEventDto, @Req() req: Request) {
        // Enrich payload with server-side geo derived from client IP
        if (geoip) {
            const ip = extractIp(req);
            const geo = ip ? geoip.lookup(ip) : null;
            if (geo) {
                const existing = (dto.payload as Record<string, unknown>) ?? {};
                dto.payload = {
                    city: geo.city || null,
                    country: geo.country || null,
                    ...existing, // client-sent values take precedence
                };
            }
        }
        await this.analyticsService.trackEvent(dto);
        return { ok: true };
    }

    @Post('email')
    async captureEmail(@Body() dto: CaptureEmailDto) {
        const result = await this.analyticsService.captureEmail(dto);
        return { ok: true, id: result.id };
    }

    // ─── Admin-only Endpoints ─────────────────────────────────────────────────

    @Get('summary')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getSummary() {
        return this.analyticsService.getSummary();
    }

    @Get('events')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getEvents(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('type') type?: string,
    ) {
        return this.analyticsService.getEvents(
            page ? parseInt(page) : 1,
            limit ? parseInt(limit) : 50,
            type,
        );
    }

    @Get('emails')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getEmailLeads(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.analyticsService.getEmailLeads(
            page ? parseInt(page) : 1,
            limit ? parseInt(limit) : 50,
        );
    }

    @Get('traffic')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getTraffic(
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        const toDate = to ? new Date(to) : new Date();
        const fromDate = from ? new Date(from) : subDays(toDate, 30);
        // Set toDate to end of that day
        toDate.setHours(23, 59, 59, 999);
        return this.analyticsService.getTrafficAnalytics(fromDate, toDate);
    }
}
