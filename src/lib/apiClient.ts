import { getAccessToken } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

/**
 * Redirect unauthenticated users to the login page,
 * preserving the current URL so they return after logging in.
 */
function redirectToLogin() {
    if (typeof window === 'undefined') return;
    
    // Prevent redirect loops if we are already on an auth page
    const path = window.location.pathname;
    if (path.includes('/auth/login') || path.includes('/auth/register') || path.includes('/auth/reset-password')) {
        return;
    }

    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/auth/login?redirect=${redirect}`;
}

/**
 * Returns true if a non-2xx response looks like an auth/CSRF failure
 * that should redirect to login rather than throw a raw API error.
 */
function isAuthError(status: number, message: string): boolean {
    if (status === 401) return true;
    if (status !== 403) return false;

    const lower = message.toLowerCase();
    // Only redirect on explicit authentication/session failures.
    // Do not treat all 403 responses as "logged out" because many
    // role/permission checks intentionally return 403.
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
        // NestJS class-validator returns message as a string[] — join them
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

export async function apiClient<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = await getAccessToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
    };

    // Use a manual AbortController for a 30 s timeout — compatible with all
    // browsers (AbortSignal.timeout is not available in Safari < 16).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Request timed out after 30 s')), 30000);

    const config = {
        ...options,
        headers,
        credentials: 'include' as RequestCredentials,
        signal: controller.signal,
    };

    let response: Response;
    try {
        response = await fetch(`${API_URL}${endpoint}`, config);
    } catch (err: any) {
        const msg = err?.message || String(err);
        throw new Error(msg.includes('aborted') || msg.includes('timed out')
            ? 'Request timed out — the server took too long to respond. Please try again.'
            : msg);
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        const rawBody = await response.text().catch(() => '');
        let parsedBody: any = rawBody;
        try {
            parsedBody = rawBody ? JSON.parse(rawBody) : null;
        } catch {
            // Keep raw text body when it is not valid JSON
        }
        const message = normalizeErrorMessage(parsedBody, response.status, response.statusText);

        if (isAuthError(response.status, message)) {
            // Redirect to login and preserve the return URL
            redirectToLogin();
            // Throw a sentinel — callers can catch this but should not show it as a UI error
            throw new Error('AUTH_REDIRECT');
        }

        throw new Error(message);
    }

    return response.json();
}

/**
 * Downloads a binary (e.g. PDF) endpoint that requires auth and triggers a
 * browser download — via an authenticated `fetch` + blob, not `window.open`.
 *
 * `window.open(url)` navigates the backend's own domain directly as a fresh
 * top-level page load. Since the frontend and backend are on separate
 * domains, that request has no Authorization header (browsers don't let you
 * attach one to a plain navigation) and depends entirely on the session
 * cookie surviving a cross-site top-level navigation — which mobile Safari's
 * ITP and Chrome's third-party-cookie restrictions can silently drop. Every
 * other authenticated call in this app goes through `apiClient`'s
 * `fetch(..., credentials:'include')` + Bearer token, which works reliably;
 * this mirrors that so downloads authenticate the same way.
 */
export async function downloadAuthenticatedFile(endpoint: string, filename: string): Promise<void> {
    const token = await getAccessToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
        credentials: 'include',
        headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
        },
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            redirectToLogin();
            throw new Error('AUTH_REDIRECT');
        }
        throw new Error(`Download failed (HTTP ${response.status})`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
}
