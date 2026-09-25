/**
 * Fetch with a per-attempt timeout and bounded retries.
 *
 * Retries are deliberately limited to idempotent reads (GET/HEAD/OPTIONS).
 * Retrying a POST/PATCH/DELETE after a socket reset can duplicate a write when
 * the backend processed the request but the response never reached the client.
 */
type NextFetchOptions = {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

export type RetryableFetchInit = RequestInit & NextFetchOptions;

const DEFAULT_RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  options: RetryableFetchInit = {},
  config: {
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
    retryOnStatuses?: number[];
  } = {},
): Promise<Response> {
  const {
    timeoutMs = 10000,
    retries = 2,
    retryDelayMs = 400,
    retryOnStatuses,
  } = config;

  const method = (options.method || 'GET').toUpperCase();
  const retryableMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  const maxRetries = retryableMethod ? Math.max(0, retries) : 0;
  const statuses = retryOnStatuses
    ? new Set(retryOnStatuses)
    : DEFAULT_RETRY_STATUSES;

  const externalSignal = options.signal;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (externalSignal?.aborted) {
      throw externalSignal.reason || new DOMException('Request aborted', 'AbortError');
    }

    const controller = new AbortController();
    const forwardAbort = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener('abort', forwardAbort, { once: true });

    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (
        attempt < maxRetries &&
        statuses.has(response.status)
      ) {
        // Release the connection before retrying a transient HTTP response.
        try {
          await response.body?.cancel();
        } catch {
          // Best-effort cleanup only.
        }

        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      // A caller-initiated abort is final. Our own timeout/network failures are
      // retryable for safe reads.
      if (externalSignal?.aborted || attempt >= maxRetries) {
        throw error;
      }

      await sleep(retryDelayMs * (attempt + 1));
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', forwardAbort);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('fetchWithRetry failed');
}
