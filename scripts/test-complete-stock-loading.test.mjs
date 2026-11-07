import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/privateCarsListings.ts', import.meta.url), 'utf8')
function inventoryLoader(getMyListings) {
    const exports = {}
    runInNewContext(ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, require: () => ({ getMyListings }) })
    return exports.getCompletePrivateListings
}

test('a dealer with more than one page can search and filter older and sold vehicles', async () => {
    const stock = Array.from({ length: 73 }, (_, i) => ({ id: String(i), status: i === 72 ? 'SOLD' : 'ACTIVE', vrm: `CAR${i}` }))
    const requests = []
    const load = inventoryLoader(async query => {
        requests.push({ ...query })
        return { data: stock.slice((query.page - 1) * query.limit, query.page * query.limit), pagination: { total: stock.length, totalPages: 2 } }
    })
    const result = await load()
    assert.equal(result.length, 73)
    assert.equal(result.find(row => row.vrm === 'CAR72').status, 'SOLD')
    assert.deepEqual(requests, [{ page: 1, limit: 50, includeSold: true }, { page: 2, limit: 50, includeSold: true }])
})

test('a later-page failure never returns a convincing partial inventory', async () => {
    const load = inventoryLoader(async ({ page }) => {
        if (page === 2) throw new Error('Connection lost')
        return { data: [{ id: 'first' }], pagination: { total: 2, totalPages: 2 } }
    })
    await assert.rejects(load(), /Connection lost/)
})

test('changing totals and duplicate pages are rejected instead of hiding stock', async () => {
    for (const changesTotal of [true, false]) {
        const load = inventoryLoader(async ({ page }) => ({
            data: [{ id: 'same' }],
            pagination: { total: changesTotal && page === 2 ? 3 : 2, totalPages: 2 },
        }))
        await assert.rejects(load(), /changed while loading|Incomplete/)
    }
})

test('an empty inventory is a valid result', async () => {
    const load = inventoryLoader(async () => ({ data: [], pagination: { total: 0, totalPages: 0 } }))
    assert.equal((await load()).length, 0)
})
