import { Controller, Post, Get, Patch, Param, Body, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { ProblemReportInput } from './app-insights';
import { OnlinePresenceService, type HeartbeatInput } from './online-presence.service';
import { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { ValuationHistoryService } from './valuation-history.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CaptureEmailDto } from './dto/capture-email.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { assertPublicAnalyticsEvent } from './analytics-event-policy';
import { londonDayString, londonTrafficRange, shiftIsoDate } from './london-traffic-range';

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
    constructor(
        private readonly analyticsService: AnalyticsService,
        private readonly valuationHistory: ValuationHistoryService,
        private readonly authService: AuthService,
        private readonly presence: OnlinePresenceService,
    ) { }

    // ─── Public Endpoints ──────────────────────────────────────────────────────

    @Post('event')
    async trackEvent(@Body() dto: CreateEventDto, @Req() req: Request) {
        assertPublicAnalyticsEvent(dto);

        // Never trust userId supplied in a public event body. Verify the
        // Bearer token, or use the user hydrated by validated session middleware.
        // Prefer the verified Bearer identity when both credentials exist.
        const header = req.headers.authorization;
        const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
        let authenticatedUser = (req as Request & { user?: { id?: string } }).user;
        if (bearer) {
            try {
                authenticatedUser = (await this.authService.verifySupabaseToken(bearer)) ?? undefined;
            } catch {
                authenticatedUser = undefined;
            }
        }
        dto.userId = typeof authenticatedUser?.id === 'string' ? authenticatedUser.id : undefined;

        // Enrich payload with server-side geo derived from client IP
        if (geoip) {
            const ip = extractIp(req);
            const geo = ip ? geoip.lookup(ip) : null;
            if (geo) {
                const existing = (dto.payload as Record<string, unknown>) ?? {};
                dto.payload = {
                    ...existing,
                    city: geo.city || null,
                    country: geo.country || null,
                };
            }
        }
        await this.analyticsService.trackEvent(dto);
        return { ok: true };
    }

    /**
     * Customer "Report a problem" (app and website). Guests may report too;
     * a signed-in reporter is identified from the verified token only.
     */
    @Post('problem-report')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 600_000 } })
    async reportProblem(@Body() body: ProblemReportInput, @Req() req: Request) {
        if (!body || typeof body !== 'object') throw new BadRequestException('Invalid report');
        // Identify the reporter only from an explicit Bearer token — never a
        // cookie session — so another site cannot file reports in a user's name.
        const header = req.headers.authorization;
        const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
        let user: { id?: string } | undefined;
        if (bearer) {
            try { user = (await this.authService.verifySupabaseToken(bearer)) ?? undefined; } catch { user = undefined; }
        }
        const result = await this.analyticsService.submitProblemReport(body, typeof user?.id === 'string' ? user.id : undefined);
        return { ok: true, ...result };
    }

    /**
     * "Still here" heartbeat from an open website tab or app (about once a
     * minute while visible). Feeds the admin "Online now" count only; nothing
     * is stored in the database.
     */
    @Post('heartbeat')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 12, ttl: 60_000 } })
    async heartbeat(@Body() body: HeartbeatInput & { signedIn?: unknown }) {
        await this.presence.heartbeat(body ?? {}, body?.signedIn === true);
        return { ok: true };
    }

    @Get('online')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getOnline() {
        return this.presence.online();
    }

    // ─── Admin: app downloads & problem reports ────────────────────────────────

    @Get('app-stats')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getAppStats() {
        return this.analyticsService.getAppStats();
    }

    @Get('problem-reports')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getProblemReports(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
    ) {
        return this.analyticsService.getProblemReports(
            page ? parseInt(page) || 1 : 1,
            limit ? parseInt(limit) || 30 : 30,
            status === 'open' || status === 'resolved' ? status : undefined,
        );
    }

    @Patch('problem-reports/:id/status')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async setProblemReportStatus(@Param('id') id: string, @Body() body: { status?: string }) {
        if (body?.status !== 'new' && body?.status !== 'resolved') throw new BadRequestException('Status must be new or resolved');
        return this.analyticsService.setProblemReportStatus(id, body.status);
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

    @Get('account-verification')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getAccountVerification() {
        return this.analyticsService.getAccountVerificationStats();
    }

    @Get('valuations/live')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getLiveValuationAnalytics() {
        return this.analyticsService.getValuationAnalytics();
    }

    /** Read-only archived quotes: admin only, exactly 12 months. */
    @Get('valuations/history')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getQuoteHistory(@Query('q') query?: string, @Query('page') page?: string) {
        const rawPage = page ? Number.parseInt(page, 10) : 1;
        return this.valuationHistory.getHistory(query || '', Number.isFinite(rawPage) ? rawPage : 1);
    }

    @Get('auctions/first-offers')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getAuctionFirstOfferAnalytics(@Query('days') days?: string) {
        const parsed = days ? parseInt(days, 10) : 30;
        return this.analyticsService.getAuctionFirstOfferAnalytics(
            Number.isFinite(parsed) ? parsed : 30,
        );
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
        const toDay = to || londonDayString(new Date());
        const fromDay = from || shiftIsoDate(toDay, -29);
        const { from: fromUtc, untilExclusive } = londonTrafficRange(fromDay, toDay);
        return this.analyticsService.getTrafficAnalytics(fromUtc, untilExclusive);
    }
}
