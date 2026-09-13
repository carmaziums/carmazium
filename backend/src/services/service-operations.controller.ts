import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { StandardResponse } from '../listings/dto/response.dto';
import { ServiceOperationsService, type ServiceCaseEntryInput } from './service-operations.service';

@ApiTags('Trade Exchange provider verification')
@ApiCookieAuth()
@Controller('services/operations')
@UseGuards(SessionAuthGuard)
export class ServiceOperationsController {
    constructor(private readonly operations: ServiceOperationsService) { }

    @Get('capabilities/:id/attachments')
    @ApiOperation({ summary: 'Verification documents attached to one of the caller’s service applications' })
    async capabilityAttachments(@CurrentUser() user: any, @Param('id') id: string) {
        return new StandardResponse(await this.operations.providerCapabilityEntries(user.id, id));
    }

    @Post('capabilities/:id/attachments')
    @ApiOperation({ summary: 'Attach a business verification document to one of the caller’s service applications' })
    async addCapabilityAttachment(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() body: ServiceCaseEntryInput,
    ) {
        return new StandardResponse(await this.operations.addProviderCapabilityEntry(user.id, id, body));
    }
}

@ApiTags('Admin — Trade Exchange operations')
@ApiCookieAuth()
@Controller('admin/services/operations')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminServiceOperationsController {
    constructor(private readonly operations: ServiceOperationsService) { }

    @Get('capabilities/:id')
    @ApiOperation({ summary: 'Provider application detail including uploaded verification documents' })
    async capability(@Param('id') id: string) {
        return new StandardResponse(await this.operations.adminCapabilityDetail(id));
    }

    @Get('jobs/:id')
    @ApiOperation({ summary: 'Read-only admin view of a Trade Exchange job, quotes, payment and dispute case entries' })
    async job(@Param('id') id: string) {
        return new StandardResponse(await this.operations.adminJobDetail(id));
    }

    @Get('leads/:id')
    @ApiOperation({ summary: 'Finance / Warranty enquiry detail with every matched provider and response' })
    async lead(@Param('id') id: string) {
        return new StandardResponse(await this.operations.adminLeadDetail(id));
    }

    @Post('jobs/:id/case-entry')
    @ApiOperation({ summary: 'Add an admin note or evidence attachment to a disputed service job' })
    async addCaseEntry(
        @CurrentUser() admin: any,
        @Param('id') id: string,
        @Body() body: ServiceCaseEntryInput,
    ) {
        return new StandardResponse(await this.operations.adminAddDisputeEntry(admin.id, id, body));
    }

    @Post('jobs/:id/resolve')
    @ApiOperation({ summary: 'Resolve a disputed service job and persist the admin decision in the case history' })
    async resolve(
        @CurrentUser() admin: any,
        @Param('id') id: string,
        @Body() body: { outcome: 'RELEASE' | 'REFUND'; note?: string },
    ) {
        return new StandardResponse(await this.operations.adminResolveDispute(admin.id, id, body));
    }
}
