import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function client(response) {
  const calls = [];
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL('../src/lib/adminApi.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(code, { exports, URLSearchParams, require: name => {
    assert.equal(name, './apiClient');
    return { apiClient: async url => { calls.push(url); return response; } };
  } });
  return { getUsers: exports.getAdminUsers, calls };
}

test('all selected account filters and search reach the paginated server query', async () => {
  const { getUsers, calls } = client({ filterVersion: 1, data: [], pagination: { total: 0 } });
  const filters = { accountType: 'DEALER', dealerVerification: 'VERIFIED', serviceType: 'WARRANTY', providerStatus: 'VERIFIED', accountStatus: 'ACTIVE', emailVerification: 'VERIFIED' };
  await getUsers(2, 20, 'A & B', filters);
  const url = new URL(calls[0], 'https://example.test');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('search'), 'A & B');
  for (const [key, value] of Object.entries(filters)) assert.equal(url.searchParams.get(key), value);
});

test('an older API cannot silently display all accounts as matching a filter', async () => {
  const { getUsers } = client({ data: [{ id: 'unfiltered' }], pagination: { total: 1609 } });
  await assert.rejects(getUsers(1, 20, undefined, { accountType: 'DEALER' }), /temporarily unavailable/);
  assert.equal((await getUsers()).pagination.total, 1609);
});

test('cleared filters are omitted and matching zero-result responses remain valid', async () => {
  const result = { filterVersion: 1, data: [], pagination: { total: 0 } };
  const { getUsers, calls } = client(result);
  assert.equal(await getUsers(1, 20, undefined, { accountType: '', serviceType: '' }), result);
  assert.equal(calls[0], '/admin/users?page=1&limit=20');
});
