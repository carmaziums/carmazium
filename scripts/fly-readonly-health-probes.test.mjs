import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyHealthFailure,
  summarizeHealthObservations,
  probeFlyHealth,
} from './fly-readonly-health-probes.mjs';

test('classifies common TLS, reset and timeout errors without disclosing messages', () => {
  assert.equal(classifyHealthFailure({ cause: { code: 'ETIMEDOUT' } }), 'ETIMEDOUT');
  assert.equal(classifyHealthFailure({ cause: { code: 'ECONNRESET' } }), 'ECONNRESET');
  assert.equal(classifyHealthFailure({ cause: { code: 'UND_ERR_SOCKET' } }), 'UND_ERR_SOCKET');
  assert.equal(classifyHealthFailure({ name: 'TimeoutError' }), 'timeout');
  assert.equal(classifyHealthFailure({ cause: { code: 'FAKE_PRIVATE_INFO', secret: 'do-not-log' } }), 'network_error');
});

test('summarizes observed outcomes and percentile timings', () => {
  const summary = summarizeHealthObservations([
    { status: '200', ms: 100 },
    { status: '200', ms: 150 },
    { status: 'ETIMEDOUT', ms: 7000 },
    { status: '503', ms: 300 },
  ]);
  assert.deepEqual(summary.counts, { 200: 2, 503: 1, ETIMEDOUT: 1 });
  assert.equal(summary.count, 4);
  assert.equal(summary.p50Ms, 150);
  assert.equal(summary.p95Ms, 7000);
  assert.equal(summary.maxMs, 7000);
});

test('makes only bounded GETs to health endpoints', async () => {
  const requests = [];
  const response = await probeFlyHealth({
    origin: 'https://test.fly.dev',
    attemptsPerPath: 2,
    delayMs: 0,
    now: () => 100,
    fetchImpl: async (url, options) => {
      requests.push({ url, method: options.method });
      if (url.endsWith('/health/ready') && requests.length === 4) {
        throw { cause: { code: 'ECONNRESET' } };
      }
      return { status: 200 };
    },
  });
  assert.deepEqual(requests, [
    { url: 'https://test.fly.dev/health/live', method: 'GET' },
    { url: 'https://test.fly.dev/health/ready', method: 'GET' },
    { url: 'https://test.fly.dev/health/live', method: 'GET' },
    { url: 'https://test.fly.dev/health/ready', method: 'GET' },
  ]);
  assert.deepEqual(response['/health/live'].map(r => r.status), ['200', '200']);
  assert.deepEqual(response['/health/ready'].map(r => r.status), ['200', 'ECONNRESET']);
});

test('refuses non-Fly origins, writes, and excessive probe counts', async () => {
  await assert.rejects(probeFlyHealth({ origin: 'https://untrusted.example.com' }));
  await assert.rejects(probeFlyHealth({ origin: 'https://test.fly.dev', attemptsPerPath: 21 }));
  await assert.rejects(probeFlyHealth({ origin: 'https://test.fly.dev', paths: ['/payments/webhook'] }));
});
