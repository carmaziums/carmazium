import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';

/**
 * Soft-auth variant of SessionAuthGuard — never throws. Populates req.user
 * when a valid session cookie or Bearer token is present, otherwise lets the
 * request through anonymously. Use on public endpoints that need to know
 * "is this viewer logged in?" (e.g. gating a seller's phone number) without
 * requiring authentication to view the resource at all.
 */
@Injectable()
export class OptionalSessionAuthGuard implements CanActivate {
    constructor(private readonly authService: AuthService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();

        try {
            if (request.session?.userId) {
                const user = await this.authService.validateSession(request.session.userId);
                if (user) {
                    (request as any).user = user;
                }
                return true;
            }

            const authHeader = request.headers.authorization;
            if (authHeader?.startsWith('Bearer ')) {
                const token = authHeader.slice(7);
                const user = await this.authService.verifySupabaseToken(token);
                if (user) {
                    (request as any).user = user;
                }
            }
        } catch {
            // Any auth resolution failure — proceed as anonymous rather than blocking
        }

        return true;
    }
}
