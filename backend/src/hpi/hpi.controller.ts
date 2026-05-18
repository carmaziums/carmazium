import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HpiService } from './hpi.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';

@ApiTags('HPI Reports')
@Controller('hpi')
export class HpiController {
    constructor(private readonly hpiService: HpiService) { }

    @Get('listing/:listingId')
    @ApiOperation({ summary: 'Get raw HPI report for a listing' })
    @ApiResponse({ status: 200, description: 'HPI report found' })
    @ApiResponse({ status: 404, description: 'Report not found' })
    async getReport(@Param('listingId') listingId: string) {
        return this.hpiService.getReportForListing(listingId);
    }

    @Get('listing/:listingId/summary')
    @ApiOperation({ summary: 'Get parsed HPI report summary for a listing' })
    @ApiResponse({ status: 200, description: 'HPI summary returned' })
    @ApiResponse({ status: 404, description: 'Report not found' })
    async getReportSummary(@Param('listingId') listingId: string) {
        const report = await this.hpiService.getReportForListing(listingId);
        const summary = this.hpiService.parseReportSummary(report.data);
        return {
            success: true,
            data: {
                ...summary,
                vrm: report.vrm,
                isClear: report.isClear,
                purchasedAt: report.purchasedAt,
                createdAt: report.purchasedAt,
            },
        };
    }
}
