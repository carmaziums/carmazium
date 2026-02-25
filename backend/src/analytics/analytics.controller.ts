import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CaptureEmailDto } from './dto/capture-email.dto';

@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    // ─── Public Endpoints (no auth) ───────────────────────────────────────────

    @Post('event')
    async trackEvent(@Body() dto: CreateEventDto) {
        await this.analyticsService.trackEvent(dto);
        return { ok: true };
    }

    @Post('email')
    async captureEmail(@Body() dto: CaptureEmailDto) {
        const result = await this.analyticsService.captureEmail(dto);
        return { ok: true, id: result.id };
    }

    // ─── Admin Endpoints ──────────────────────────────────────────────────────
    // TODO: Add admin auth guard when ready

    @Get('summary')
    async getSummary() {
        return this.analyticsService.getSummary();
    }

    @Get('events')
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
    async getEmailLeads(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.analyticsService.getEmailLeads(
            page ? parseInt(page) : 1,
            limit ? parseInt(limit) : 50,
        );
    }
}
