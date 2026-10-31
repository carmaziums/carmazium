/**
 * Marker written to User.passwordHash when a person deletes their own account
 * (UsersService.deleteAccount). An admin ban only sets deletedAt, so this is
 * what tells "deleted by the user" apart from "banned by an admin".
 *
 * Owner rule (31 Oct 2026): someone who deleted their own account can sign up
 * again with the same email; a banned person cannot.
 */
export const SELF_DELETED_PASSWORD_MARKER = 'ACCOUNT_DELETED';

/** The anonymised address every self-deleted account is given. */
export const DELETED_EMAIL_DOMAIN = 'deleted.carmazium.com';

export function isSelfDeletedAccount(user: { deletedAt?: Date | null; passwordHash?: string | null } | null | undefined): boolean {
    return !!user?.deletedAt && user.passwordHash === SELF_DELETED_PASSWORD_MARKER;
}
