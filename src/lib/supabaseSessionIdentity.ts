/**
 * Client-side consistency check only. A decoded JWT subject is NOT proof of
 * authentication: the Fly backend must still verify the token with Supabase.
 * Prevents a cross-tab account switch from bridging another user's token or
 * displaying the previous user's dealer/admin account.
 */
export function isSessionTokenForUser(token: string, expectedUserId: string): boolean {
    if (!token || !expectedUserId) return false
    try {
        const payload = token.split('.')[1]
        if (!payload) return false
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
        return typeof decoded?.sub === 'string' && decoded.sub === expectedUserId
    } catch {
        return false
    }
}
