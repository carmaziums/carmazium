import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
        private readonly authService: AuthService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request: any = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || !user.role || !user.id) {
            throw new ForbiddenException('User role not found or unauthorized');
        }

        let effectiveRole = user.role as UserRole;

        // Admin authorization must never rely solely on the session's cached
        // user object. Re-read the account so a demotion, lock or ban takes
        // effect immediately instead of leaving a stale seven-day admin role.
        if (effectiveRole === UserRole.ADMIN || requiredRoles.includes(UserRole.ADMIN)) {
            const fresh = await this.prisma.user.findUnique({
                where: { id: user.id },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    deletedAt: true,
                    lockoutUntil: true,
                },
            });

            if (!fresh || fresh.deletedAt) {
                request.session?.destroy?.(() => undefined);
                throw new ForbiddenException('Account is no longer authorized');
            }
            if (fresh.lockoutUntil && fresh.lockoutUntil > new Date()) {
                throw new ForbiddenException('Account is temporarily locked');
            }

            effectiveRole = fresh.role;
            request.user = { ...user, role: fresh.role };

            // Keep the session cache consistent so the next request does not
            // resurrect a role that has just changed in the database.
            if (request.session) {
                request.session.userRole = fresh.role;
                if (request.session.cachedUser) {
                    request.session.cachedUser = {
                        ...request.session.cachedUser,
                        role: fresh.role,
                    };
                }
            }

            // A state-changing action performed AS ADMIN additionally requires
            // a current Supabase Bearer token. Cross-site requests may carry a
            // SameSite=None session cookie, but they cannot read and attach the
            // user's Bearer token, so this acts as a step-up CSRF barrier for
            // every admin mutation without changing normal customer sessions.
            const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
            if (effectiveRole === UserRole.ADMIN && mutating) {
                const authHeader = request.headers?.authorization as string | undefined;
                if (!authHeader?.startsWith('Bearer ')) {
                    throw new UnauthorizedException('Admin action requires a current secure login');
                }

                const identity = await this.authService.getSupabaseIdentity(authHeader.slice(7));
                if (!identity || identity.email !== fresh.email.toLowerCase().trim()) {
                    throw new UnauthorizedException('Admin authentication is no longer valid');
                }
            }
        }

        if (!requiredRoles.includes(effectiveRole)) {
            throw new ForbiddenException('Insufficient permissions for this role');
        }

        return true;
    }
}
