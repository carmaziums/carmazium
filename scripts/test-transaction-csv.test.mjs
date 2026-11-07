import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

function load(file, imports = {}) {
    const code = ts.transpileModule(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    const exports = {}
    new Function('exports', 'require', code)(exports, name => {
        assert.ok(name in imports, `Unexpected import ${name}`)
        return imports[name]
    })
    return exports
}
const csv = load('src/lib/csvExport.ts')
const { transactionCsv } = load('src/lib/transactionCsv.ts', { './csvExport': csv })

test('ledger export includes only its seven fields, preserving decimal amounts and missing registrations', () => {
    const text = transactionCsv([{ id: 'tx-1', createdAt: '2026-11-07T20:00:00Z', listing: null,
        type: 'REFUND', status: 'COMPLETED', amount: '12.50', stripePaymentId: null,
        user: { email: 'private@example.test', phone: 'private-phone' }, secret: 'never-export',
    }])
    assert.equal(text.split('\r\n').length, 2)
    assert.equal(text.split('\r\n')[1], '"tx-1","2026-11-07T20:00:00Z","","REFUND","COMPLETED","12.50",""')
    assert.doesNotMatch(text, /private|never-export/)
})

test('untrusted ledger strings cannot become spreadsheet formulas and quotes remain escaped', () => {
    const text = transactionCsv([{ id: '=1+1', type: 'LISTING_FEE', status: 'COMPLETED', amount: 1,
        listing: { vrm: 'AB"12' }, stripePaymentId: '\u0001@formula',
    }])
    assert.ok(text.includes('"\'=1+1"'))
    assert.ok(text.includes('"AB""12"'))
    assert.ok(text.includes('"\'\u0001@formula"'))
    assert.ok(text.includes(',1,'))
})

test('export contains only the supplied page and an empty page produces a header', () => {
    const page = Array.from({ length: 20 }, (_, i) => ({ id: `tx-${i}`, type: 'LISTING_FEE', status: 'PENDING', amount: 1 }))
    assert.equal(transactionCsv(page).split('\r\n').length, 21)
    assert.equal(transactionCsv([]).split('\r\n').length, 1)
})
