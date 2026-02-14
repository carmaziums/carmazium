import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Query,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiCookieAuth,
    ApiQuery,
    ApiParam,
    ApiResponse,
} from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { CreateFinanceApplicationDto } from './dto/create-finance-application.dto';
import { UpdateFinanceStatusDto } from './dto/update-finance-status.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse, PaginatedResponse } from '../listings/dto/response.dto';
import { FinanceApplication } from '@prisma/client';

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
        const { data, total } = await this.financeService.findMyApplications(
            user.id,
            Number(page),
            Number(limit),
        );
        // @ts-ignore
        return new PaginatedResponse(data, total, Number(page), Number(limit));
    }

    @Get('partner')
    @ApiOperation({ summary: 'Get partner applications (for finance partners)' })
    async findPartnerApplications(
        @CurrentUser() user: any,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<PaginatedResponse<FinanceApplication>> {
        const partnerId = await this.financeService.getPartnerProfileId(user.id);

        if (!partnerId) {
            return new PaginatedResponse([], 0, Number(page), Number(limit));
        }

        const { data, total } = await this.financeService.findByPartner(
            partnerId,
            Number(page),
            Number(limit),
        );
        // @ts-ignore
        return new PaginatedResponse(data, total, Number(page), Number(limit));
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update application status (Partner only)' })
    @ApiParam({ name: 'id', description: 'Application UUID' })
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateFinanceStatusDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<FinanceApplication>> {
        const partnerId = await this.financeService.getPartnerProfileId(user.id);

        if (!partnerId) {
            throw new ForbiddenException('User is not a finance partner');
        }

        const app = await this.financeService.updateStatus(id, partnerId, dto);
        return new StandardResponse(app);
    }
}
