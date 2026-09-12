import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Delete,
    Req,
    Res,
    Headers,
    UseGuards,
    BadRequestException,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
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
    constructor(
        private readonly usersService: UsersService,
        private readonly authService: AuthService,
    ) { }

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
            postcode?: string;
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

        // `newRole` arrives as an untyped body field — the TS annotation proves
        // nothing at runtime. Reject anything that isn't a real enum member here
        // so a malformed value can never reach the query layer.
        if (!Object.values(UserRole).includes(newRole)) {
            throw new BadRequestException('Unknown role');
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
     * Sync a freshly-authenticated Supabase user into the local database on
     * signup / first login.
     *
     * IDENTITY COMES FROM THE TOKEN, NOT THE BODY. This endpoint used to be
     * unauthenticated and read the id, email and role straight from the request
     * body, so anyone could POST `{ email: <someone>, role: 'DEALER' }` and
     * flip an existing account's role — or mint an ADMIN — with no credentials
     * at all. It now requires the caller's Supabase access token, verifies it,
     * and takes the user id and email from the verified token. The body may
     * only supply cosmetic fields (name) and a requested role, and that role is
     * constrained and applied on creation only (see syncUser). A mismatch
     * between the token's email and the body's email is refused outright.
     */
    @Post('sync')
    @ApiOperation({ summary: 'Sync the authenticated Supabase user into the local DB' })
    async sync(@Body() body: any, @Headers('authorization') authHeader?: string) {
        if (!body?.email) {
            throw new BadRequestException('Email is required for sync');
        }

        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const identity = token ? await this.authService.getSupabaseIdentity(token) : null;
        if (!identity) {
            throw new UnauthorizedException('A valid Supabase session is required to sync.');
        }

        // The token proves who the caller is. If the body claims to be a
        // different account, refuse rather than trusting the body.
        if (identity.email !== String(body.email).toLowerCase().trim()) {
            throw new ForbiddenException('Sync email does not match the authenticated session.');
        }

        const { user, isNewUser } = await this.usersService.syncUser({
            id: identity.id,
            email: identity.email,
            firstName: body.firstName,
            lastName: body.lastName,
            role: body.role,
        });
        return {
            success: true,
            data: user,
            // Drives the one-time signup conversion on the frontend — see
            // src/app/auth/callback/page.tsx. Deliberately outside `data` so
            // the existing user-shaped payload is untouched.
            isNewUser,
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
        try {
            return {
                success: true,
                data: await this.usersService.createConnectOnboardingLink(user.id, returnUrl, refreshUrl),
            };
        } catch (err: any) {
            throw new BadRequestException(
                err?.message || 'Failed to start Stripe Connect onboarding. Please try again.',
            );
        }
    }

    /**
     * Save bank account details for manual payout fallback.
     */
    @Patch('me/bank-details')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Update bank account details for manual payout' })
    async updateBankDetails(
        @CurrentUser() user: any,
        @Body() body: {
            bankAccountName?: string;
            bankSortCode?: string;
            bankAccountNumber?: string;
            payoutPreference?: string;
        },
    ) {
        return {
            success: true,
            data: await this.usersService.updateBankDetails(user.id, body),
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

    /**
     * Permanently deletes (soft-delete + anonymize) the current user's
     * account. Requires the user to have typed the literal word "DELETE" as
     * a deliberate-action confirmation, then destroys their session.
     */
    @Delete('me')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Delete (anonymize) the current user account' })
    async deleteMe(
        @CurrentUser() user: any,
        @Body('confirmation') confirmation: string,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        if (confirmation?.trim().toUpperCase() !== 'DELETE') {
            throw new BadRequestException('Type DELETE to confirm — this cannot be undone.');
        }

        await this.usersService.deleteAccount(user.id);

        return new Promise<{ success: boolean }>((resolve, reject) => {
            if (!req.session) {
                res.clearCookie('sid');
                resolve({ success: true });
                return;
            }
            req.session.destroy((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                res.clearCookie('sid');
                resolve({ success: true });
            });
        });
    }
}
