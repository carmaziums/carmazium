import { UnauthorizedException } from '@nestjs/common';
import { SessionAuthGuard } from './session-auth.guard';

function contextFor(request: any): any {
    return { switchToHttp: () => ({ getRequest: () => request }) };
}

describe('Issue #553 block 1: bearer-only authentication does not persist phantom sessions', () => {
    const verifiedUser = { id: 'user-1', role: 'DEALER', email: 'user@example.test' };

    const createGuard = () => {
        const authService = {
            verifySupabaseToken: jest.fn().mockResolvedValue(verifiedUser),
            validateSession: jest.fn().mockResolvedValue(verifiedUser),
        };
        return { guard: new SessionAuthGuard(authService as any), authService };
    };

    it('does not mutate express-session for a bearer-only request (saveUninitialized=false)', async () => {
        const { guard, authService } = createGuard();
        const request: any = {
            method: 'GET',
            headers: { authorization: 'Bearer verified-token' },
            session: { cookie: { originalMaxAge: 604800000 } },
        };
        const originalSession = structuredClone(request.session);
        await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
        expect(request.user).toEqual(verifiedUser);
        expect(request.session).toEqual(originalSession);
        expect(authService.verifySupabaseToken).toHaveBeenCalledWith('verified-token');
        expect(authService.validateSession).not.toHaveBeenCalled();
    });

    it('does not generate stored sessions for ten independent bearer-only GET requests', async () => {
        const { guard, authService } = createGuard();
        for (let i = 0; i < 10; i++) {
            const request: any = {
                method: 'GET',
                headers: { authorization: 'Bearer verified-token' },
                session: { cookie: { maxAge: 604800000 } },
            };
            await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
            expect(request.session).toEqual({ cookie: { maxAge: 604800000 } });
            expect(request.user?.id).toEqual('user-1');
        }
        expect(authService.verifySupabaseToken).toHaveBeenCalledTimes(10);
    });

    it('continues to authenticate authorized mutations without creating a new cookie', async () => {
        const { guard } = createGuard();
        const request: any = {
            method: 'PATCH',
            headers: { authorization: 'Bearer verified-token' },
            session: { cookie: {} },
        };
        await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
        expect(request.user).toEqual(verifiedUser);
        expect(request.session).toEqual({ cookie: {} });
    });

    it('preserves an existing cookie-backed session without changing identity', async () => {
        const { guard, authService } = createGuard();
        const request: any = {
            method: 'GET',
            headers: {},
            session: { userId: verifiedUser.id, userRole: verifiedUser.role, cachedUser: verifiedUser },
            user: verifiedUser,
        };
        await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
        expect(request.session.userId).toEqual(verifiedUser.id);
        expect(authService.verifySupabaseToken).not.toHaveBeenCalled();
    });

    it('rejects invalid Bearer tokens instead of trusting a modified request session', async () => {
        const { guard, authService } = createGuard();
        authService.verifySupabaseToken.mockResolvedValueOnce(null);
        const request: any = { method: 'GET', headers: { authorization: 'Bearer invalid' }, session: { cookie: {} } };
        await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(UnauthorizedException);
        expect(request.session).toEqual({ cookie: {} });
        expect(request.user).toBeUndefined();
    });

    it('rejects requests without Bearer or existing cookie credentials', async () => {
        const { guard, authService } = createGuard();
        await expect(guard.canActivate(contextFor({
            method: 'GET', headers: {}, session: { cookie: {} },
        }))).rejects.toBeInstanceOf(UnauthorizedException);
        expect(authService.verifySupabaseToken).not.toHaveBeenCalled();
    });
});
