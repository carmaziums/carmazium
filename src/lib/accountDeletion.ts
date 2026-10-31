/**
 * Self-deleted accounts are kept only as anonymised records (for past sales and
 * bids) with this address; see backend/src/users/account-deletion.ts. They are
 * not bans: the person can sign up again with their own email (owner rule,
 * 31 Oct 2026), so admin screens must not offer "Unban" for them.
 */
export const DELETED_EMAIL_DOMAIN = "deleted.carmazium.com"

export function isSelfDeletedEmail(email: string | null | undefined): boolean {
    return typeof email === "string" && email.toLowerCase().endsWith("@" + DELETED_EMAIL_DOMAIN)
}
