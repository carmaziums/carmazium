// Safe, read-only Fly health observations. Exported so classification and
// aggregation can be verified without credentials or live network access.
const KNOWN_NETWORK_CODES = new Set([
  'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENETUNREACH',
  'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

export function classifyHealthFailure(error) {
  const code = String(error?.cause?.code || error?.code || '');
  if (KNOWN_NETWORK_CODES.has(code)) return code;
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
  return 'network_error';
}

export function summarizeHealthObservations(samples) {
  const counts = {};
  const durations = [];
  for (const item of samples) {
    const category = String(item.status);
    counts[category] = (counts[category] || 0) + 1;
    if (Number.isFinite(item.ms) && item.ms >= 0) durations.push(item.ms);
  }
  durations.sort((a, b) => a - b);
  const percentile = (p) => durations.length
    ? durations[Math.min(durations.length - 1, Math.ceil(p * durations.length) - 1)]
    : null;
  return {
    count: samples.length,
    counts,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: durations.length ? durations[durations.length - 1] : null,
  };
}

export async function probeFlyHealth({
  origin,
  paths = ['/health/live', '/health/ready'],
  attemptsPerPath = 12,
  delayMs = 250,
  fetchImpl = fetch,
  sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  now = Date.now,
} = {}) {
  if (typeof origin !== 'string' || !/^https:\/\/[a-z0-9.-]+\.fly\.dev$/.test(origin)) {
    throw new Error('Health origin must be an explicit HTTPS Fly application hostname');
  }
  if (!Number.isInteger(attemptsPerPath) || attemptsPerPath < 1 || attemptsPerPath > 20) {
    throw new Error('Health attempts must be between 1 and 20');
  }
  const results = Object.fromEntries(paths.map(path => [path, []]));
  for (let i = 0; i < attemptsPerPath; i++) {
    for (const path of paths) {
      if (!/^\/health\/(live|ready)$/.test(path)) throw new Error('Only read-only health endpoints permitted');
      const started = now();
      let status = 'network_error';
      try {
        const response = await fetchImpl(origin + path, {
          method: 'GET',
          cache: 'no-store',
          signal: AbortSignal.timeout(7000),
        });
        status = String(response.status);
      } catch (error) {
        status = classifyHealthFailure(error);
      }
      results[path].push({ status, ms: Math.max(0, now() - started) });
    }
    if (i + 1 < attemptsPerPath && delayMs > 0) await sleep(delayMs);
  }
  return results;
}
