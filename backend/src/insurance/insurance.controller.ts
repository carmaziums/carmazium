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
import { InsuranceService } from './insurance.service';
import { CreateInsuranceQuoteDto } from './dto/create-insurance-quote.dto';
import { UpdateInsuranceStatusDto } from './dto/update-insurance-status.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse, PaginatedResponse } from '../listings/dto/response.dto';
import { InsuranceQuote } from '@prisma/client';

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
        const { data, total } = await this.insuranceService.findMyQuotes(
            user.id,
            Number(page),
            Number(limit),
        );
        // @ts-ignore
        return new PaginatedResponse(data, total, Number(page), Number(limit));
    }

    @Get('partner')
    @ApiOperation({ summary: 'Get partner quotes (for insurance partners)' })
    async findPartnerQuotes(
        @CurrentUser() user: any,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<PaginatedResponse<InsuranceQuote>> {
        const partnerId = await this.insuranceService.getPartnerProfileId(user.id);

        if (!partnerId) {
            return new PaginatedResponse([], 0, Number(page), Number(limit));
        }

        const { data, total } = await this.insuranceService.findByPartner(
            partnerId,
            Number(page),
            Number(limit),
        );
        // @ts-ignore
        return new PaginatedResponse(data, total, Number(page), Number(limit));
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update quote status (Partner only)' })
    @ApiParam({ name: 'id', description: 'Quote UUID' })
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateInsuranceStatusDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<InsuranceQuote>> {
        const partnerId = await this.insuranceService.getPartnerProfileId(user.id);

        if (!partnerId) {
            throw new ForbiddenException('User is not an insurance partner');
        }

        const quote = await this.insuranceService.updateStatus(id, partnerId, dto);
        return new StandardResponse(quote);
    }
}
