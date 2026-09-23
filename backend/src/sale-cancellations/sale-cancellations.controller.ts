import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { SaleCancellationsService } from './sale-cancellations.service';
import {
    SALE_CANCELLATION_EVIDENCE_MAX_BYTES,
    SALE_CANCELLATION_EVIDENCE_MAX_FILES,
} from './sale-cancellation-evidence.service';

@ApiTags('Sale Cancellations')
@Controller('sale-cancellations')
@UseGuards(SessionAuthGuard)
@ApiCookieAuth()
export class SaleCancellationsController {
    constructor(private readonly service: SaleCancellationsService) {}

    @Post()
    @UseInterceptors(FilesInterceptor('evidence', SALE_CANCELLATION_EVIDENCE_MAX_FILES, {
        limits: {
            files: SALE_CANCELLATION_EVIDENCE_MAX_FILES,
            fileSize: SALE_CANCELLATION_EVIDENCE_MAX_BYTES,
        },
    }))
    @ApiOperation({ summary: 'Buyer or seller requests cancellation of a sale/sale-pending deal' })
    async create(
        @Body() body: { listingId?: string; reason?: string; details?: string },
        @UploadedFiles() files: any[] = [],
        @CurrentUser() user: any,
    ) {
        return new StandardResponse(await this.service.create(user.id, body, files));
    }

    @Get('mine')
    @ApiOperation({ summary: 'Get sale cancellation requests involving the current user/business' })
    async mine(@CurrentUser() user: any) {
        return new StandardResponse(await this.service.mine(user.id));
    }

    @Get('admin/pending')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Admin: list cancellation requests that require manual review' })
    async pendingAdmin() {
        return new StandardResponse(await this.service.pendingAdmin());
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get one cancellation request and privately signed evidence links' })
    async findOne(@Param('id') id: string, @CurrentUser() user: any) {
        return new StandardResponse(await this.service.findOne(id, user.id));
    }

    @Post(':id/respond')
    @ApiOperation({ summary: 'Counterparty accepts or rejects a cancellation request' })
    async respond(
        @Param('id') id: string,
        @Body() body: { decision?: 'ACCEPT' | 'REJECT'; note?: string },
        @CurrentUser() user: any,
    ) {
        if (!body.decision) throw new BadRequestException('decision is required');
        return new StandardResponse(
            await this.service.respond(id, user.id, body.decision, body.note),
        );
    }

    @Post(':id/withdraw')
    @ApiOperation({ summary: 'Requester withdraws a still-open cancellation request' })
    async withdraw(@Param('id') id: string, @CurrentUser() user: any) {
        return new StandardResponse(await this.service.withdraw(id, user.id));
    }

    @Post(':id/admin-review')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Admin approves or rejects an escalated cancellation request' })
    async adminReview(
        @Param('id') id: string,
        @Body() body: { decision?: 'APPROVE' | 'REJECT'; note?: string },
        @CurrentUser() user: any,
    ) {
        if (!body.decision) throw new BadRequestException('decision is required');
        return new StandardResponse(
            await this.service.adminReview(id, user.id, body.decision, body.note),
        );
    }
}
