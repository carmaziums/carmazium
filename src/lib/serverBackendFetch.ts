const TRANSIENT_BACKEND_STATUS = new Set([429, 502, 503, 504]);

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

export interface BackendFetchRetryOptions {
  attempts?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryUrl(url: string, attempt: number) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_ssrRetry=${attempt}`;
}

/**
 * Server-side backend fetch with bounded timeout and short exponential backoff.
 *
 * This is intentionally server-only usage. It does not cache business data of
 * its own; callers retain control of Next.js revalidation/cache semantics.
 */
export async function fetchBackendWithRetry(
  url: string,
  init: NextFetchInit = {},
  options: BackendFetchRetryOptions = {},
): Promise<Response> {
  const attempts = Math.min(Math.max(options.attempts ?? 3, 1), 5);
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 8_000, 1_000), 30_000);
  const retryDelayMs = Math.min(Math.max(options.retryDelayMs ?? 150, 25), 2_000);

  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (init.signal?.aborted) {
      throw init.signal.reason ?? new Error('Backend fetch aborted');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Backend fetch timed out')), timeoutMs);

    try {
      const target = attempt === 0 ? url : retryUrl(url, attempt);
      const response = await fetch(target, {
        ...init,
        signal: controller.signal,
      });

      if (!TRANSIENT_BACKEND_STATUS.has(response.status) || attempt === attempts - 1) {
        return response;
      }

      try {
        await response.body?.cancel();
      } catch {
        // Response cleanup is best-effort; retry remains safe.
      }
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
    } finally {
      clearTimeout(timer);
    }

    await sleep(retryDelayMs * 2 ** attempt);
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('Backend request failed');
}
