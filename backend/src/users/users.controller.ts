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
import {
    StartAddressVerificationDto,
    ConfirmAddressVerificationDto,
} from './dto/address-verification.dto';

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
     * Start address verification — emails a one-time code to the user.
     */
    @Post('me/address-verification/start')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Start address verification by emailing a one-time code' })
    async startAddressVerification(
        @CurrentUser() user: any,
        @Body() dto: StartAddressVerificationDto,
    ) {
        return {
            success: true,
            data: await this.usersService.startAddressVerification(user.id, dto.address),
        };
    }

    /**
     * Confirm address verification using the emailed one-time code.
     */
    @Post('me/address-verification/confirm')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Confirm address verification with a one-time code' })
    async confirmAddressVerification(
        @CurrentUser() user: any,
        @Body() dto: ConfirmAddressVerificationDto,
    ) {
        return {
            success: true,
            data: await this.usersService.confirmAddressVerification(user.id, dto.code),
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

    /**
     * Create (or re-open) a Stripe Connect Express onboarding session.
     * Returns a one-time URL that redirects the user through Stripe's hosted onboarding flow.
     */
    @Post('stripe-connect/onboard')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Start Stripe Connect Express onboarding' })
    async stripeConnectOnboard(
        @CurrentUser() user: any,
        @Body('returnUrl') returnUrl: string,
        @Body('refreshUrl') refreshUrl: string,
    ) {
        if (!returnUrl || !refreshUrl) {
            throw new BadRequestException('returnUrl and refreshUrl are required');
        }
        return {
            success: true,
            data: await this.usersService.createConnectOnboardingLink(user.id, returnUrl, refreshUrl),
        };
    }

    /**
     * Return the current Stripe Connect status for the authenticated user.
     */
    @Get('stripe-connect/status')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Get Stripe Connect onboarding status' })
    async stripeConnectStatus(@CurrentUser() user: any) {
        return {
            success: true,
            data: await this.usersService.getConnectStatus(user.id),
        };
    }
}
