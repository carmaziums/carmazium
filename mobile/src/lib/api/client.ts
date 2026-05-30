import { API_BASE_URL } from '@/constants/api';
import { supabase } from '@/lib/supabase';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?:   unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, params } = options;
  const authHeader = await getAuthHeader();

  const res = await fetch(buildUrl(path, params), {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json();
  // Unwrap backend StandardResponse envelope { success, data, timestamp }
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}
