import { createHmac, createPublicKey, createVerify, timingSafeEqual, KeyObject } from 'crypto';

/**
 * Local verification of Supabase access tokens - no network round trip per API
 * call. Dependency-free on purpose (node:crypto only).
 *
 * Supports both ways a Supabase project can sign:
 *  - legacy shared secret (HS256)       -> set SUPABASE_JWT_SECRET
 *  - asymmetric signing keys (RS256/ES256) -> public keys from the project JWKS
 *
 * Trade-off: a locally verified token stays valid until its `exp` (<= 1 h by
 * default) even after sign-out. Bans/deletions are NOT affected - callers still
 * check the user row on every resolve.
 */

export interface SupabaseClaims {
    sub: string;
    email?: string;
    exp: number;
    [k: string]: unknown;
}

export type JwtResult =
    | { status: 'valid'; claims: SupabaseClaims }
    /** Bad signature, expired, wrong issuer/audience, malformed. Reject. */
    | { status: 'invalid'; reason: string }
    /** Cannot decide locally (no secret / JWKS unreachable). Ask Supabase instead. */
    | { status: 'unverifiable'; reason: string };

const JWKS_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_S = 5;

let jwksCache: { at: number; keys: Map<string, KeyObject> } | null = null;

async function loadJwks(supabaseUrl: string): Promise<Map<string, KeyObject> | null> {
    if (jwksCache && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.keys;
    try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 3000);
        const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`, { signal: ctl.signal });
        clearTimeout(t);
        if (!res.ok) return jwksCache?.keys ?? null;
        const body = (await res.json()) as { keys?: Array<Record<string, unknown>> };
        const keys = new Map<string, KeyObject>();
        for (const jwk of body.keys ?? []) {
            if (typeof jwk.kid === 'string') {
                keys.set(jwk.kid, createPublicKey({ key: jwk as any, format: 'jwk' }));
            }
        }
        jwksCache = { at: Date.now(), keys };
        return keys;
    } catch {
        return jwksCache?.keys ?? null; // serve stale keys rather than fail
    }
}

/** Test hook. */
export function resetJwksCache() {
    jwksCache = null;
}

const b64 = (s: string) => Buffer.from(s, 'base64url');

export async function verifySupabaseJwt(
    token: string,
    opts: { supabaseUrl?: string; jwtSecret?: string; now?: number } = {},
): Promise<JwtResult> {
    const parts = token.split('.');
    if (parts.length !== 3) return { status: 'invalid', reason: 'malformed' };

    let header: { alg?: string; kid?: string };
    let claims: SupabaseClaims;
    try {
        header = JSON.parse(b64(parts[0]).toString('utf8'));
        claims = JSON.parse(b64(parts[1]).toString('utf8'));
    } catch {
        return { status: 'invalid', reason: 'malformed' };
    }

    const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
    const sig = b64(parts[2]);
    let ok = false;

    if (header.alg === 'HS256') {
        if (!opts.jwtSecret) return { status: 'unverifiable', reason: 'no SUPABASE_JWT_SECRET' };
        const expected = createHmac('sha256', opts.jwtSecret).update(signed).digest();
        ok = expected.length === sig.length && timingSafeEqual(expected, sig);
    } else if (header.alg === 'RS256' || header.alg === 'ES256') {
        if (!opts.supabaseUrl || !header.kid) return { status: 'unverifiable', reason: 'no JWKS/kid' };
        const keys = await loadJwks(opts.supabaseUrl);
        if (!keys) return { status: 'unverifiable', reason: 'JWKS unavailable' };
        const key = keys.get(header.kid);
        if (!key) return { status: 'unverifiable', reason: 'unknown kid' }; // may be a rotated key
        const verifier = createVerify('sha256').update(signed);
        ok = header.alg === 'ES256'
            ? verifier.verify({ key, dsaEncoding: 'ieee-p1363' }, sig)
            : verifier.verify(key, sig);
    } else {
        // 'none' and anything exotic are never accepted locally.
        return { status: 'invalid', reason: `unsupported alg ${header.alg}` };
    }

    if (!ok) return { status: 'invalid', reason: 'bad signature' };

    const now = Math.floor((opts.now ?? Date.now()) / 1000);
    if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < now) {
        return { status: 'invalid', reason: 'expired' };
    }
    if (typeof claims.sub !== 'string' || !claims.sub) return { status: 'invalid', reason: 'no sub' };
    if (claims.aud !== 'authenticated') return { status: 'invalid', reason: 'bad audience' };
    if (opts.supabaseUrl && claims.iss !== `${opts.supabaseUrl}/auth/v1`) {
        return { status: 'invalid', reason: 'bad issuer' };
    }
    return { status: 'valid', claims };
}
