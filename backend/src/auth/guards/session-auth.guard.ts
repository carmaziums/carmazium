import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Session-based authentication guard.
 * Checks that the request has a valid session with a userId.
 * Replaces the previous JwtAuthGuard (Passport-based).
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();

        if (!request.session?.userId) {
            throw new UnauthorizedException('Not authenticated — please log in');
        }

        return true;
    }
}
