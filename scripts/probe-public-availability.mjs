// Public, read-only availability sampling for the existing production app.
// No credentials, IDs, listing writes, auction actions or payment endpoints.
// GitHub Actions can report HTTPS failures but cannot identify Fly Proxy root cause.
import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const TARGETS = Object.freeze([
  { label: 'Fly process health', url: 'https://carmazium-hjoh9w.fly.dev/health/live' },
  { label: 'Fly database readiness', url: 'https://carmazium-hjoh9w.fly.dev/health/ready' },
  { label: 'Public blog archive', url: 'https://www.carmazium.com/blog' },
])

const ERROR_CODES = new Set([
  'ETIMEDOUT', 'ECONNRESET', 'UND_ERR_SOCKET', 'EAI_AGAIN',
  'ENOTFOUND', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT',
])

export function errorCategory(error) {
  let current = error
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (ERROR_CODES.has(current.code)) return current.code
    if (current.name === 'TimeoutError' || current.name === 'AbortError') return 'TIMEOUT'
    current = current.cause
  }
  return 'NETWORK_ERROR'
}

export async function probeTarget(target, { fetchImpl = fetch, attempts = 2, timeoutMs = 6500 } = {}) {
  if (!TARGETS.some((known) => known.url === target.url && known.label === target.label)) {
    throw new Error('Probe target not approved')
  }
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new Error('Probe count outside allowed range')
  }
  const readings = []
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const started = Date.now()
    try {
      const response = await fetchImpl(target.url, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        headers: { 'User-Agent': 'CarMazium-Public-Availability-Probe/1.0' },
        signal: AbortSignal.timeout(timeoutMs),
      })
      readings.push({ status: Number(response.status), ms: Date.now() - started })
      // We only need HTTP status; don't download/cache public HTML contents.
      await response.body?.cancel?.().catch?.(() => {})
    } catch (error) {
      readings.push({ status: errorCategory(error), ms: Date.now() - started })
    }
  }
  return { label: target.label, readings, healthy: readings.every((reading) => reading.status === 200) }
}

export function report(results, at = new Date()) {
  const lines = [
    '## CarMazium public availability checks',
    '',
    'UTC sampled: ' + at.toISOString(),
    '',
    '| Public endpoint | Attempts (HTTP/error) | Latency (ms) | Result |',
    '|---|---|---|---|',
  ]
  for (const result of results) {
    lines.push('| ' + result.label + ' | ' +
      result.readings.map((reading) => String(reading.status)).join(', ') + ' | ' +
      result.readings.map((reading) => reading.ms).join(', ') + ' | ' +
      (result.healthy ? 'PASS' : 'DEGRADED') + ' |')
  }
  lines.push('', 'These are external HTTPS snapshots from a GitHub-hosted runner, not Vercel-origin tracing or proof of a root cause.')
  lines.push('Only fixed public GET paths are requested. No cookies, personal data, credentials or raw response bodies are logged.')
  return lines.join('\n') + '\n'
}

export async function run() {
  const results = []
  for (const target of TARGETS) results.push(await probeTarget(target))
  const output = report(results)
  console.log(output)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, output)
  if (results.some((result) => !result.healthy)) process.exitCode = 1
  return results
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(() => {
    console.error('Public availability probe could not complete safely.')
    process.exitCode = 1
  })
}
