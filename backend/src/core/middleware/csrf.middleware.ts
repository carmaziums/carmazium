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

        // Require X-CSRF-Token header for all state-changing requests
        // In a cross-origin setup (Render/Vercel), custom headers are protected by CORS preflight.
        const csrfHeader = req.headers['x-csrf-token'];

        if (!csrfHeader) {
            throw new ForbiddenException('CSRF token missing (X-CSRF-Token header required)');
        }

        // In a full implementation, you would compare this against a token stored in the session/cookie.
        // For now, simple presence check + CORS restriction is a massive improvement.
        next();
    }
}
