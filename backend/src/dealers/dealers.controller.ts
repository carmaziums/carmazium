import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiCookieAuth,
} from '@nestjs/swagger';
import { DealersService } from './dealers.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { CreateKycDto } from './dto/create-kyc.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse, PaginatedResponse } from '../listings/dto/response.dto';

@ApiTags('Dealers')
@Controller('dealers')
@UseGuards(SessionAuthGuard)
@ApiCookieAuth()
export class DealersController {
    constructor(private readonly dealersService: DealersService) {}

    // ─── Dashboard Stats ────────────────────────────────────────────

    @Get('stats')
    @ApiOperation({ summary: 'Get dealer dashboard KPIs' })
    @ApiResponse({ status: 200, description: 'Dashboard statistics' })
    async getStats(@CurrentUser() user: any): Promise<StandardResponse<any>> {
        const stats = await this.dealersService.getStats(user.id);
        return new StandardResponse(stats);
    }

    // ─── Analytics ───────────────────────────────────────────────────

    @Get('analytics')
    @ApiOperation({ summary: 'Get dealer analytics data with charts and trends' })
    @ApiQuery({ name: 'range', required: false, description: 'Date range preset', example: '30d', enum: ['7d', '30d', '90d', 'custom'] })
    @ApiQuery({ name: 'from', required: false, description: 'Custom range start (YYYY-MM-DD)', example: '2026-01-01' })
    @ApiQuery({ name: 'to', required: false, description: 'Custom range end (YYYY-MM-DD)', example: '2026-05-12' })
    @ApiResponse({ status: 200, description: 'Analytics data with KPIs, trends, funnels, and charts' })
    async getAnalytics(
        @CurrentUser() user: any,
        @Query('range') range?: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ): Promise<StandardResponse<any>> {
        const data = await this.dealersService.getAnalytics(user.id, range || '30d', from, to);
        return new StandardResponse(data);
    }

    // ─── Leads (CRM) ───────────────────────────────────────────────

    @Get('leads')
    @ApiOperation({ summary: 'List all leads for the dealership' })
    @ApiQuery({ name: 'status', required: false, description: 'Filter by lead status', example: 'NEW' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
    async getLeads(
        @CurrentUser() user: any,
        @Query('status') status?: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    ): Promise<PaginatedResponse<any>> {
        const { data, total } = await this.dealersService.getLeads(user.id, status, page, limit);
        return new PaginatedResponse(data, total, page!, limit!);
    }

    @Post('leads')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new lead' })
    @ApiResponse({ status: 201, description: 'Lead created' })
    async createLead(
        @CurrentUser() user: any,
        @Body() dto: CreateLeadDto,
    ): Promise<StandardResponse<any>> {
        const lead = await this.dealersService.createLead(user.id, dto);
        return new StandardResponse(lead);
    }

    @Patch('leads/:id')
    @ApiOperation({ summary: 'Update lead status or assignment' })
    @ApiParam({ name: 'id', description: 'Lead ID' })
    async updateLead(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: UpdateLeadDto,
    ): Promise<StandardResponse<any>> {
        const lead = await this.dealersService.updateLead(user.id, id, dto);
        return new StandardResponse(lead);
    }

    // ─── Staff (RBAC) ───────────────────────────────────────────────

    @Get('staff')
    @ApiOperation({ summary: 'List dealership staff members' })
    async getStaff(@CurrentUser() user: any): Promise<StandardResponse<any>> {
        const staff = await this.dealersService.getStaff(user.id);
        return new StandardResponse(staff);
    }

    @Post('staff')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Invite a staff member to the dealership' })
    @ApiResponse({ status: 201, description: 'Staff member invited' })
    async inviteStaff(
        @CurrentUser() user: any,
        @Body() dto: InviteStaffDto,
    ): Promise<StandardResponse<any>> {
        const staff = await this.dealersService.inviteStaff(user.id, dto);
        return new StandardResponse(staff);
    }

    @Delete('staff/:id')
    @ApiOperation({ summary: 'Remove a staff member (deactivate)' })
    @ApiParam({ name: 'id', description: 'DealerStaff record ID' })
    async removeStaff(
        @CurrentUser() user: any,
        @Param('id') id: string,
    ): Promise<StandardResponse<any>> {
        const result = await this.dealersService.removeStaff(user.id, id);
        return new StandardResponse(result);
    }

    // ─── KYC (Business Verification) ───────────────────────────────

    @Get('kyc')
    @ApiOperation({ summary: 'Get current dealer KYC status and document statuses' })
    @ApiResponse({ status: 200, description: 'KYC data' })
    async getKyc(@CurrentUser() user: any): Promise<StandardResponse<any>> {
        const kyc = await this.dealersService.getKyc(user.id);
        return new StandardResponse(kyc);
    }

    @Post('kyc')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Submit or update dealer KYC business documents' })
    @ApiResponse({ status: 200, description: 'KYC application submitted' })
    async submitKyc(
        @CurrentUser() user: any,
        @Body() dto: CreateKycDto,
    ): Promise<StandardResponse<any>> {
        const kyc = await this.dealersService.submitKyc(user.id, dto);
        return new StandardResponse(kyc);
    }
}

