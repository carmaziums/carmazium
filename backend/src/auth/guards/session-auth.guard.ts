import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';

/**
 * Dual-mode authentication guard.
 * 1. Checks for a valid session cookie (req.session.userId) — preferred path.
 * 2. Falls back to verifying a Supabase Bearer token from the Authorization header.
 *    Bearer-only requests stay stateless: cross-site browsers can omit the sid
 *    cookie, so saving a new session on every GET creates thousands of rows.
 *    The explicit /auth/supabase-session login bridge remains responsible for
 *    intentionally creating a persistent session.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
    constructor(private readonly authService: AuthService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();

        // ── Path 1: Existing session cookie ──────────────────────────
        if (request.session?.userId) {
            // Ensure req.user is set (hydration middleware may run after Nest in some setups)
            if (!(request as any).user) {
                const user = await this.authService.validateSession(request.session.userId);
                if (!user) {
                    throw new UnauthorizedException('Session invalid — please log in again');
                }
                (request as any).user = user;
            }
            return true;
        }

        // ── Path 2: Bearer token fallback ────────────────────────────
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            const user = await this.authService.verifySupabaseToken(token);

            if (user) {
                // Authenticate the request without modifying req.session.
                // express-session has saveUninitialized:false; creating
                // userId/userRole/cachedUser here would insert a new PostgreSQL
                // session for every request whose third-party cookie was blocked.
                // A deliberate login bridge creates cookies separately.
                (request as any).user = user;
                return true;
            }
        }

        throw new UnauthorizedException('Not authenticated — please log in');
    }
}
