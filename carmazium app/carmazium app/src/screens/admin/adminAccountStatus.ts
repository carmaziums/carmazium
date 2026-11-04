// Mirrors web src/lib/accountDeletion.ts + the status badges in
// src/app/dashboard/admin/users/page.tsx and UserDetailModal.tsx.
// Self-deleted accounts are anonymised records, not bans.
export const DELETED_EMAIL_DOMAIN = 'deleted.carmazium.com';

export function isSelfDeletedEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.toLowerCase().endsWith('@' + DELETED_EMAIL_DOMAIN);
}

/** 'DELETED BY USER' | 'BANNED' | 'LOCKED' | null */
export function accountStatus(u: { email?: string | null; deletedAt?: string | null; lockoutUntil?: string | null }): string | null {
  const selfDeleted = isSelfDeletedEmail(u.email);
  if (u.deletedAt) return selfDeleted ? 'DELETED BY USER' : 'BANNED';
  if (!selfDeleted && u.lockoutUntil && new Date(u.lockoutUntil) > new Date()) return 'LOCKED';
  return null;
}
