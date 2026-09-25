import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiCookieAuth,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { InsuranceQuote, UserRole } from '@prisma/client';
import { InsuranceService } from './insurance.service';
import { CreateInsuranceQuoteDto } from './dto/create-insurance-quote.dto';
import { UpdateInsuranceStatusDto } from './dto/update-insurance-status.dto';
import { UpdateInsurancePartnerSettingsDto } from './dto/update-partner-settings.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginatedResponse, StandardResponse } from '../listings/dto/response.dto';

@ApiTags('Insurance')
@Controller('insurance')
@ApiCookieAuth()
@UseGuards(SessionAuthGuard)
export class InsuranceController {
    constructor(private readonly insuranceService: InsuranceService) { }

    @Post('quote')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Request insurance quote' })
    @ApiResponse({ status: 201, description: 'Quote requested' })
    async create(
        @Body() dto: CreateInsuranceQuoteDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<InsuranceQuote>> {
        const quote = await this.insuranceService.create(user.id, dto);
        return new StandardResponse(quote);
    }

    @Get('my')
    @ApiOperation({ summary: 'Get my insurance quotes' })
    async findMyQuotes(
        @CurrentUser() user: any,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<PaginatedResponse<InsuranceQuote>> {
        const result = await this.insuranceService.findMyQuotes(
            user.id,
            Number(page),
            Number(limit),
        );
        // @ts-ignore
        return new PaginatedResponse(result.data, result.total, result.page, result.limit);
    }

    @Get('partner')
    @UseGuards(RolesGuard)
    @Roles(UserRole.INSURANCE_PARTNER)
    @ApiOperation({ summary: 'Get insurance partner quotes' })
    async findPartnerQuotes(
        @CurrentUser() user: any,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<PaginatedResponse<InsuranceQuote>> {
        const partnerId = await this.insuranceService.getPartnerProfileId(user.id);
        if (!partnerId) {
            const safePage = Math.max(1, Number(page) || 1);
            const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
            return new PaginatedResponse([], 0, safePage, safeLimit);
        }

        const result = await this.insuranceService.findByPartner(
            partnerId,
            Number(page),
            Number(limit),
        );
        // @ts-ignore
        return new PaginatedResponse(result.data, result.total, result.page, result.limit);
    }

    @Get('partner/stats')
    @UseGuards(RolesGuard)
    @Roles(UserRole.INSURANCE_PARTNER)
    @ApiOperation({ summary: 'Get insurance partner statistics' })
    async getPartnerStats(@CurrentUser() user: any) {
        return new StandardResponse(await this.insuranceService.getPartnerStats(user.id));
    }

    @Get('partner/settings')
    @UseGuards(RolesGuard)
    @Roles(UserRole.INSURANCE_PARTNER)
    @ApiOperation({ summary: 'Get insurance partner settings' })
    async getPartnerSettings(@CurrentUser() user: any) {
        return new StandardResponse(await this.insuranceService.getPartnerSettings(user.id));
    }

    @Patch('partner/settings')
    @UseGuards(RolesGuard)
    @Roles(UserRole.INSURANCE_PARTNER)
    @ApiOperation({ summary: 'Save insurance partner settings' })
    async updatePartnerSettings(
        @CurrentUser() user: any,
        @Body() dto: UpdateInsurancePartnerSettingsDto,
    ) {
        return new StandardResponse(await this.insuranceService.updatePartnerSettings(user.id, dto));
    }

    @Post('partner/api-key/regenerate')
    @UseGuards(RolesGuard)
    @Roles(UserRole.INSURANCE_PARTNER)
    @ApiOperation({ summary: 'Regenerate insurance partner integration key' })
    async regenerateApiKey(@CurrentUser() user: any) {
        return new StandardResponse(await this.insuranceService.regenerateApiKey(user.id));
    }

    @Patch(':id/status')
    @UseGuards(RolesGuard)
    @Roles(UserRole.INSURANCE_PARTNER)
    @ApiOperation({ summary: 'Update insurance quote status' })
    @ApiParam({ name: 'id', description: 'Quote UUID' })
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateInsuranceStatusDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<InsuranceQuote>> {
        const partnerId = await this.insuranceService.getPartnerProfileId(user.id);
        if (!partnerId) {
            throw new ForbiddenException('Insurance partner profile is not configured or active');
        }

        return new StandardResponse(
            await this.insuranceService.updateStatus(id, partnerId, dto),
        );
    }
}
