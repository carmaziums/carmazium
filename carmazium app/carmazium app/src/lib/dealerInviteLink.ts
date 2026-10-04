/**
 * Recognise only CarMazium's own dealer-team invite URLs. Never persist the
 * 64-character bearer token in logs, analytics or an unencrypted URL history.
 * The app's auth flow keeps it in memory until the account is ready.
 */
export function isDealerInviteUrl(url: string): boolean {
  return /^(?:carmazium:\/\/\/?|https:\/\/(?:www\.)?carmazium\.com\/)auth\/accept-invite(?:[?#]|$)/i.test(url);
}

export function extractDealerInviteToken(url: string): string | null {
  if (!isDealerInviteUrl(url)) return null;
  const query = url.split('?')[1]?.split('#')[0];
  if (!query) return null;
  const token = new URLSearchParams(query).get('token')?.trim() ?? '';
  // Backend dealer invites use crypto.randomBytes(32).toString('hex').
  // Restricting syntax also prevents arbitrary untrusted deep-link payloads
  // from being placed in the deferred navigation state.
  return /^[a-f0-9]{64}$/i.test(token) ? token.toLowerCase() : null;
}
