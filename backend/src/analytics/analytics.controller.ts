import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CaptureEmailDto } from './dto/capture-email.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    // ─── Public Endpoints (intentionally unguarded — called from frontend) ──────

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
}
