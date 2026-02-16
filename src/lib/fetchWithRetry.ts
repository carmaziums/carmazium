/**
 * Fetch with timeout and retries. Use for critical auth/backend calls (e.g. cold start).
 * - timeoutMs: abort after this many ms (default 60s to survive Render cold start).
 * - retries: number of retries after failure (default 2).
 * - retryDelayMs: delay between retries (default 2500).
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: { timeoutMs?: number; retries?: number; retryDelayMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 60000, retries = 2, retryDelayMs = 2500 } = config;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
  }

  throw lastError || new Error("fetchWithRetry failed");
}
