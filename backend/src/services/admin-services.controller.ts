import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole, CapabilityStatus, ServiceJobStatus, ServiceType } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { ServicesService } from './services.service';
import { ServiceLeadsService } from './service-leads.service';
import { ReviewCapabilityDto } from './dto';

@ApiTags('Admin — Trade Exchange services')
@ApiCookieAuth()
@Controller('admin/services')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminServicesController {
    constructor(
        private readonly services: ServicesService,
        private readonly leads: ServiceLeadsService,
    ) { }

    @Get('capabilities')
    @ApiQuery({ name: 'status', enum: Object.values(CapabilityStatus), required: false })
    @ApiQuery({ name: 'serviceType', enum: Object.values(ServiceType), required: false })
    @ApiQuery({ name: 'q', required: false, description: 'Business, provider or email search' })
    @ApiOperation({ summary: 'Provider applications with operational search/filtering' })
    async capabilities(
        @Query('status') status?: string,
        @Query('serviceType') serviceType?: string,
        @Query('q') q?: string,
    ) {
        return new StandardResponse(await this.services.adminListCapabilities({
            status: status as CapabilityStatus | undefined,
            serviceType: serviceType as ServiceType | undefined,
            q,
        }));
    }

    @Patch('capabilities/:id')
    @ApiOperation({
        summary: 'Approve / reject / suspend a provider capability. Stripe Connect is required only for paid Delivery/Inspection jobs.',
    })
    async review(@CurrentUser() admin: any, @Param('id') id: string, @Body() dto: ReviewCapabilityDto) {
        const leadType = await this.leads.isLeadCapability(id);
        if (leadType) {
            return new StandardResponse(await this.leads.reviewLeadCapability(admin.id, id, dto));
        }
        return new StandardResponse(await this.services.adminReviewCapability(admin.id, id, dto));
    }

    @Get('jobs')
    @ApiQuery({ name: 'status', enum: Object.values(ServiceJobStatus), required: false })
    @ApiQuery({ name: 'serviceType', enum: [ServiceType.DELIVERY, ServiceType.INSPECTION], required: false })
    @ApiQuery({ name: 'q', required: false, description: 'Job title, customer, provider or email search' })
    async jobs(
        @Query('status') status?: string,
        @Query('serviceType') serviceType?: string,
        @Query('q') q?: string,
    ) {
        return new StandardResponse(await this.services.adminListJobs({
            status: status as ServiceJobStatus | undefined,
            serviceType: serviceType as ServiceType | undefined,
            q,
        }));
    }

    @Get('disputes')
    @ApiQuery({ name: 'serviceType', enum: [ServiceType.DELIVERY, ServiceType.INSPECTION], required: false })
    @ApiQuery({ name: 'q', required: false, description: 'Disputed job, customer, provider or email search' })
    @ApiOperation({ summary: 'Disputed jobs for the authoritative operations settlement workflow' })
    async disputes(@Query('serviceType') serviceType?: string, @Query('q') q?: string) {
        return new StandardResponse(await this.services.adminListJobs({
            status: ServiceJobStatus.DISPUTED,
            serviceType: serviceType as ServiceType | undefined,
            q,
        }));
    }

    @Post('leads/:id/rematch')
    @ApiOperation({ summary: 'Explicitly rematch one open Finance/Warranty enquiry to newly eligible providers, up to the recipient cap' })
    async rematchLead(@Param('id') id: string) {
        return new StandardResponse(await this.leads.adminRematch(id));
    }

    @Get('leads')
    @ApiQuery({ name: 'serviceType', enum: [ServiceType.FINANCE, ServiceType.WARRANTY], required: false })
    @ApiQuery({ name: 'status', enum: ['OPEN', 'CLOSED', 'CANCELLED', 'EXPIRED'], required: false })
    @ApiQuery({ name: 'q', required: false, description: 'Customer, email, registration or vehicle search' })
    @ApiOperation({ summary: 'Finance and Warranty enquiry oversight with search/filtering' })
    async leadEnquiries(
        @Query('serviceType') serviceType?: string,
        @Query('status') status?: string,
        @Query('q') q?: string,
    ) {
        return new StandardResponse(
            await this.leads.adminList(serviceType as ServiceType | undefined, status, q),
        );
    }
}
