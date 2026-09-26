/**
 * Convert a user-entered website value into a safe absolute external URL.
 *
 * Dealer/KYC forms often contain values such as "www.example.com" without a
 * scheme. Passing those values directly to an <a href> makes Next/browser
 * treat them as an internal relative route (for example
 * /dashboard/admin/users/www.example.com), which produces a 404.
 *
 * Only http(s) URLs are allowed here so an admin-supplied value cannot turn
 * the link into a javascript:, data:, or other unsafe scheme.
 */
export function normalizeExternalUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
