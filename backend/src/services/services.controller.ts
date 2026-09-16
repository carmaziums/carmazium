import {
    Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { ServicesService } from './services.service';
import { ContractorGuard } from './guards/contractor.guard';
import { TradeTeamService } from './trade-team.service';
import { ACCEPTED_PAYMENT_TIMEOUT_MINUTES } from './services-lifecycle.service';
import {
    CreateJobDto, JobFromPurchaseDto, CancelJobDto, UpsertQuoteDto, ApplyCapabilityDto,
} from './dto';

/**
 * TradeXchange service marketplace.
 *
 * Route order matters: the static contractor routes (`jobs/feed`,
 * `jobs/assigned`, `jobs/my`) are declared before `jobs/:id` so Nest does not
 * read "feed" as an id.
 */
@ApiTags('TradeXchange services')
@ApiCookieAuth()
@Controller('services')
@UseGuards(SessionAuthGuard)
export class ServicesController {
    constructor(
        private readonly services: ServicesService,
        private readonly tradeTeam: TradeTeamService,
        private readonly config: ConfigService,
    ) { }

    // ── Shared marketplace settings ───────────────────────────────────────

    @Get('settings')
    @ApiOperation({ summary: 'Current TradeXchange service fee and lifecycle settings' })
    async settings() {
        const configured = Number(this.config.get<string>('SERVICE_PLATFORM_FEE_RATE') ?? '0.09');
        const platformFeeRate = Number.isFinite(configured) && configured >= 0 && configured < 1
            ? configured
            : 0.09;
        return new StandardResponse({
            platformFeeRate,
            providerShareRate: 1 - platformFeeRate,
            acceptedPaymentTimeoutMinutes: ACCEPTED_PAYMENT_TIMEOUT_MINUTES,
        });
    }

    // ── Contractor onboarding ──────────────────────────────────────────────

    @Post('capabilities')
    @ApiOperation({ summary: 'Apply to provide a service area (creates the contractor profile on first use)' })
    async apply(@CurrentUser() user: any, @Body() dto: ApplyCapabilityDto) {
        return new StandardResponse(await this.services.applyCapability(user.id, dto));
    }

    @Get('capabilities/my')
    @ApiOperation({ summary: 'My provider profile, applications and Stripe Connect state' })
    async myCapabilities(@CurrentUser() user: any) {
        return new StandardResponse(await this.services.myCapabilities(user.id));
    }

    // ── Customer ───────────────────────────────────────────────────────────

    @Post('jobs')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Post a job — any signed-in account' })
    async create(@CurrentUser() user: any, @Body() dto: CreateJobDto) {
        return new StandardResponse(await this.services.createJob(user.id, dto));
    }

    @Post('jobs/from-purchase')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Post a delivery job pre-filled from a won auction or accepted offer' })
    async fromPurchase(@CurrentUser() user: any, @Body() dto: JobFromPurchaseDto) {
        return new StandardResponse(await this.services.createJobFromPurchase(user.id, dto));
    }

    @Get('jobs/my')
    @ApiOperation({ summary: 'Jobs the caller posted' })
    async myJobs(@CurrentUser() user: any) {
        return new StandardResponse(await this.services.myJobs(user.id));
    }

    // ── Provider / authorised dealership team ─────────────────────────────

    @Get('jobs/feed')
    @UseGuards(ContractorGuard)
    @ApiQuery({ name: 'serviceType', enum: Object.values(ServiceType), required: false })
    @ApiOperation({ summary: 'Open jobs in approved service areas (customer identity redacted)' })
    async feed(@Req() req: any, @Query('serviceType') serviceType?: string) {
        return new StandardResponse(
            await this.services.feed(
                req.contractorProfileId,
                req.approvedServiceTypes,
                serviceType as ServiceType | undefined,
            ),
        );
    }

    @Get('jobs/assigned')
    @UseGuards(ContractorGuard)
    @ApiOperation({ summary: 'Jobs assigned to the provider business and visible to the caller’s role' })
    async assigned(@Req() req: any) {
        const jobs = await this.services.assigned(req.contractorProfileId);
        const allowed = new Set<ServiceType>(req.approvedServiceTypes ?? []);
        return new StandardResponse(jobs.filter((job: any) => allowed.has(job.serviceType)));
    }

    @Put('jobs/:id/quote')
    @UseGuards(ContractorGuard)
    @ApiOperation({ summary: 'Create or update a quote on behalf of the provider business' })
    async quote(@Req() req: any, @CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpsertQuoteDto) {
        if (req.tradeActor) await this.tradeTeam.assertJobPermission(req.tradeActor, id, 'quote');
        const actingUserId = req.tradeActor?.actingUserId ?? user.id;
        const result = await this.services.upsertQuote(
            req.contractorProfileId,
            req.approvedServiceTypes,
            actingUserId,
            id,
            dto,
        );
        if (req.tradeActor) {
            await this.tradeTeam.logAction(req.tradeActor, id, 'QUOTE_UPSERTED', {
                quoteId: result.id,
                amountPence: dto.amountPence,
            });
        }
        return new StandardResponse(result);
    }

    @Delete('jobs/:id/quote')
    @UseGuards(ContractorGuard)
    @ApiOperation({ summary: 'Withdraw the provider business quote' })
    async withdraw(@Req() req: any, @Param('id') id: string) {
        if (req.tradeActor) await this.tradeTeam.assertJobPermission(req.tradeActor, id, 'quote');
        const result = await this.services.withdrawQuote(req.contractorProfileId, id);
        if (req.tradeActor) await this.tradeTeam.logAction(req.tradeActor, id, 'QUOTE_WITHDRAWN');
        return new StandardResponse(result);
    }

    @Post('jobs/:id/start')
    @UseGuards(ContractorGuard)
    @ApiOperation({ summary: 'Mark a paid job as started on behalf of the provider business' })
    async start(@Req() req: any, @Param('id') id: string) {
        if (req.tradeActor) await this.tradeTeam.assertJobPermission(req.tradeActor, id, 'manage');
        const result = await this.services.startJob(req.contractorProfileId, id);
        if (req.tradeActor) await this.tradeTeam.logAction(req.tradeActor, id, 'JOB_STARTED');
        return new StandardResponse(result);
    }

    @Post('jobs/:id/complete')
    @UseGuards(ContractorGuard)
    @ApiOperation({ summary: 'Mark a job complete on behalf of the provider business' })
    async complete(@Req() req: any, @Param('id') id: string) {
        if (req.tradeActor) await this.tradeTeam.assertJobPermission(req.tradeActor, id, 'complete');
        const result = await this.services.completeJob(req.contractorProfileId, id);
        if (req.tradeActor) await this.tradeTeam.logAction(req.tradeActor, id, 'JOB_COMPLETED');
        return new StandardResponse(result);
    }

    // ── Shared / customer actions on a job ─────────────────────────────────

    @Get('jobs/:id')
    @ApiOperation({ summary: 'A job, shaped for whoever is asking' })
    async getOne(@CurrentUser() user: any, @Param('id') id: string) {
        const contractorProfileId = user.role === 'ADMIN'
            ? null
            : await this.tradeTeam.contractorProfileForJob(user.id, id);
        return new StandardResponse(
            await this.services.getJob({ userId: user.id, role: user.role, contractorProfileId }, id),
        );
    }

    @Post('jobs/:id/cancel')
    @ApiOperation({ summary: 'Cancel an OPEN job' })
    async cancel(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CancelJobDto) {
        return new StandardResponse(await this.services.cancelJob(user.id, id, dto));
    }

    @Post('jobs/:id/quotes/:quoteId/accept')
    @ApiOperation({ summary: 'Accept a quote → Stripe Checkout URL' })
    async accept(@CurrentUser() user: any, @Param('id') id: string, @Param('quoteId') quoteId: string) {
        return new StandardResponse(await this.services.acceptQuote(user.id, id, quoteId));
    }

    @Post('jobs/:id/confirm')
    @ApiOperation({ summary: 'Confirm completion → releases the provider payout' })
    async confirm(@CurrentUser() user: any, @Param('id') id: string) {
        return new StandardResponse(await this.services.confirmCompletion(user.id, id));
    }

    @Post('jobs/:id/dispute')
    @ApiOperation({ summary: 'Freeze a paid job for admin review' })
    async dispute(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CancelJobDto) {
        return new StandardResponse(await this.services.openDispute(user.id, id, dto.reason));
    }
}
