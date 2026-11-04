import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the production TypeScript helper without requiring a browser,
// server connection, Meta token or live seller listing.
const source = readFileSync(new URL('../src/components/analytics/MetaPixel.tsx', import.meta.url), 'utf8')
const start = source.indexOf('const META_STANDARD_EVENTS =')
const end = source.indexOf('type MetaAdvancedMatchingData =', start)
assert.ok(start >= 0 && end > start, 'Meta event helper must be identifiable')

const helper = source.slice(start, end).replace('export function trackMetaEvent', 'function trackMetaEvent')
const javascript = ts.transpileModule(helper, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText

function harness(consent = true) {
    const calls = []
    const context = {
        META_PIXEL_ID: 'official-test-pixel',
        hasTrackingConsent: () => consent,
        window: { fbq: (...args) => calls.push(args) },
    }
    vm.createContext(context)
    vm.runInContext(javascript + '\nthis.emitMetaEvent = trackMetaEvent;', context)
    return { calls, emit: context.emitMetaEvent }
}

test('seller Lead has numeric zero value and GBP without inflating revenue', () => {
    const { calls, emit } = harness()
    emit('Lead', { listing_id: 'auction-1', content_category: 'seller_listing_submitted' }, {
        eventID: 'seller_listing:auction-1',
    })
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'trackSingle')
    assert.equal(calls[0][2], 'Lead')
    assert.equal(calls[0][3].value, 0)
    assert.equal(calls[0][3].currency, 'GBP')
    assert.equal(calls[0][3].listing_id, 'auction-1')
    assert.equal(calls[0][4].eventID, 'seller_listing:auction-1')
})

test('explicit valid future Lead valuations are preserved', () => {
    const { calls, emit } = harness()
    emit('Lead', { value: 4.5, currency: 'GBP', listing_id: 'future-2' })
    assert.equal(calls[0][3].value, 4.5)
    assert.equal(calls[0][3].currency, 'GBP')
})

test('invalid Lead values and currency fall back to non-transactional GBP', () => {
    const { calls, emit } = harness()
    emit('Lead', { value: -1, currency: '£' })
    assert.equal(calls[0][3].value, 0)
    assert.equal(calls[0][3].currency, 'GBP')
})

test('buyer enquiries remain custom events, and Purchase retains real amount', () => {
    const { calls, emit } = harness()
    emit('Lead', { content_category: 'vehicle_chat_enquiry', content_ids: ['123'] })
    emit('Purchase', { value: 1, currency: 'GBP', content_name: 'LISTING_FEE' })
    assert.equal(calls[0][0], 'trackSingleCustom')
    assert.equal(calls[0][2], 'VehicleEnquiry')
    assert.equal(calls[0][3].value, undefined)
    assert.equal(calls[1][0], 'trackSingle')
    assert.equal(calls[1][2], 'Purchase')
    assert.equal(calls[1][3].value, 1)
})

test('tracking consent is respected', () => {
    const { calls, emit } = harness(false)
    emit('Lead', { listing_id: 'no-consent' })
    assert.equal(calls.length, 0)
})
