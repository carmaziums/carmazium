import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(path) {
    const exports = {};
    new Function('exports', ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(exports);
    return exports;
}
const { loadCompleteDealerLeads, rollbackLeadStage } = load('../src/lib/dealerCrm.ts');
const { loadAllProviderJobs } = load('../src/lib/tradeXchangeProviderJobLoad.ts');
const lead = (id, status = 'NEW') => ({ id: String(id), buyerName: `Synthetic ${id}`, status });
test('CRM board includes customers beyond the first 20/50 records', async () => {
    const rows = Array.from({ length: 121 }, (_, i) => lead(i));
    const calls = [];
    const result = await loadCompleteDealerLeads(async (page, limit) => {
        calls.push([page, limit]);
        return { data: rows.slice((page - 1) * limit, page * limit), pagination: { page, total: 121, totalPages: 3 } };
    });
    assert.equal(result.length, 121); assert.deepEqual(calls, [[1,50],[2,50],[3,50]]);
});
test('CRM never reports partial totals after a later page fails', async () => {
    await assert.rejects(loadCompleteDealerLeads(async page => {
        if (page === 2) throw new Error('network unavailable');
        return { data: [lead(1)], pagination: { page, total: 2, totalPages: 2 } };
    }), /network unavailable/);
});
for (const mode of ['duplicate', 'changed total', 'empty page', 'incomplete', 'too large']) test(`CRM rejects ${mode} pagination`, async () => {
    await assert.rejects(loadCompleteDealerLeads(async page => ({
        data: mode === 'empty page' ? [] : [lead(mode === 'duplicate' ? 1 : page)],
        pagination: { page, total: mode === 'too large' ? 2001 : mode === 'changed total' && page === 2 ? 4 : mode === 'incomplete' ? 3 : 2, totalPages: 2 },
    })));
});
test('a failed stage change preserves other customer updates and follow-up details', () => {
    const rows = [{ ...lead('a', 'CONTACTED'), nextFollowUpAt: '2026-12-01' }, lead('b', 'WON')];
    assert.deepEqual(rollbackLeadStage(rows, 'a', 'NEW', 'CONTACTED'), [{ ...rows[0], status: 'NEW' }, rows[1]]);
    assert.deepEqual(rollbackLeadStage(rows, 'a', 'NEW', 'QUALIFIED'), rows);
});
test('provider totals aggregate every cursor page', async () => {
    const calls = [];
    const result = await loadAllProviderJobs(async cursor => {
        calls.push(cursor); return cursor ? { items: [{ id: 'old-released-job' }], nextCursor: null } : { items: [{ id: 'new-job' }], nextCursor: 'next' };
    });
    assert.equal(result.items.length, 2); assert.deepEqual(calls, [undefined, 'next']);
});
test('provider totals fail explicitly on a later outage instead of underreporting earnings', async () => {
    await assert.rejects(loadAllProviderJobs(async cursor => {
        if (cursor) throw new Error('offline');
        return { items: [{ id: 'new-job' }], nextCursor: 'next' };
    }), /offline/);
});
test('provider totals reject repeated cursors and duplicate jobs', async () => {
    let id = 0;
    await assert.rejects(loadAllProviderJobs(async () => ({ items: [{ id: String(++id) }], nextCursor: 'same' })), /incomplete/);
    await assert.rejects(loadAllProviderJobs(async () => ({ items: [{ id: 'same' }], nextCursor: String(++id) })), /changed/);
});
