import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function makeContext(request: any): any {
    return {
        getHandler: () => function handler() {},
        getClass: () => class Controller {},
        switchToHttp: () => ({ getRequest: () => request }),
    };
}

describe('RolesGuard admin hardening', () => {
    const admin = {
        id: 'admin-1',
        email: 'admin@carmazium.com',
        role: UserRole.ADMIN,
        deletedAt: null,
        lockoutUntil: null,
    };

    const createGuard = (freshUser: any = admin, identity: any = { id: 'auth-1', email: admin.email }) => {
        const reflector = {
            getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
        } as any;
        const prisma = {
            user: { findUnique: jest.fn().mockResolvedValue(freshUser) },
        } as any;
        const authService = {
            getSupabaseIdentity: jest.fn().mockResolvedValue(identity),
        } as any;
        return { guard: new RolesGuard(reflector, prisma, authService), prisma, authService };
    };

    it('allows an admin GET after re-reading the role from the database', async () => {
        const { guard, prisma, authService } = createGuard();
        const request = {
            method: 'GET',
            headers: {},
            user: { ...admin },
            session: { userRole: UserRole.ADMIN, cachedUser: { ...admin } },
        };

        await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
        expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: admin.id } }));
        expect(authService.getSupabaseIdentity).not.toHaveBeenCalled();
    });

    it('requires a current bearer token for state-changing admin actions', async () => {
        const { guard } = createGuard();
        const request = {
            method: 'POST',
            headers: {},
            user: { ...admin },
            session: { userRole: UserRole.ADMIN, cachedUser: { ...admin } },
        };

        await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('allows an admin mutation when the bearer identity matches the fresh admin account', async () => {
        const { guard, authService } = createGuard();
        const request = {
            method: 'PATCH',
            headers: { authorization: 'Bearer valid-token' },
            user: { ...admin },
            session: { userRole: UserRole.ADMIN, cachedUser: { ...admin } },
        };

        await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
        expect(authService.getSupabaseIdentity).toHaveBeenCalledWith('valid-token');
    });

    it('rejects a stale admin session immediately after the account is demoted', async () => {
        const demoted = { ...admin, role: UserRole.DEALER };
        const { guard } = createGuard(demoted);
        const request = {
            method: 'GET',
            headers: {},
            user: { ...admin },
            session: { userRole: UserRole.ADMIN, cachedUser: { ...admin } },
        };

        await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(ForbiddenException);
        expect(request.session.userRole).toBe(UserRole.DEALER);
        expect(request.session.cachedUser.role).toBe(UserRole.DEALER);
    });

    it('rejects a locked admin account even if the session still says ADMIN', async () => {
        const locked = { ...admin, lockoutUntil: new Date(Date.now() + 60_000) };
        const { guard } = createGuard(locked);
        const request = {
            method: 'GET',
            headers: {},
            user: { ...admin },
            session: { userRole: UserRole.ADMIN, cachedUser: { ...admin } },
        };

        await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(ForbiddenException);
    });
});
