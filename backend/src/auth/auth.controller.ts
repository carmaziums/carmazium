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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    /**
     * Register a new user account.
     * Creates the user and auto-logs them in by setting the session.
     */
    @Post('register')
    @ApiOperation({ summary: 'Register a new user account' })
    @ApiResponse({ status: 201, description: 'Account created and logged in' })
    @ApiResponse({ status: 409, description: 'Email already in use' })
    async register(
        @Body() registerDto: RegisterDto,
        @Req() req: Request,
    ) {
        const user = await this.authService.register(registerDto);

        // Auto-login: set session immediately after registration
        req.session.userId = user.id;
        req.session.userRole = user.role;

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
        req.session.userId = user.id;
        req.session.userRole = user.role;

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

        // Create the backend session
        req.session.userId = user.id;
        req.session.userRole = user.role;

        return {
            success: true,
            message: 'Backend session created',
            data: user,
        };
    }
}
