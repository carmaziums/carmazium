import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TARGETS, errorCategory, probeTarget, report } from './probe-public-availability.mjs'

test('fixed public allowlist excludes customer, bidding, and payment paths', () => {
  assert.equal(TARGETS.length, 3)
  assert.ok(TARGETS.every((target) => /^https:\/\/(www\.carmazium\.com|carmazium-hjoh9w\.fly\.dev)\//.test(target.url)))
  assert.ok(TARGETS.every((target) => !/\/(?:auth|admin|payment|bid|dashboard)\b/i.test(target.url)))
})

test('only bounded GET requests are used and ordinary HTTP 200 is healthy', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    return { status: 200, body: { cancel: async () => {} } }
  }
  const result = await probeTarget(TARGETS[0], { fetchImpl })
  assert.equal(result.healthy, true)
  assert.deepEqual(result.readings.map((entry) => entry.status), [200, 200])
  assert.equal(calls.length, 2)
  assert.ok(calls.every((call) => call.url === TARGETS[0].url && call.options.method === 'GET'))
  assert.ok(calls.every((call) => call.options.cache === 'no-store' && call.options.redirect === 'manual'))
  assert.ok(calls.every((call) => !('Authorization' in call.options.headers) && !('Cookie' in call.options.headers)))
})

test('transient status and socket error are reported without sensitive details or retries', async () => {
  let count = 0
  const fetchImpl = async () => {
    count += 1
    if (count === 1) return { status: 503 }
    throw Object.assign(new Error('private diagnostic text'), {
      cause: Object.assign(new Error('socket'), { code: 'ECONNRESET' }),
    })
  }
  const result = await probeTarget(TARGETS[1], { fetchImpl })
  assert.equal(count, 2)
  assert.equal(result.healthy, false)
  assert.deepEqual(result.readings.map((entry) => entry.status), [503, 'ECONNRESET'])
  const summary = report([result], new Date('2026-11-04T00:00:00.000Z'))
  assert.match(summary, /503, ECONNRESET/)
  assert.doesNotMatch(summary, /private diagnostic text|socket|Authorization|Token/)
})

test('rejects unknown targets and unbounded probe quantities', async () => {
  await assert.rejects(() => probeTarget({ label: 'Private', url: 'https://example.com/private' }), /not approved/)
  await assert.rejects(() => probeTarget(TARGETS[0], { attempts: 10 }), /outside allowed range/)
})

test('network timeout classifications are bounded to safe labels', () => {
  assert.equal(errorCategory({ name: 'TimeoutError' }), 'TIMEOUT')
  assert.equal(errorCategory({ cause: { code: 'ETIMEDOUT' } }), 'ETIMEDOUT')
  assert.equal(errorCategory(new Error('secret untrusted text')), 'NETWORK_ERROR')
})
