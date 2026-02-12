import {
    Controller,
    Get,
    Patch,
    Delete,
    Param,
    Query,
    Body,
    UseGuards,
    SetMetadata,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiCookieAuth,
    ApiQuery,
    ApiParam,
    ApiResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { StandardResponse, PaginatedResponse } from '../listings/dto/response.dto';

@ApiTags('Admin')
@Controller('admin')
@ApiCookieAuth()
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('users')
    @ApiOperation({ summary: 'List all users' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    async getAllUsers(
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<PaginatedResponse<any>> {
        const { data, total } = await this.adminService.getAllUsers(Number(page), Number(limit));
        return new PaginatedResponse(data, total, Number(page), Number(limit));
    }

    @Patch('users/:id/role')
    @ApiOperation({ summary: 'Update user role' })
    @ApiParam({ name: 'id', description: 'User UUID' })
    async updateUserRole(
        @Param('id') id: string,
        @Body('role') role: UserRole,
    ): Promise<StandardResponse<any>> {
        const user = await this.adminService.updateUserRole(id, role);
        return new StandardResponse(user);
    }

    @Patch('users/:id/verify')
    @ApiOperation({ summary: 'Verify user (email/dealer)' })
    @ApiParam({ name: 'id', description: 'User UUID' })
    async verifyUser(
        @Param('id') id: string,
        @Body('isVerified') isVerified: boolean,
    ): Promise<StandardResponse<any>> {
        const user = await this.adminService.verifyUser(id, isVerified);
        return new StandardResponse(user);
    }

    @Get('listings')
    @ApiOperation({ summary: 'List all listings (including drafts/deleted)' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    async getAllListings(
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<PaginatedResponse<any>> {
        const { data, total } = await this.adminService.getAllListings(Number(page), Number(limit));
        return new PaginatedResponse(data, total, Number(page), Number(limit));
    }

    @Delete('listings/:id')
    @ApiOperation({ summary: 'Force delete a listing' })
    @ApiParam({ name: 'id', description: 'Listing UUID' })
    async deleteListing(@Param('id') id: string): Promise<StandardResponse<any>> {
        const listing = await this.adminService.deleteListing(id);
        return new StandardResponse(listing);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get platform stats' })
    async getPlatformStats(): Promise<StandardResponse<any>> {
        const stats = await this.adminService.getPlatformStats();
        return new StandardResponse(stats);
    }
}
