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
import { FinanceApplication, UserRole } from '@prisma/client';
import { FinanceService } from './finance.service';
import { CreateFinanceApplicationDto } from './dto/create-finance-application.dto';
import { UpdateFinanceStatusDto } from './dto/update-finance-status.dto';
import { UpdateFinancePartnerSettingsDto } from './dto/update-partner-settings.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginatedResponse, StandardResponse } from '../listings/dto/response.dto';

@ApiTags('Finance')
@Controller('finance')
@ApiCookieAuth()
@UseGuards(SessionAuthGuard)
export class FinanceController {
    constructor(private readonly financeService: FinanceService) { }

    @Post('apply')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Submit finance application' })
    @ApiResponse({ status: 201, description: 'Application submitted' })
    async create(
        @Body() dto: CreateFinanceApplicationDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<FinanceApplication>> {
        const app = await this.financeService.create(user.id, dto);
        return new StandardResponse(app);
    }

    @Get('my')
    @ApiOperation({ summary: 'Get my finance applications' })
    async findMyApplications(
        @CurrentUser() user: any,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<PaginatedResponse<FinanceApplication>> {
        const result = await this.financeService.findMyApplications(
            user.id,
            Number(page),
            Number(limit),
        );
        // @ts-ignore
        return new PaginatedResponse(result.data, result.total, result.page, result.limit);
    }

    @Get('partner')
    @UseGuards(RolesGuard)
    @Roles(UserRole.FINANCE_PARTNER)
    @ApiOperation({ summary: 'Get finance partner applications' })
    async findPartnerApplications(
        @CurrentUser() user: any,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<PaginatedResponse<FinanceApplication>> {
        const partnerId = await this.financeService.getPartnerProfileId(user.id);
        if (!partnerId) {
            const safePage = Math.max(1, Number(page) || 1);
            const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
            return new PaginatedResponse([], 0, safePage, safeLimit);
        }

        const result = await this.financeService.findByPartner(
            partnerId,
            Number(page),
            Number(limit),
        );
        // @ts-ignore
        return new PaginatedResponse(result.data, result.total, result.page, result.limit);
    }

    @Get('partner/stats')
    @UseGuards(RolesGuard)
    @Roles(UserRole.FINANCE_PARTNER)
    @ApiOperation({ summary: 'Get finance partner statistics' })
    async getPartnerStats(@CurrentUser() user: any) {
        return new StandardResponse(await this.financeService.getPartnerStats(user.id));
    }

    @Get('partner/settings')
    @UseGuards(RolesGuard)
    @Roles(UserRole.FINANCE_PARTNER)
    @ApiOperation({ summary: 'Get finance partner settings' })
    async getPartnerSettings(@CurrentUser() user: any) {
        return new StandardResponse(await this.financeService.getPartnerSettings(user.id));
    }

    @Patch('partner/settings')
    @UseGuards(RolesGuard)
    @Roles(UserRole.FINANCE_PARTNER)
    @ApiOperation({ summary: 'Save finance partner settings' })
    async updatePartnerSettings(
        @CurrentUser() user: any,
        @Body() dto: UpdateFinancePartnerSettingsDto,
    ) {
        return new StandardResponse(await this.financeService.updatePartnerSettings(user.id, dto));
    }

    @Post('partner/api-key/regenerate')
    @UseGuards(RolesGuard)
    @Roles(UserRole.FINANCE_PARTNER)
    @ApiOperation({ summary: 'Regenerate finance partner integration key' })
    async regenerateApiKey(@CurrentUser() user: any) {
        return new StandardResponse(await this.financeService.regenerateApiKey(user.id));
    }

    @Patch(':id/status')
    @UseGuards(RolesGuard)
    @Roles(UserRole.FINANCE_PARTNER)
    @ApiOperation({ summary: 'Update finance application status' })
    @ApiParam({ name: 'id', description: 'Application UUID' })
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateFinanceStatusDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<FinanceApplication>> {
        const partnerId = await this.financeService.getPartnerProfileId(user.id);
        if (!partnerId) {
            throw new ForbiddenException('Finance partner profile is not configured or active');
        }

        return new StandardResponse(
            await this.financeService.updateStatus(id, partnerId, dto),
        );
    }
}
