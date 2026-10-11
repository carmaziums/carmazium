import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import {
    ABSOLUTE_SESSION_LIFETIME_MS,
    remainingSessionLifetimeMs,
    sessionIdFromVerifiedJwt,
} from './session-lifetime';

const A = '5f27a91a-d792-4b72-81ef-f14c3bf1ac16';
const B = 'd9d4743b-6b25-43de-9aec-08b7d1160e09';
const jwt = (sessionId: string) => [
    Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
    Buffer.from(JSON.stringify({ session_id: sessionId, sub: 'user-1' })).toString('base64url'),
    'signature-verified-by-supabase-in-controller',
].join('.');

function fakeSession(fields: Record<string, any> = {}): any {
    const sess: any = {
        cookie: { maxAge: ABSOLUTE_SESSION_LIFETIME_MS },
        ...fields,
    };
    sess.regenerate = jest.fn((cb: (err?: Error) => void) => {
        for (const key of ['userId', 'userRole', 'cachedUser', 'supabaseSessionId', 'authenticatedAt']) {
            delete sess[key];
        }
        cb();
    });
    return sess;
}

function createController() {
    const user = { id: 'user-1', role: 'DEALER', email: 'login@example.test' };
    const service = { verifySupabaseToken: jest.fn().mockResolvedValue(user) } as any;
    return { controller: new AuthController(service), service, user };
}

describe('24-hour absolute session policy', () => {
    afterEach(() => jest.restoreAllMocks());

    it('does not extend the deadline when time advances or tokens refresh', () => {
        const started = 100_000;
        expect(remainingSessionLifetimeMs(started, started)).toBe(ABSOLUTE_SESSION_LIFETIME_MS);
        expect(remainingSessionLifetimeMs(started, started + 23 * 60 * 60 * 1000)).toBe(60 * 60 * 1000);
        expect(remainingSessionLifetimeMs(started, started + ABSOLUTE_SESSION_LIFETIME_MS)).toBe(0);
        expect(remainingSessionLifetimeMs(started, started + ABSOLUTE_SESSION_LIFETIME_MS + 1000)).toBe(0);
        expect(remainingSessionLifetimeMs('invalid', started)).toBe(0);
        expect(remainingSessionLifetimeMs(started + 1, started)).toBe(0);
    });

    it('parses stable Supabase session_id ONLY as metadata from the already verified JWT', () => {
        expect(sessionIdFromVerifiedJwt(jwt(A))).toBe(A);
        expect(sessionIdFromVerifiedJwt(jwt(B))).toBe(B);
        expect(sessionIdFromVerifiedJwt('badtoken')).toBeNull();
        expect(sessionIdFromVerifiedJwt(jwt('not-a-uuid'))).toBeNull();
    });

    it('stamps 24h only when the deliberate login bridge succeeds', async () => {
        const now = 10_000_000;
        jest.spyOn(Date, 'now').mockReturnValue(now);
        const { controller, user, service } = createController();
        const session = fakeSession();
        await controller.createSupabaseSession(jwt(A), { session } as any);
        expect(service.verifySupabaseToken).toHaveBeenCalled();
        expect(session.userId).toBe(user.id);
        expect(session.supabaseSessionId).toBe(A);
        expect(session.authenticatedAt).toBe(now);
        expect(session.cookie.maxAge).toBe(ABSOLUTE_SESSION_LIFETIME_MS);
    });

    it('does NOT grant 24 hours again to the same Supabase session on page reload', async () => {
        const now = 100_000_000;
        jest.spyOn(Date, 'now').mockReturnValue(now);
        const { controller } = createController();
        const session = fakeSession({
            userId: 'user-1', supabaseSessionId: A, authenticatedAt: now - 6 * 60 * 60 * 1000,
        });
        await controller.createSupabaseSession(jwt(A), { session } as any);
        expect(session.authenticatedAt).toBe(now - 6 * 60 * 60 * 1000);
        expect(session.cookie.maxAge).toBe(18 * 60 * 60 * 1000);
        expect(session.regenerate).not.toHaveBeenCalled();
    });

    it('rejects an expired session even if the Supabase access token was refreshed', async () => {
        const now = 200_000_000;
        jest.spyOn(Date, 'now').mockReturnValue(now);
        const { controller } = createController();
        const session = fakeSession({
            userId: 'user-1', supabaseSessionId: A, authenticatedAt: now - ABSOLUTE_SESSION_LIFETIME_MS,
        });
        await expect(controller.createSupabaseSession(jwt(A), { session } as any))
            .rejects.toThrow('SESSION_EXPIRED_24H');
        expect(session.regenerate).not.toHaveBeenCalled();
    });

    it('accepts a truly NEW login session and rotates the previous session cookie', async () => {
        const now = 300_000_000;
        jest.spyOn(Date, 'now').mockReturnValue(now);
        const { controller } = createController();
        const session = fakeSession({
            userId: 'user-1', supabaseSessionId: A, authenticatedAt: now - ABSOLUTE_SESSION_LIFETIME_MS,
        });
        await controller.createSupabaseSession(jwt(B), { session } as any);
        expect(session.regenerate).toHaveBeenCalledTimes(1);
        expect(session.authenticatedAt).toBe(now);
        expect(session.supabaseSessionId).toBe(B);
        expect(session.cookie.maxAge).toBe(ABSOLUTE_SESSION_LIFETIME_MS);
    });

    it('never bridges an invalid Supabase token', async () => {
        const { controller, service } = createController();
        service.verifySupabaseToken.mockResolvedValueOnce(null);
        const session = fakeSession();
        await expect(controller.createSupabaseSession(jwt(A), { session } as any))
            .rejects.toBeInstanceOf(UnauthorizedException);
        expect(session.userId).toBeUndefined();
    });
});
