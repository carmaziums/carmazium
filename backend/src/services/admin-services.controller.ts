import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole, CapabilityStatus, ServiceJobStatus } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { ServicesService } from './services.service';
import { ReviewCapabilityDto, ResolveDisputeDto } from './dto';

@ApiTags('Admin — Trade Exchange services')
@ApiCookieAuth()
@Controller('admin/services')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminServicesController {
    constructor(private readonly services: ServicesService) { }

    @Get('capabilities')
    @ApiQuery({ name: 'status', enum: CapabilityStatus, required: false })
    @ApiOperation({ summary: 'Provider applications, oldest first' })
    async capabilities(@Query('status') status?: CapabilityStatus) {
        return new StandardResponse(await this.services.adminListCapabilities(status));
    }

    @Patch('capabilities/:id')
    @ApiOperation({ summary: 'Approve / reject / suspend. Approval requires Stripe Connect to be complete.' })
    async review(@CurrentUser() admin: any, @Param('id') id: string, @Body() dto: ReviewCapabilityDto) {
        return new StandardResponse(await this.services.adminReviewCapability(admin.id, id, dto));
    }

    @Get('jobs')
    @ApiQuery({ name: 'status', enum: ServiceJobStatus, required: false })
    async jobs(@Query('status') status?: ServiceJobStatus) {
        return new StandardResponse(await this.services.adminListJobs(status));
    }

    @Post('jobs/:id/resolve')
    @ApiOperation({ summary: 'Resolve a DISPUTED job: RELEASE to the provider or REFUND the customer' })
    async resolve(@CurrentUser() admin: any, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
        return new StandardResponse(await this.services.adminResolveDispute(admin.id, id, dto));
    }
}
