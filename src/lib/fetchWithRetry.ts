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

// Abortable backoff: a cancelled page request must not keep retrying in the
// background. Jitter prevents many Vercel workers/browsers from retrying at
// precisely the same instant after the single Fly API becomes available.
function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new DOMException('Request aborted', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (error !== undefined) reject(error);
      else resolve();
    };
    const onAbort = () => finish(signal?.reason ?? new DOMException('Request aborted', 'AbortError'));
    const timer = setTimeout(() => finish(), ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function getRetryDelayMs(attempt: number, baseMs: number, response?: Response): number {
  // Bounded exponential backoff with jitter, rather than synchronized
  // 400/800ms retries that amplify a transient Fly availability incident.
  const capMs = Math.min(4000, Math.max(0, baseMs) * 2 ** attempt);
  const jitteredMs = Math.round(capMs * (0.5 + Math.random() * 0.5));
  const retryAfterHeader = response?.headers.get('retry-after');
  if (!retryAfterHeader) return jitteredMs;
  const seconds = Number(retryAfterHeader);
  const retryAfterMs = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(retryAfterHeader) - Date.now();
  return Number.isFinite(retryAfterMs)
    ? Math.min(4000, Math.max(jitteredMs, retryAfterMs))
    : jitteredMs;
}

export async function fetchWithRetry(
  url: string,
  options: RetryableFetchInit = {},
  config: {
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
    retryOnStatuses?: number[];
    /** Only for explicitly approved read-only POST endpoints (e.g. DVLA lookup). */
    retryReadOnlyPost?: boolean;
  } = {},
): Promise<Response> {
  const {
    timeoutMs = 10000,
    retries = 2,
    retryDelayMs = 400,
    retryOnStatuses,
    retryReadOnlyPost = false,
  } = config;

  const method = (options.method || 'GET').toUpperCase();
  const retryableMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
    || (retryReadOnlyPost && method === 'POST');
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

        await sleep(getRetryDelayMs(attempt, retryDelayMs, response), externalSignal);
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

      await sleep(getRetryDelayMs(attempt, retryDelayMs), externalSignal);
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', forwardAbort);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('fetchWithRetry failed');
}
