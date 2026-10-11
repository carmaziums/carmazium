/**
 * CarMazium authenticated session lifetime is an absolute 24-hour window.
 * A short-lived access token can refresh without changing Supabase session_id;
 * refreshing the token must NEVER extend this server-side deadline.
 *
 * Requires the companion Supabase Auth "Time-box user sessions" setting (24h)
 * to also cover Bearer-only/native clients without an express-session cookie.
 */
export const ABSOLUTE_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function remainingSessionLifetimeMs(authenticatedAt: unknown, now = Date.now()): number {
    if (typeof authenticatedAt !== 'number' || !Number.isFinite(authenticatedAt) || authenticatedAt <= 0 || authenticatedAt > now) {
        return 0;
    }
    return Math.max(0, ABSOLUTE_SESSION_LIFETIME_MS - (now - authenticatedAt));
}

/**
 * Extract a Supabase session_id only AFTER the token has been verified by
 * auth.getUser(token). JWT payload parsing alone is never authentication.
 */
export function sessionIdFromVerifiedJwt(token: string): string | null {
    try {
        const segment = token.split('.')[1];
        if (!segment) return null;
        const payload = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
        const id = payload?.session_id;
        return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
            ? id
            : null;
    } catch {
        return null;
    }
}
