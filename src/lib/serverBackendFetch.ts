import { fetchWithRetry, type RetryableFetchInit } from './fetchWithRetry';

export const SERVER_BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

type ServerBackendFetchConfig = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  retryOnStatuses?: number[];
};

function resolveBackendUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${SERVER_BACKEND_URL}${path}`;
}

/**
 * Resilient read path for Next.js server/RSC -> Fly.io.
 *
 * Production Vercel logs have recorded intermittent ETIMEDOUT, ECONNRESET and
 * UND_ERR_SOCKET failures while reading the Fly API. All callers here are
 * idempotent server-side reads; fetchWithRetry deliberately refuses to retry
 * mutations.
 */
export function serverBackendFetch(
  pathOrUrl: string,
  options: RetryableFetchInit = {},
  config: ServerBackendFetchConfig = {},
): Promise<Response> {
  // All cached public blog reads (including paginated sitemap reads) share a
  // tag so an admin save expires their data together. Uncached/auth reads are
  // deliberately excluded and retain their original request options.
  if (/^\/blog(?:[/?]|$)/.test(pathOrUrl) && options.next && options.cache !== 'no-store') {
    options = { ...options, next: { ...options.next, tags: [...new Set([...(options.next.tags || []), 'public-blog'])] } };
  }
  return fetchWithRetry(resolveBackendUrl(pathOrUrl), options, {
    timeoutMs: config.timeoutMs ?? 8_000,
    retries: config.retries ?? 2,
    retryDelayMs: config.retryDelayMs ?? 350,
    retryOnStatuses: config.retryOnStatuses,
  });
}
