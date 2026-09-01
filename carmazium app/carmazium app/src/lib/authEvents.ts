/**
 * A one-way channel from `apiClient` to the auth store.
 *
 * `apiClient` needs to tell someone that the session is dead (AUTH-014), but it
 * cannot import `authStore` to do it: `authStore` imports `apiClient`, so that
 * would be a require cycle, which Metro resolves by handing one module a
 * half-initialised copy of the other. This module is imported by both and
 * imports neither, so there is no cycle.
 *
 * Kept deliberately tiny — it is a wire, not a bus. If a second kind of event
 * ever needs this, prefer a second explicit function over a generic emitter.
 */

type AuthRedirectHandler = () => void;

let handler: AuthRedirectHandler | null = null;

/**
 * Guards against a logout storm. A screen that fires five requests on focus
 * will get five 401s, and each one would otherwise trigger its own teardown and
 * its own navigation. The first one wins; the rest are ignored until something
 * clears the latch.
 */
let handled = false;

/** Registered once, at app start, by the auth store. */
export function setAuthRedirectHandler(fn: AuthRedirectHandler | null): void {
  handler = fn;
}

/**
 * Called by `apiClient` when a request comes back 401/403. Safe to call from
 * anywhere and safe to call repeatedly — only the first call in a burst runs
 * the handler.
 */
export function emitAuthRedirect(): void {
  if (handled || !handler) return;
  handled = true;
  try {
    handler();
  } catch {
    // A failure here must never mask the original request error that the
    // caller is about to throw.
  }
}

/**
 * Re-arms the latch. Called after a successful sign-in, so a later expiry in
 * the same app run is still acted on.
 */
export function resetAuthRedirectLatch(): void {
  handled = false;
}
