import {
    Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { ServicesService } from './services.service';
import { ContractorGuard } from './guards/contractor.guard';
import { TradeTeamService } from './trade-team.service';
import { ACCEPTED_PAYMENT_TIMEOUT_MINUTES } from './services-lifecycle.service';
import { serviceAvailabilitySnapshot } from './service-availability';
import {
    CreateJobDto, JobFromPurchaseDto, InspectionFromAuctionDto, CompleteJobDto, CancelJobDto, UpsertQuoteDto, ApplyCapabilityDto,
    UpdateLeadMatchingDto, UpdateJobMatchingDto, ServiceListQueryDto, ServiceJobFeedQueryDto, CreateServiceReviewDto,
} from './dto';

/** The TradeXchange paid-job commercial split is fixed: 9% CarMazium / 91% provider business. */
const SERVICE_PLATFORM_FEE_RATE = 0.09;

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
@UseGuards(SessionAuthGuard, ThrottlerGuard)
export class ServicesController {
    constructor(
        private readonly services: ServicesService,
        private readonly tradeTeam: TradeTeamService,
    ) { }

    // ── Shared marketplace settings ───────────────────────────────────────

    @Get('settings')
    @ApiOperation({ summary: 'Current TradeXchange service fee and lifecycle settings' })
    async settings() {
        return new StandardResponse({
            platformFeeRate: SERVICE_PLATFORM_FEE_RATE,
            providerShareRate: 1 - SERVICE_PLATFORM_FEE_RATE,
            acceptedPaymentTimeoutMinutes: ACCEPTED_PAYMENT_TIMEOUT_MINUTES,
            availability: serviceAvailabilitySnapshot(),
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

    @Patch('capabilities/:id/lead-matching')
    @ApiOperation({ summary: 'Configure Finance/Warranty lead matching coverage and eligibility' })
    async updateLeadMatching(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: UpdateLeadMatchingDto,
    ) {
        return new StandardResponse(await this.services.updateLeadMatching(user.id, id, dto));
    }

    @Patch('capabilities/:id/job-matching')
    @ApiOperation({ summary: 'Configure Delivery/Inspection UK postcode coverage' })
    async updateJobMatching(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: UpdateJobMatchingDto,
    ) {
        return new StandardResponse(await this.services.updateJobMatching(user.id, id, dto));
    }

    // ── Customer ───────────────────────────────────────────────────────────

    @Post('jobs')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Post a job — any signed-in account' })
    async create(@CurrentUser() user: any, @Body() dto: CreateJobDto) {
        return new StandardResponse(await this.services.createJob(user.id, dto));
    }

    @Post('jobs/from-purchase')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Post a delivery job pre-filled from a won auction or accepted offer' })
    async fromPurchase(@CurrentUser() user: any, @Body() dto: JobFromPurchaseDto) {
        return new StandardResponse(await this.services.createJobFromPurchase(user.id, dto));
    }

    @Post('jobs/inspection/from-auction')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Post a purchase-linked inspection for a won auction' })
    async inspectionFromAuction(
        @CurrentUser() user: any,
        @Body() dto: InspectionFromAuctionDto,
    ) {
        return new StandardResponse(await this.services.createInspectionFromAuction(user.id, dto));
    }

    @Get('jobs/my')
    @ApiOperation({ summary: 'Jobs the caller posted' })
    async myJobs(@CurrentUser() user: any, @Query() page: ServiceListQueryDto) {
        return new StandardResponse(await this.services.myJobsPage(user.id, page));
    }

    // ── Provider / authorised dealership team ─────────────────────────────

    @Get('jobs/feed')
    @UseGuards(ContractorGuard)
    @ApiOperation({ summary: 'Open jobs in approved service and postcode areas (cursor paginated)' })
    async feed(@Req() req: any, @Query() query: ServiceJobFeedQueryDto) {
        return new StandardResponse(
            await this.services.feedPage(
                req.contractorProfileId,
                req.approvedServiceTypes,
                query.serviceType,
                query,
            ),
        );
    }

    @Get('jobs/assigned')
    @UseGuards(ContractorGuard)
    @ApiOperation({ summary: 'Jobs assigned to the provider business and visible to the caller’s role' })
    async assigned(@Req() req: any, @Query() page: ServiceListQueryDto) {
        return new StandardResponse(
            await this.services.assignedPage(
                req.contractorProfileId,
                req.approvedServiceTypes ?? [],
                page,
            ),
        );
    }

    @Put('jobs/:id/quote')
    @UseGuards(ContractorGuard)
    @Throttle({ default: { limit: 20, ttl: 60_000 } })
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
    async complete(@Req() req: any, @Param('id') id: string, @Body() dto: CompleteJobDto) {
        if (req.tradeActor) await this.tradeTeam.assertJobPermission(req.tradeActor, id, 'complete');
        const result = await this.services.completeJob(req.contractorProfileId, id, dto);
        if (req.tradeActor) await this.tradeTeam.logAction(req.tradeActor, id, 'JOB_COMPLETED');
        return new StandardResponse(result);
    }

    // ── Shared / customer actions on a job ─────────────────────────────────

    @Get('jobs/:id')
    @ApiOperation({ summary: 'A job, shaped for whoever is asking' })
    async getOne(@Req() req: any, @CurrentUser() user: any, @Param('id') id: string) {
        const actor = user.role === 'ADMIN' ? null : await this.tradeTeam.tryResolveActor(user.id);
        const contractorProfileId = user.role === 'ADMIN'
            ? null
            : await this.tradeTeam.contractorProfileForJob(user.id, id);
        const result = await this.services.getJob({ userId: user.id, role: user.role, contractorProfileId }, id);
        if (actor?.isStaff && contractorProfileId) {
            await this.tradeTeam.logAction(actor, id, 'JOB_VIEWED');
        }
        return new StandardResponse(result);
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

    @Post('jobs/:id/review')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Leave one verified review after the service job and payment are released' })
    async reviewService(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: CreateServiceReviewDto,
    ) {
        return new StandardResponse(await this.services.createServiceReview(user.id, id, dto));
    }
}
