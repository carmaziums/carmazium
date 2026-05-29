import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Req,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    /**
     * Get current authenticated user's profile.
     */
    @Get('me')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    async getMe(@CurrentUser() user: any) {
        return {
            success: true,
            data: await this.usersService.getProfile(user.id),
        };
    }

    /**
     * Update current user's basic profile fields.
     */
    @Patch('me')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Update current user profile' })
    async updateMe(
        @CurrentUser() user: any,
        @Req() req: any,
        @Body()
        body: {
            firstName?: string;
            lastName?: string;
            phone?: string;
            profileImage?: string;
            location?: string;
            preferences?: Record<string, any>;
        },
    ) {
        const updated = await this.usersService.updateProfile(user.id, body);
        // Keep session cache in sync so middleware doesn't serve stale profile data
        if (req.session?.cachedUser) {
            req.session.cachedUser = { ...req.session.cachedUser, ...updated };
        }
        return { success: true, data: updated };
    }

    /**
     * Request a role elevation or switch.
     */
    @Post('elevate')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Request role elevation/switch' })
    async elevate(
        @CurrentUser() user: any,
        @Body('newRole') newRole: UserRole,
    ) {
        if (!newRole) {
            throw new BadRequestException('New role is required');
        }

        return {
            success: true,
            data: await this.usersService.requestRoleElevation(user.id, newRole),
        };
    }

    /**
     * Update dealer profile for the current user.
     */
    @Patch('dealer-profile')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Update dealer profile' })
    async updateDealer(@CurrentUser() user: any, @Body() body: any) {
        return {
            success: true,
            data: await this.usersService.updateDealerProfile(user.id, body),
        };
    }

    /**
     * Sync endpoint for frontend onboarding.
     */
    @Post('sync')
    @ApiOperation({ summary: 'Sync user from Supabase' })
    async sync(@Body() body: any) {
        if (!body.email) {
            throw new BadRequestException('Email is required for sync');
        }

        const user = await this.usersService.syncUser(body);
        return {
            success: true,
            data: user,
        };
    }
}
