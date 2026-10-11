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

describe('Session freshness and cookie/Bearer identity', () => {
    const userA = { id: 'a', role: 'BUYER' };
    const userB = { id: 'b', role: 'DEALER' };
    const jwtFor = (sub: string) => `x.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.y`;

    const make = () => {
        const authService = {
            verifySupabaseToken: jest.fn(async (t: string) => (t === jwtFor('b') ? userB : null)),
            resolveSessionUser: jest.fn(async (s: any) => (s.userId === 'a' ? userA : null)),
        };
        return { guard: new SessionAuthGuard(authService as any), authService };
    };
    const session = (over: any = {}) => ({ userId: 'a', destroy: jest.fn((cb: any) => cb()), ...over });

    it('resolves the cookie user through the freshness check', async () => {
        const { guard, authService } = make();
        const request: any = { headers: {}, session: session() };
        await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
        expect(authService.resolveSessionUser).toHaveBeenCalled();
        expect(request.user).toEqual(userA);
    });

    it('rejects and destroys the session when the user was banned or deleted', async () => {
        const { guard } = make();
        const request: any = { headers: {}, session: session({ userId: 'gone' }) };
        await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(UnauthorizedException);
        expect(request.session.destroy).toHaveBeenCalled();
    });

    it('Bearer for B beats a leftover cookie for A, without writing the session', async () => {
        const { guard } = make();
        const request: any = { headers: { authorization: `Bearer ${jwtFor('b')}` }, session: session(), user: userA };
        await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
        expect(request.user).toEqual(userB);
        expect(request.session.userId).toBe('a');
    });
});
