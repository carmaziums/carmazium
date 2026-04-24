import { getAccessToken } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

/**
 * Redirect unauthenticated users to the login page,
 * preserving the current URL so they return after logging in.
 */
function redirectToLogin() {
    if (typeof window === 'undefined') return;
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/auth/login?redirect=${redirect}`;
}

/**
 * Returns true if a non-2xx response looks like an auth/CSRF failure
 * that should redirect to login rather than throw a raw API error.
 */
function isAuthError(status: number, message: string): boolean {
    if (status === 401) return true;
    if (status === 403) {
        const lower = message.toLowerCase();
        // Backend CSRF guard fires when the Bearer token is absent
        if (
            lower.includes('csrf') ||
            lower.includes('x-csrf-token') ||
            lower.includes('token') ||
            lower.includes('unauthorized') ||
            lower.includes('forbidden')
        ) {
            return true;
        }
    }
    return false;
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

    const config = {
        ...options,
        headers,
        credentials: 'include' as RequestCredentials,
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (!response.ok) {
        // Parse the error body once so we can inspect the message
        const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        const message: string = error.message || error.error || `HTTP ${response.status}`;

        if (isAuthError(response.status, message)) {
            // Clear any potentially stale token
            if (typeof window !== 'undefined') {
                localStorage.removeItem('authToken');
            }
            // Redirect to login and preserve the return URL
            redirectToLogin();
            // Throw a sentinel — callers can catch this but should not show it as a UI error
            throw new Error('AUTH_REDIRECT');
        }

        throw new Error(message);
    }

    return response.json();
}
