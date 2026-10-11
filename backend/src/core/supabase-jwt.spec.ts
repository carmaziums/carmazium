import { createHmac, generateKeyPairSync, createSign } from 'crypto';
import { verifySupabaseJwt, resetJwksCache } from './supabase-jwt';

const URL_ = 'https://proj.supabase.co';
const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const claims = (over: object = {}) => ({
    sub: 'u1', email: 'a@b.c', aud: 'authenticated', iss: `${URL_}/auth/v1`,
    exp: Math.floor(Date.now() / 1000) + 600, ...over,
});
function hs256(payload: object, secret = 's3cret') {
    const head = enc({ alg: 'HS256', typ: 'JWT' });
    const body = enc(payload);
    const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
    return `${head}.${body}.${sig}`;
}

describe('verifySupabaseJwt', () => {
    const opts = { supabaseUrl: URL_, jwtSecret: 's3cret' };

    it('accepts a valid HS256 token', async () => {
        const r = await verifySupabaseJwt(hs256(claims()), opts);
        expect(r.status).toBe('valid');
    });
    it('rejects a wrong secret, tampered payload and expired token', async () => {
        expect((await verifySupabaseJwt(hs256(claims(), 'other'), opts)).status).toBe('invalid');
        const t = hs256(claims()).split('.');
        t[1] = enc(claims({ sub: 'admin' }));
        expect((await verifySupabaseJwt(t.join('.'), opts)).status).toBe('invalid');
        const expired = await verifySupabaseJwt(hs256(claims({ exp: 1 })), opts);
        expect(expired).toMatchObject({ status: 'invalid', reason: 'expired' });
    });
    it('never accepts alg none', async () => {
        const t = `${enc({ alg: 'none' })}.${enc(claims())}.`;
        expect((await verifySupabaseJwt(t, opts)).status).toBe('invalid');
    });
    it('defers to Supabase when HS256 has no secret configured', async () => {
        const r = await verifySupabaseJwt(hs256(claims()), { supabaseUrl: URL_ });
        expect(r.status).toBe('unverifiable');
    });
    it('verifies ES256 against the project JWKS', async () => {
        const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
        const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'ES256' };
        resetJwksCache();
        const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true, json: async () => ({ keys: [jwk] }),
        } as any);
        const head = enc({ alg: 'ES256', kid: 'k1' });
        const body = enc(claims());
        const sig = createSign('sha256').update(`${head}.${body}`)
            .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
        expect((await verifySupabaseJwt(`${head}.${body}.${sig}`, { supabaseUrl: URL_ })).status).toBe('valid');
        const forged = `${head}.${enc(claims({ sub: 'x' }))}.${sig}`;
        expect((await verifySupabaseJwt(forged, { supabaseUrl: URL_ })).status).toBe('invalid');
        fetchMock.mockRestore();
    });
});
