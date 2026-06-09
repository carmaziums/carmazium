import { getAccessToken } from './supabase';

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
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);

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
      throw new Error('AUTH_REDIRECT');
    }

    throw new Error(message);
  }

  return response.json();
}
