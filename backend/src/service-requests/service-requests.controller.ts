import {
    Controller,
    Get,
    Patch,
    Param,
    Query,
    Body,
    UseGuards,
    NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ServiceRequestsService } from './service-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ServiceStatus } from '@prisma/client';

@ApiTags('Service Requests')
@Controller('service-requests')
export class ServiceRequestsController {
    constructor(private readonly serviceRequestsService: ServiceRequestsService) { }

    /**
     * Get contractor's service requests (jobs)
     */
    @Get('contractor')
    // @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get my service requests as contractor' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findMyJobs(
        @CurrentUser() user: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const contractorProfileId = await this.serviceRequestsService.getContractorProfileId(user.id);
        if (!contractorProfileId) {
            return { success: true, data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
        }

        const { data, total } = await this.serviceRequestsService.findByContractor(
            contractorProfileId,
            parseInt(page || '1'),
            parseInt(limit || '20'),
        );

        const pageNum = parseInt(page || '1');
        const limitNum = parseInt(limit || '20');

        return {
            success: true,
            data,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        };
    }

    /**
     * Get contractor dashboard stats
     */
    @Get('contractor/stats')
    // @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get contractor dashboard statistics' })
    async getContractorStats(@CurrentUser() user: any) {
        const contractorProfileId = await this.serviceRequestsService.getContractorProfileId(user.id);
        if (!contractorProfileId) {
            return {
                success: true,
                data: { pendingJobs: 0, activeJobs: 0, completedJobs: 0, totalEarnings: 0 }
            };
        }

        const stats = await this.serviceRequestsService.getContractorStats(contractorProfileId);
        return { success: true, data: stats };
    }

    /**
     * Update service request status
     */
    @Patch(':id/status')
    // @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update service request status' })
    @ApiParam({ name: 'id', description: 'Service request ID' })
    async updateStatus(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body('status') status: ServiceStatus,
    ) {
        const contractorProfileId = await this.serviceRequestsService.getContractorProfileId(user.id);
        if (!contractorProfileId) {
            throw new NotFoundException('Contractor profile not found');
        }

        const request = await this.serviceRequestsService.updateStatus(id, contractorProfileId, status);
        return { success: true, data: request };
    }
}
