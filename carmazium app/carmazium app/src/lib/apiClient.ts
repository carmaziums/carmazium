import { getAccessToken } from './supabase';
import { emitAuthRedirect } from './authEvents';
import { isOnline } from './network';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

function isAuthError(status: number, message: string): boolean {
  if (status === 401) return true;
  if (status !== 403) return false;

  const lower = message.toLowerCase();
  return (
    lower.includes('csrf') ||
    lower.includes('x-csrf-token') ||
    lower.includes('not authenticated') ||
    lower.includes('session invalid') ||
    lower.includes('please log in')
  );
}

function normalizeErrorMessage(body: any, status: number, statusText: string): string {
  if (typeof body === 'string' && body.trim()) return body;

  if (body && typeof body === 'object') {
    if (Array.isArray(body.message) && body.message.length > 0) {
      return body.message.join(', ');
    }

    const possible = [
      body.message,
      body.error,
      body.details,
      body.reason,
    ].find((value) => typeof value === 'string' && value.trim().length > 0);
    if (possible) return possible as string;
  }

  return statusText || `HTTP ${status}`;
}

// Endpoints that are always public (no Bearer token required)
const PUBLIC_ENDPOINTS = ['/auth/supabase-session', '/users/sync', '/auth/logout', '/dvla/lookup'];

// Read-only endpoints the backend serves without a session (no guard, or
// OptionalSessionAuthGuard). Signed-out visitors can browse these exactly as on
// carmazium.com; everything else still requires an account.
const GUEST_READABLE_GET: RegExp[] = [
  /^\/listings(\?|$)/,
  /^\/listings\/featured(\?|$)/,
  /^\/listings\/facets\/makes(\?|$)/,
  /^\/listings\/valuation(\?|$)/,
  // /listings/:slug — static siblings (my, stats, earnings…) are guarded and
  // excluded so a guest never fires a request that can only 401.
  /^\/listings\/(?!my(\b|-)|stats|performance|earnings|retail-conversion-candidate)[^/?]+(\?|$)/,
  /^\/damage\/[^/?]+(\?|$)/,
  /^\/sellers\//,
  /^\/profiles\/[^/?]+(\/reviews(\/given)?)?(\?|$)/,
  /^\/blog(\/|\?|$)/,
  /^\/marketing-popup(\?|$)/,
  /^\/health(\/|\?|$)/,
];

// Unguarded, rate-limited POSTs the website also lets visitors use: MaziuM
// AI search/chat and reporting an unsafe AI answer.
const GUEST_POST = [/^\/ai\/search$/, /^\/ai\/chat$/, /^\/ai\/report$/];

export function isGuestReadable(endpoint: string, method = 'GET'): boolean {
  const m = method.toUpperCase();
  if (m === 'GET') return GUEST_READABLE_GET.some((re) => re.test(endpoint));
  if (m === 'POST') return GUEST_POST.some((re) => re.test(endpoint));
  return false;
}

type ApiClientOptions = RequestInit & { timeoutMs?: number };

export async function apiClient<T>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> {
  // Build 7's separately installed CarMazium QA package is a read-only
  // visual review build, not a safe payment/bid testing environment. The
  // bundled flag is false for every normal production/preview build.
  // Session bootstrap is allowed so existing test accounts can sign in.
  if (process.env.EXPO_PUBLIC_QA_READ_ONLY === '1') {
    const method = (options.method || 'GET').toUpperCase();
    const sessionBootstrap = ['/auth/supabase-session', '/users/sync', '/auth/logout']
      .some(path => endpoint.startsWith(path));
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !sessionBootstrap) {
      throw new Error('QA_READ_ONLY: This installer is for visual review only. Use the website for transactions.');
    }
  }

  const token = await getAccessToken();

  // If there's no session and this isn't a public endpoint, bail out early
  // rather than firing an unauthenticated request that will return 401.
  // This prevents ChatContext from triggering AUTH_REDIRECT when a newly
  // signed-up user is still on the VerifyEmail screen.
  const isPublic = PUBLIC_ENDPOINTS.some((p) => endpoint.startsWith(p));
  const guestRead = !token && isGuestReadable(endpoint, options.method || 'GET');
  if (!token && !isPublic && !guestRead) {
    throw new Error('NO_SESSION');
  }

  const { timeoutMs = 10_000, ...fetchOptions } = options;

  // FormData has to set its own Content-Type — it carries the multipart
  // boundary, and overriding it makes the server unable to parse the body.
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...fetchOptions.headers,
  };

  const config = {
    ...fetchOptions,
    headers,
  };

  // 10 seconds by default. Expensive read-only operations such as DVLA +
  // live specification research can opt into a longer request budget.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, { ...config, signal: controller.signal });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') throw new Error('REQUEST_TIMEOUT');
    // OFFLINE joins NO_SESSION / REQUEST_TIMEOUT / AUTH_REDIRECT as a
    // sentinel screens can branch on (CROSS-015). Checked here rather than
    // before the request: NetInfo can be wrong, and a request that actually
    // succeeds should never be blocked by a stale reachability flag. Only
    // once fetch has genuinely failed is 'you are offline' worth saying.
    if (!isOnline()) throw new Error('OFFLINE');
    throw err;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const rawBody = await response.text().catch(() => '');
    let parsedBody: any = rawBody;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      // Keep raw body if parsing fails
    }
    const message = normalizeErrorMessage(parsedBody, response.status, response.statusText);

    // A signed-out visitor has no session to expire: treat an auth error on a
    // guest read as "sign in required", never as a logout.
    if (!token && isAuthError(response.status, message)) {
      throw new Error('NO_SESSION');
    }

    if (isAuthError(response.status, message)) {
      // Tell the auth store the session is gone, then throw as before.
      // Every caller already handles this sentinel (ChatContext, for
      // instance, deliberately swallows it as expected) — but nothing
      // navigated, so an expired session simply stopped the app working
      // with no way back to Login (AUTH-014 / OQ-6). The emit is latched, so
      // a screen firing five requests on focus triggers one teardown, not
      // five.
      emitAuthRedirect();
      throw new Error('AUTH_REDIRECT');
    }

    throw new Error(message);
  }

  // Several successful mutation endpoints intentionally return 204 (or an
  // empty body). Parsing those as JSON would surface a false failure after
  // the server has already committed the action. Never retry a mutation here.
  if (response.status === 204 || response.status === 205 || options.method?.toUpperCase() === 'HEAD') {
    return undefined as T;
  }
  const body = await response.text();
  if (!body.trim()) return undefined as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error('INVALID_API_RESPONSE');
  }
}
