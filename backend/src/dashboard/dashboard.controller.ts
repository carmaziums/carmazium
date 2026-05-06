import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';
import { StandardResponse } from '../listings/dto/response.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(SessionAuthGuard)
@ApiCookieAuth()
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('unified')
    @ApiOperation({ summary: 'Get unified user dashboard data (Buyer + Seller)' })
    async getUnifiedDashboard(@CurrentUser() user: User) {
        const data = await this.dashboardService.getUnifiedDashboard(user.id);
        return new StandardResponse(data);
    }

    @Get('buyer')
    @ApiOperation({ summary: 'Get buyer dashboard data' })
    async getBuyerDashboard(@CurrentUser() user: User) {
        const data = await this.dashboardService.getBuyerDashboard(user.id);
        return new StandardResponse(data);
    }

    @Get('seller')
    @ApiOperation({ summary: 'Get seller dashboard data' })
    async getSellerDashboard(@CurrentUser() user: User) {
        const data = await this.dashboardService.getSellerDashboard(user.id);
        return new StandardResponse(data);
    }

    @Get('dealer')
    @ApiOperation({ summary: 'Get dealer dashboard data' })
    async getDealerDashboard(@CurrentUser() user: User) {
        if (user.role !== UserRole.DEALER && user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only dealers can access this dashboard');
        }
        const data = await this.dashboardService.getDealerDashboard(user.id);
        return new StandardResponse(data);
    }

    @Get('contractor')
    @ApiOperation({ summary: 'Get contractor dashboard data' })
    async getContractorDashboard(@CurrentUser() user: User) {
        if (user.role !== UserRole.CONTRACTOR && user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only contractors can access this dashboard');
        }
        const data = await this.dashboardService.getContractorDashboard(user.id);
        return new StandardResponse(data);
    }

    @Get('finance')
    @ApiOperation({ summary: 'Get finance partner dashboard data' })
    async getFinanceDashboard(@CurrentUser() user: User) {
        if (user.role !== UserRole.FINANCE_PARTNER && user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only finance partners can access this dashboard');
        }
        const data = await this.dashboardService.getFinanceDashboard(user.id);
        return new StandardResponse(data);
    }

    @Get('insurance')
    @ApiOperation({ summary: 'Get insurance partner dashboard data' })
    async getInsuranceDashboard(@CurrentUser() user: User) {
        if (user.role !== UserRole.INSURANCE_PARTNER && user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only insurance partners can access this dashboard');
        }
        const data = await this.dashboardService.getInsuranceDashboard(user.id);
        return new StandardResponse(data);
    }

    @Get('admin')
    @ApiOperation({ summary: 'Get admin dashboard data' })
    async getAdminDashboard(@CurrentUser() user: User) {
        if (user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only admins can access this dashboard');
        }
        const data = await this.dashboardService.getAdminDashboard();
        return new StandardResponse(data);
    }
}
