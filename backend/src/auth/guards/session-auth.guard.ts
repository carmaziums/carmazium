import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';

/**
 * Read the `sub` claim of a JWT WITHOUT verifying it. Only used to notice that
 * the cookie and the Bearer token disagree about who is calling; whichever
 * identity is then trusted is always verified.
 */
function unverifiedSubject(token: string): string | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return typeof json?.sub === 'string' ? json.sub : null;
    } catch {
        return null;
    }
}

/**
 * Dual-mode authentication guard.
 * 1. Checks for a valid session cookie (req.session.userId) - preferred path.
 *    The cached user is re-read from the database every 30 s, so a ban or role
 *    change takes effect almost immediately.
 * 2. Falls back to verifying a Supabase Bearer token from the Authorization header.
 *    Bearer-only requests stay stateless: cross-site browsers can omit the sid
 *    cookie, so saving a new session on every GET creates thousands of rows.
 *    The explicit /auth/supabase-session login bridge remains responsible for
 *    intentionally creating a persistent session.
 *
 * When BOTH are present and name different users, the Bearer token wins for
 * this request: it is what this browser's current Supabase login proves,
 * whereas the cookie may be left over from a previous account. The cookie is
 * not rewritten here - the bridge call replaces it on the next sign-in.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
    constructor(private readonly authService: AuthService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();

        const authHeader = request.headers.authorization;
        const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

        // -- Path 1: Existing session cookie ------------------------------
        if (request.session?.userId) {
            const bearerSubject = bearer ? unverifiedSubject(bearer) : null;
            const cookieDisagrees =
                !!bearerSubject && bearerSubject !== request.session.userId;

            if (!cookieDisagrees) {
                let user = (request as any).user;
                if (!user) {
                    user = await this.authService.resolveSessionUser(request.session);
                    if (user) (request as any).user = user;
                }
                if (user) return true;
                // Deleted or banned user - drop the session; a valid Bearer
                // token may still rescue the request below.
                await new Promise<void>((resolve) => request.session.destroy(() => resolve()));
                if (!bearer) {
                    throw new UnauthorizedException('Session invalid - please log in again');
                }
            }
            // Cookie belongs to someone else (or is dead): use the verified
            // Bearer identity instead.
            (request as any).user = undefined;
        }

        // -- Path 2: Bearer token fallback --------------------------------
        if (bearer) {
            const user = await this.authService.verifySupabaseToken(bearer);

            if (user) {
                // Authenticate the request without modifying req.session.
                // express-session has saveUninitialized:false; creating
                // userId/userRole/cachedUser here would insert a new PostgreSQL
                // session for every request whose third-party cookie was blocked.
                (request as any).user = user;
                return true;
            }
        }

        throw new UnauthorizedException('Not authenticated - please log in');
    }
}
