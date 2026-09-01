import { getAccessToken } from './supabase';
import { emitAuthRedirect } from './authEvents';

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
const PUBLIC_ENDPOINTS = ['/auth/supabase-session', '/users/sync', '/auth/logout'];

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();

  // If there's no session and this isn't a public endpoint, bail out early
  // rather than firing an unauthenticated request that will return 401.
  // This prevents ChatContext from triggering AUTH_REDIRECT when a newly
  // signed-up user is still on the VerifyEmail screen.
  const isPublic = PUBLIC_ENDPOINTS.some((p) => endpoint.startsWith(p));
  if (!token && !isPublic) {
    throw new Error('NO_SESSION');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  // 10-second timeout — prevents initializeAuth from hanging indefinitely
  // when the backend is unreachable (e.g. local dev server is down).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, { ...config, signal: controller.signal });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') throw new Error('REQUEST_TIMEOUT');
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

  return response.json();
}
