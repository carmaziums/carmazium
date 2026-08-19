import { Controller, Get, Post, Body, Param, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { HpiService } from './hpi.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HpiReportData } from './hpi-report.types';

@ApiTags('HPI Reports')
@ApiCookieAuth()
@Controller('hpi')
export class HpiController {
    constructor(private readonly hpiService: HpiService) { }

    /**
     * Every read route sits behind SessionAuthGuard: the seller paid for this
     * report, so it isn't handed to anonymous traffic. The PDF is rendered on
     * demand rather than stored in a bucket, which keeps it impossible to
     * reach by guessing a storage URL.
     */
    @Get('listing/:listingId/summary')
    @UseGuards(SessionAuthGuard)
    @ApiOperation({ summary: 'Get the HPI report for a listing (logged-in users only)' })
    @ApiResponse({ status: 200, description: 'HPI report returned' })
    @ApiResponse({ status: 404, description: 'Report not found' })
    async getSummary(@Param('listingId') listingId: string) {
        const report = await this.hpiService.getReportForListing(listingId);

        // Admin-prepared reports carry structured data; legacy OneAutoAPI rows
        // still have to be parsed out of their raw response shape.
        if (report.source === 'ADMIN') {
            return {
                success: true,
                data: {
                    format: 'ADMIN' as const,
                    status: report.status,
                    vrm: report.vrm,
                    isClear: report.isClear,
                    purchasedAt: report.purchasedAt,
                    preparedAt: report.preparedAt,
                    report: report.reportData ?? null,
                },
            };
        }

        const summary = this.hpiService.parseLegacySummary(report.data);
        return {
            success: true,
            data: {
                format: 'LEGACY' as const,
                status: report.status,
                ...summary,
                vrm: report.vrm,
                isClear: report.isClear,
                purchasedAt: report.purchasedAt,
                createdAt: report.purchasedAt,
            },
        };
    }

    @Get('listing/:listingId/pdf')
    @UseGuards(SessionAuthGuard)
    @ApiOperation({ summary: 'Download the branded HPI report PDF (logged-in users only)' })
    async downloadPdf(@Param('listingId') listingId: string, @Res() res: Response) {
        const { buffer, filename } = await this.hpiService.renderPdf(listingId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.end(buffer);
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    @Get('admin/pending')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'List listings awaiting an HPI report' })
    async getPending() {
        const data = await this.hpiService.getPendingReports();
        return { success: true, data };
    }

    @Get('admin/:listingId/prefill')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Seed the admin report form from the listing' })
    async getPrefill(@Param('listingId') listingId: string) {
        const data = await this.hpiService.buildPrefill(listingId);
        return { success: true, data };
    }

    @Post('admin/:listingId')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Save an admin-prepared HPI report and mark it complete' })
    async saveReport(
        @Param('listingId') listingId: string,
        @Body() body: { report: HpiReportData },
        @CurrentUser() user: any,
    ) {
        const report = await this.hpiService.saveAdminReport(listingId, body.report, user.id);
        return { success: true, data: report };
    }
}
