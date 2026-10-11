import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(root, 'src/lib/fetchWithRetry.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function makeClient(fetchImpl) {
  const context = {
    exports: {},
    fetch: fetchImpl,
    setTimeout, clearTimeout, AbortController, DOMException, Date, Math,
  };
  vm.runInNewContext(compiled, context, { filename: 'fetchWithRetry.js' });
  return context.exports.fetchWithRetry;
}

test('GET reconnects after transient Fly socket failures without replaying writes', async () => {
  let calls = 0;
  const get = makeClient(async () => {
    calls += 1;
    if (calls < 3) throw new Error('ECONNRESET');
    return { status: 200, ok: true };
  });
  const response = await get('https://carmazium-hjoh9w.fly.dev/health/live', {}, { retries: 2, retryDelayMs: 0 });
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
});

test('transient 503 responses retry while authentication failures do not', async () => {
  let calls = 0;
  const get = makeClient(async () => {
    calls += 1;
    return calls === 1
      ? { status: 503, headers: { get: () => '0' }, body: { cancel: async () => {} } }
      : { status: 200 };
  });
  assert.equal((await get('https://example.com/', {}, { retries: 2, retryDelayMs: 0 })).status, 200);
  assert.equal(calls, 2);

  let unauthorizedCalls = 0;
  const unauthorized = makeClient(async () => {
    unauthorizedCalls += 1;
    return { status: 401 };
  });
  assert.equal((await unauthorized('https://example.com/', {}, { retries: 2, retryDelayMs: 0 })).status, 401);
  assert.equal(unauthorizedCalls, 1);
});

test('payment, bidding and other mutating requests are not retried', async () => {
  let calls = 0;
  const mutate = makeClient(async () => {
    calls += 1;
    throw new Error('Connection dropped after server accepted request');
  });
  await assert.rejects(
    mutate('https://example.com/bids', { method: 'POST' }, { retries: 4, retryDelayMs: 0 }),
    /Connection dropped/,
  );
  assert.equal(calls, 1);
});

test('a cancelled request stops waiting immediately and does not reconnect', async () => {
  let calls = 0;
  const get = makeClient(async () => { calls += 1; throw new Error('ETIMEDOUT'); });
  const controller = new AbortController();
  const start = Date.now();
  const pending = get('https://example.com/', { signal: controller.signal }, { retries: 3, retryDelayMs: 1500 });
  setTimeout(() => controller.abort(new Error('page closed')), 20);
  await assert.rejects(pending, /page closed/);
  assert.equal(calls, 1);
  assert.ok(Date.now() - start < 900, 'the retry delay must be abortable');
});

test('only explicitly marked read-only POST is retryable', async () => {
  let calls = 0;
  const get = makeClient(async () => {
    calls += 1;
    return calls === 1 ? { status: 503, headers: { get: () => null }, body: { cancel: async () => {} } } : { status: 200 };
  });
  const result = await get('https://example.com/dvla/lookup', { method: 'POST' }, {
    retryReadOnlyPost: true, retries: 1, retryDelayMs: 0,
  });
  assert.equal(result.status, 200);
  assert.equal(calls, 2);
});
