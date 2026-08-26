import {
    Controller, Get, Post, Delete, Body, Param, UseGuards, Res,
    UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiConsumes } from '@nestjs/swagger';
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
                    // An uploaded PDF is a complete report with no structured
                    // data behind it, so the client can't infer "ready" from
                    // `report` alone — this is what distinguishes that case
                    // from one still genuinely awaiting an admin.
                    hasPdf: !!report.pdfData,
                    pdfUploadedAt: report.pdfUploadedAt,
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

    @Get('listing/:listingId/my-email-request')
    @UseGuards(SessionAuthGuard)
    @ApiOperation({ summary: "Check whether the current buyer already paid to have this report emailed" })
    async getMyEmailRequest(@Param('listingId') listingId: string, @CurrentUser() user: any) {
        const data = await this.hpiService.getMyEmailRequest(listingId, user.id);
        return { success: true, data };
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

    /**
     * The alternative to the form: upload the third-party PDF as supplied.
     *
     * Held in memory and written straight to the row rather than to a bucket —
     * reports are paid content, and the download route below is the only way
     * to reach one. `isClear` arrives as a multipart string, so it's compared
     * rather than trusted as a boolean.
     */
    @Post('admin/:listingId/pdf')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Upload a supplied HPI report PDF and mark the report complete' })
    async uploadPdf(
        @Param('listingId') listingId: string,
        @UploadedFile() file: { buffer: Buffer; originalname?: string; mimetype?: string; size?: number },
        @Body() body: { isClear?: string },
        @CurrentUser() user: any,
    ) {
        if (!file) throw new BadRequestException('No file was uploaded');
        const isClear = body?.isClear === 'true';
        const report = await this.hpiService.saveAdminPdf(listingId, file, isClear, user.id);
        return { success: true, data: report };
    }

    @Delete('admin/:listingId/pdf')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Remove an uploaded HPI report PDF' })
    async removePdf(@Param('listingId') listingId: string) {
        const report = await this.hpiService.removeAdminPdf(listingId);
        return { success: true, data: report };
    }
}
