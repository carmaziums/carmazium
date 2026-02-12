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
        ];

        if (excludedPaths.some(path => req.path.startsWith(path))) {
            return next();
        }

        // Require X-CSRF-Token header for all state-changing requests
        const csrfHeader = req.headers['x-csrf-token'];

        if (!csrfHeader) {
            throw new ForbiddenException('CSRF token missing (X-CSRF-Token header required)');
        }

        next();
    }

}
