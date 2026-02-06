import { Controller, Get, Post, Body, Patch, UseGuards, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post('sync')
    @ApiOperation({ summary: 'Sync Supabase user with local database' })
    async syncUser(@Body() body: {
        supabaseAuthId: string;
        email: string;
        firstName?: string;
        lastName?: string;
        role?: UserRole;
    }) {
        return this.usersService.syncSupabaseUser(body);
    }

    @Get('me')
    // @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    async getMe(@CurrentUser() user: any) {
        return this.usersService.getProfile(user.id);
    }

    @Post('elevate')
    // @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Request role elevation/switch' })
    async elevate(@CurrentUser() user: any, @Body('newRole') newRole: UserRole) {
        if (!newRole) throw new BadRequestException('New role is required');
        return this.usersService.requestRoleElevation(user.id, newRole);
    }

    @Patch('dealer-profile')
    // @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update dealer profile' })
    async updateDealer(@CurrentUser() user: any, @Body() body: any) {
        return this.usersService.updateDealerProfile(user.id, body);
    }
}
