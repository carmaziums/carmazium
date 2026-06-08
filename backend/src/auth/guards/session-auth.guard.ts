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
 *    On success, auto-creates a session so future requests use the cookie path.
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
                // Auto-create session for subsequent requests
                if (request.session) {
                    request.session.userId = user.id;
                    request.session.userRole = user.role;
                    // Keep cachedUser in lockstep with userId/userRole — main.ts's
                    // hydration middleware trusts cachedUser blindly on later
                    // requests. Leaving it unset here let a stale cachedUser from
                    // a previous occupant of this session record (wrong profile,
                    // wrong role) survive and be served back to this user.
                    request.session.cachedUser = user;
                }
                // Populate req.user so @CurrentUser() works immediately
                (request as any).user = user;
                return true;
            }
        }

        throw new UnauthorizedException('Not authenticated — please log in');
    }
}
