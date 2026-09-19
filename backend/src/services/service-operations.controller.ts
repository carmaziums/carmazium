import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { StandardResponse } from '../listings/dto/response.dto';
import {
    ServiceOperationsService,
    type CapabilityEvidenceReviewInput,
    type CapabilityEvidenceUploadInput,
    type ServiceCaseEntryInput,
} from './service-operations.service';

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

    @Get('capabilities/:id/verification')
    @ApiOperation({ summary: 'Service-specific provider verification checklist and evidence state' })
    async capabilityVerification(@CurrentUser() user: any, @Param('id') id: string) {
        return new StandardResponse(await this.operations.providerCapabilityVerification(user.id, id));
    }

    @Post('capabilities/:id/attachments')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
    @ApiOperation({ summary: 'Securely upload typed private verification evidence to one service application' })
    async addCapabilityAttachment(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @UploadedFile() file: any,
        @Body() body: CapabilityEvidenceUploadInput,
    ) {
        return new StandardResponse(
            await this.operations.uploadProviderCapabilityDocument(user.id, id, file, body),
        );
    }

    @Delete('capabilities/:id/attachments/:entryId')
    @ApiOperation({ summary: 'Delete one of the caller’s private verification documents' })
    async deleteCapabilityAttachment(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Param('entryId') entryId: string,
    ) {
        return new StandardResponse(
            await this.operations.deleteProviderCapabilityDocument(user.id, id, entryId),
        );
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

    @Patch('capabilities/:id/evidence/:entryId')
    @ApiOperation({ summary: 'Approve or reject one provider verification evidence item' })
    async reviewCapabilityEvidence(
        @CurrentUser() admin: any,
        @Param('id') id: string,
        @Param('entryId') entryId: string,
        @Body() body: CapabilityEvidenceReviewInput,
    ) {
        return new StandardResponse(
            await this.operations.adminReviewCapabilityEvidence(admin.id, id, entryId, body),
        );
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
    @ApiOperation({ summary: 'Add an admin note to a disputed service job' })
    async addCaseEntry(
        @CurrentUser() admin: any,
        @Param('id') id: string,
        @Body() body: ServiceCaseEntryInput,
    ) {
        return new StandardResponse(await this.operations.adminAddDisputeEntry(admin.id, id, body));
    }

    @Post('jobs/:id/case-entry/upload')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
    @ApiOperation({ summary: 'Securely upload private evidence to a disputed service job' })
    async uploadCaseEntry(
        @CurrentUser() admin: any,
        @Param('id') id: string,
        @UploadedFile() file: any,
        @Body() body: { label?: string },
    ) {
        return new StandardResponse(
            await this.operations.adminUploadDisputeDocument(admin.id, id, file, body?.label),
        );
    }

    @Delete('jobs/:id/case-entry/:entryId')
    @ApiOperation({ summary: 'Delete a private evidence document from a service dispute case' })
    async deleteCaseEntry(
        @Param('id') id: string,
        @Param('entryId') entryId: string,
    ) {
        return new StandardResponse(await this.operations.adminDeleteDisputeDocument(id, entryId));
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
