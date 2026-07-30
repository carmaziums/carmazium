import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const method = req.method;

        // Skip GET, HEAD, OPTIONS
        if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            return next();
        }

        // Exclude entry-point routes that don't have a session/token yet
        const excludedPaths = [
            '/api/users/sync',
            '/users/sync',
            '/api/auth/login',
            '/auth/login',
            '/api/auth/register',
            '/auth/register',
            '/api/auth/supabase-session',
            '/auth/supabase-session',
            '/api/auth/send-verification',
            '/auth/send-verification',
            '/ai/search',
            '/ai/chat',
            '/ai/generate-description',
            '/damage/analyze',
            '/payments/hpi-checkout',
            '/payments/listing-checkout',
            '/payments/checkout',
            '/pricing/estimate',
            '/analytics/event',
            '/analytics/email',
            '/payments/webhook',
        ];
        const fullPath = req.originalUrl?.split('?')[0] ?? req.path;

        if (excludedPaths.some(path => 
            req.path.startsWith(path) || 
            fullPath.endsWith(path) ||
            fullPath.includes(path)
        )) {
            // console.log(`[CsrfMiddleware] Skipping CSRF for excluded path: ${req.path}`);
            return next();
        }

        // Skip CSRF when request is already authenticated (session or Bearer).
        // API routes protected by SessionAuthGuard are not vulnerable to cross-site
        // form POSTs because the browser does not send the session cookie or
        // Authorization header from another origin.
        if (req.session?.userId) {
            return next();
        }
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            return next();
        }

        // Require X-CSRF-Token header for all state-changing requests
        const csrfHeader = req.headers['x-csrf-token'];

        if (!csrfHeader) {
            console.error(`[CsrfMiddleware] Blocked request: ${method} ${req.originalUrl} - Missing X-CSRF-Token`);
            throw new ForbiddenException('CSRF token missing (X-CSRF-Token header required)');
        }

        next();
    }

}
