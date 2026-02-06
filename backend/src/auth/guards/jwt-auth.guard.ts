import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        if (err || !user) {
            console.error('JwtAuthGuard Failure Details:', {
                error: err,
                infoMessage: info?.message,
                infoAll: info,
                hasUser: !!user,
                url: context.switchToHttp().getRequest().url
            });
            throw err || new UnauthorizedException(info?.message || 'Unauthorized');
        }
        return user;
    }
}
