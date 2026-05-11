import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HpiService } from './hpi.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';

@ApiTags('HPI Reports')
@Controller('hpi')
export class HpiController {
    constructor(private readonly hpiService: HpiService) { }

    @Get('listing/:listingId')
    @ApiOperation({ summary: 'Get HPI report for a listing' })
    @ApiResponse({ status: 200, description: 'HPI report found' })
    @ApiResponse({ status: 404, description: 'Report not found' })
    async getReport(@Param('listingId') listingId: string) {
        return this.hpiService.getReportForListing(listingId);
    }
}
