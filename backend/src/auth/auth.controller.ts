import {
    Controller,
    Post,
    Get,
    Body,
    Req,
    Res,
    HttpCode,
    HttpStatus,
    UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { resolveFrontendUrl } from '../core/frontend-url';
import { ABSOLUTE_SESSION_LIFETIME_MS, remainingSessionLifetimeMs, sessionIdFromVerifiedJwt } from './session-lifetime';

// Per-IP limits (global default 100/min is far too generous for credential endpoints).
@UseGuards(ThrottlerGuard)
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    /**
     * Register a new user account.
     * Creates the user and auto-logs them in by setting the session.
     */
    @Post('register')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @ApiOperation({ summary: 'Register a new user account' })
    @ApiResponse({ status: 201, description: 'Account created and logged in' })
    @ApiResponse({ status: 409, description: 'Email already in use' })
    async register(
        @Body() registerDto: RegisterDto,
        @Req() req: Request,
    ) {
        const user = await this.authService.register(registerDto);

        // Auto-login: set session immediately after registration
        if (req.session) {
            req.session.userId = user.id;
            req.session.userRole = user.role;
            req.session.cachedUser = user;
            (req.session as any).authenticatedAt = Date.now();
            req.session.cookie.maxAge = ABSOLUTE_SESSION_LIFETIME_MS;
        }

        return {
            success: true,
            message: 'Account created successfully',
            data: user,
        };
    }

    /**
     * Log in with email and password.
     * Creates a server-side session and sets a cookie.
     */
    @Post('login')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Log in with email and password' })
    @ApiResponse({ status: 200, description: 'Logged in successfully' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(
        @Body() loginDto: LoginDto,
        @Req() req: Request,
    ) {
        const user = await this.authService.login(loginDto);

        // Set session data
        if (req.session) {
            req.session.userId = user.id;
            req.session.userRole = user.role;
            req.session.cachedUser = user;
            (req.session as any).authenticatedAt = Date.now();
            req.session.cookie.maxAge = ABSOLUTE_SESSION_LIFETIME_MS;
        }

        return {
            success: true,
            message: 'Logged in successfully',
            data: user,
        };
    }

    /**
     * Log out the current user.
     * Destroys the server-side session and clears the cookie.
     */
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Log out current user' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        return new Promise<{ success: boolean; message: string }>((resolve, reject) => {
            if (!req.session) {
                res.clearCookie('sid');
                resolve({ success: true, message: 'Logged out successfully' });
                return;
            }
            req.session.destroy((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                res.clearCookie('sid');
                resolve({ success: true, message: 'Logged out successfully' });
            });
        });
    }

    /**
     * Get the currently authenticated user's profile.
     * Requires an active session.
     */
    @Get('me')
    @UseGuards(SessionAuthGuard)
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Current user data' })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    async getMe(@CurrentUser() user: any) {
        return {
            success: true,
            data: user,
        };
    }

    /**
     * Bridge endpoint: Accept a Supabase JWT and create a backend session.
     * The frontend calls this after Supabase login/signup so that all
     * subsequent requests are authenticated via the session cookie.
     */
    @Post('supabase-session')
    @Throttle({ default: { limit: 30, ttl: 60_000 } })
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Create backend session from Supabase JWT' })
    @ApiResponse({ status: 200, description: 'Session created' })
    @ApiResponse({ status: 401, description: 'Invalid or expired token' })
    async createSupabaseSession(
        @Body('token') token: string,
        @Req() req: Request,
    ) {
        if (!token) {
            throw new UnauthorizedException('Supabase token is required');
        }

        const user = await this.authService.verifySupabaseToken(token);

        if (!user) {
            throw new UnauthorizedException('Invalid Supabase token or user not found in backend');
        }

        // auth.getUser() has already verified the supplied JWT. session_id is
        // stable across refreshes and changes only on a genuinely new login.
        const supabaseSessionId = sessionIdFromVerifiedJwt(token);
        if (!supabaseSessionId) {
            throw new UnauthorizedException('Please sign in again to establish a valid session');
        }

        const stored = req.session as any;
        const sameSupabaseSession = stored?.userId === user.id
            && stored?.supabaseSessionId === supabaseSessionId;

        // Re-bridging the SAME refreshed Supabase session must never turn an
        // expired 24h login into a new 24h login. This is crucial on desktop
        // reload and mobile background/foreground transitions.
        if (sameSupabaseSession && remainingSessionLifetimeMs(stored.authenticatedAt) === 0) {
            throw new UnauthorizedException('SESSION_EXPIRED_24H');
        }

        // Switching account or starting a genuinely new Supabase session
        // rotates the cookie id, even when the account id is unchanged.
        if (req.session?.userId && !sameSupabaseSession && stored?.supabaseSessionId) {
            await new Promise<void>((resolve, reject) =>
                req.session.regenerate((err) => err ? reject(err) : resolve()),
            );
        } else if (req.session?.userId && req.session.userId !== user.id) {
            await new Promise<void>((resolve, reject) =>
                req.session.regenerate((err) => err ? reject(err) : resolve()),
            );
        }

        if (req.session) {
            const now = Date.now();
            const authenticatedAt = sameSupabaseSession
                ? (stored.authenticatedAt as number)
                : now;
            req.session.userId = user.id;
            req.session.userRole = user.role;
            req.session.cachedUser = user;
            (req.session as any).supabaseSessionId = supabaseSessionId;
            (req.session as any).authenticatedAt = authenticatedAt;
            req.session.cookie.maxAge = remainingSessionLifetimeMs(authenticatedAt, now);
        }

        return {
            success: true,
            message: 'Backend session created',
            data: user,
        };
    }

    /**
     * Reset password for authenticated user.
     */
    @Post('reset-password')
    @UseGuards(SessionAuthGuard)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reset authenticated user password' })
    @ApiResponse({ status: 200, description: 'Password reset successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async resetPassword(
        @CurrentUser() user: any,
        @Body() resetPasswordDto: ResetPasswordDto,
    ) {
        return await this.authService.resetPassword(user.id, resetPasswordDto);
    }

    /**
     * Send/resend a verification email through our own mailer (bypasses
     * Supabase's rate-limited built-in one). Safe to call multiple times.
     */
    @Post('send-verification')
    @Throttle({ default: { limit: 3, ttl: 60_000 } })
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Send verification email' })
    @ApiResponse({ status: 200, description: 'Verification email sent' })
    async sendVerification(
        @Body('email') email: string,
        @Body('redirectTo') redirectTo: string,
    ) {
        if (!email) throw new UnauthorizedException('Email is required');
        const safeRedirect = redirectTo || `${resolveFrontendUrl(process.env.FRONTEND_URL)}/auth/callback?redirect_to=/auth/onboarding`;
        await this.authService.sendVerificationEmail(email, safeRedirect);
        return { success: true, message: 'Verification email sent' };
    }
}
