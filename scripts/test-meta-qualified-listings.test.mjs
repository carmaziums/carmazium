import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/hooks/useAnalytics.ts', import.meta.url), 'utf8')
const start = source.indexOf('const META_CONFIRMED_LISTING_EVENT_PREFIX =')
const end = source.indexOf('// The direct GA4 component owns page_view', start)
assert.ok(start > 0 && end > start, 'Meta conversion event boundary must remain inspectable')
const transpiled = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText

const SELLER_FUNNEL = {
    LISTING_STARTED: 'listing_started',
    LISTING_SUBMITTED: 'listing_submitted',
    AUCTION_SUBMITTED: 'auction_submitted_for_review',
    LISTING_FEE_PAID: 'listing_fee_paid',
    QUALIFIED_SELLER_LISTING: 'qualified_seller_listing',
}

function harness({ consent = true, storage } = {}) {
    const calls = []
    const data = storage ?? new Map()
    const context = {
        SELLER_FUNNEL,
        compact: p => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== '')),
        hasTrackingConsent: () => context.consent,
        consent,
        trackMetaSellerLeadOnce: () => {},
        trackMetaEvent: (name, payload, options) => calls.push({ name, payload, options }),
        window: {
            fbq: () => {},
            localStorage: {
                getItem: key => data.get(key) ?? null,
                setItem: (key, value) => data.set(key, value),
            },
        },
    }
    vm.createContext(context)
    vm.runInContext(transpiled + '\nthis.emit = mirrorToMeta;', context)
    return { calls, emit: context.emit, context, storage: data }
}

test('auction submission is counted once per listing even after resubmission', () => {
    const h = harness()
    const item = { listing_id: 'auction-123', listing_type: 'auction', seller_role: 'SELLER' }
    h.emit(SELLER_FUNNEL.AUCTION_SUBMITTED, item)
    h.emit(SELLER_FUNNEL.AUCTION_SUBMITTED, item)
    assert.equal(h.calls.length, 1)
    assert.equal(h.calls[0].name, 'AuctionListingCreated')
    assert.equal(h.calls[0].options.eventID, 'AuctionListingCreated:auction-123')
})

test('paid retail listing fee uses actual GBP amount, not an assumed payment', () => {
    const h = harness()
    h.emit(SELLER_FUNNEL.LISTING_FEE_PAID, {
        listing_id: 'retail-1', listing_type: 'retail', currency: 'GBP', value: 1,
    })
    h.emit(SELLER_FUNNEL.LISTING_FEE_PAID, {
        listing_id: 'retail-1', listing_type: 'retail', currency: 'GBP', value: 1,
    })
    assert.equal(h.calls.length, 1)
    assert.equal(h.calls[0].name, 'RetailListingFeePaid')
    assert.equal(h.calls[0].payload.value, 1)
    assert.equal(h.calls[0].payload.currency, 'GBP')
    assert.equal(h.calls[0].payload.content_name, 'LISTING_FEE')
    assert.equal(h.calls[0].options.eventID, 'RetailListingFeePaid:retail-1')
})

test('drafts, unpaid and invalid fee data cannot record a retail payment', () => {
    const h = harness()
    h.emit(SELLER_FUNNEL.LISTING_SUBMITTED, {
        listing_id: 'retail-draft', listing_type: 'retail', outcome: 'awaiting_payment',
    })
    h.emit(SELLER_FUNNEL.LISTING_FEE_PAID, {
        listing_id: 'retail-draft', listing_type: 'retail', currency: 'GBP',
    })
    h.emit(SELLER_FUNNEL.LISTING_FEE_PAID, {
        listing_id: 'retail-draft', listing_type: 'retail', currency: 'USD', value: 1,
    })
    h.emit(SELLER_FUNNEL.LISTING_FEE_PAID, {
        listing_id: 'retail-draft', listing_type: 'retail', currency: 'GBP', value: -1,
    })
    assert.equal(h.calls.filter(x => x.name === 'RetailListingFeePaid').length, 0)
})

test('qualified seller event requires verified auction or confirmed retail payment', () => {
    const h = harness()
    h.emit(SELLER_FUNNEL.QUALIFIED_SELLER_LISTING, {
        listing_id: 'auction-ok', listing_type: 'auction', qualification: 'auction_review',
        outcome: 'pending_review', seller_role: 'SELLER',
    })
    h.emit(SELLER_FUNNEL.QUALIFIED_SELLER_LISTING, {
        listing_id: 'retail-ok', listing_type: 'retail', qualification: 'retail_payment',
        payment_status: 'paid', seller_role: 'SELLER',
    })
    h.emit(SELLER_FUNNEL.QUALIFIED_SELLER_LISTING, {
        listing_id: 'retail-abandoned', listing_type: 'retail', qualification: 'retail_payment',
        payment_status: 'pending', seller_role: 'SELLER',
    })
    h.emit(SELLER_FUNNEL.QUALIFIED_SELLER_LISTING, {
        listing_id: 'auction-draft', listing_type: 'auction', qualification: 'auction_review',
        outcome: 'awaiting_payment', seller_role: 'SELLER',
    })
    assert.deepEqual(h.calls.map(x => x.name), ['QualifiedSellerListing', 'QualifiedSellerListing'])
    assert.deepEqual(h.calls.map(x => x.options.eventID), [
        'QualifiedSellerListing:auction-ok', 'QualifiedSellerListing:retail-ok',
    ])
    assert.ok(h.calls.every(x => x.payload.value === 0 && x.payload.currency === 'GBP'))
})

test('admin and missing listing id never create qualified conversions', () => {
    const h = harness()
    h.emit(SELLER_FUNNEL.QUALIFIED_SELLER_LISTING, {
        listing_id: 'admin-1', listing_type: 'auction', qualification: 'auction_review',
        outcome: 'pending_review', seller_role: 'ADMIN',
    })
    h.emit(SELLER_FUNNEL.QUALIFIED_SELLER_LISTING, {
        listing_type: 'auction', qualification: 'auction_review', outcome: 'pending_review',
    })
    h.emit(SELLER_FUNNEL.AUCTION_SUBMITTED, {
        listing_id: 'admin-2', seller_role: 'ADMIN',
    })
    assert.equal(h.calls.length, 0)
})

test('no consent does not consume the dedupe marker before the user opts in', () => {
    const h = harness({ consent: false })
    const item = {
        listing_id: 'auction-consent', listing_type: 'auction', qualification: 'auction_review',
        outcome: 'pending_review', seller_role: 'SELLER',
    }
    h.emit(SELLER_FUNNEL.QUALIFIED_SELLER_LISTING, item)
    assert.equal(h.calls.length, 0)
    h.context.consent = true
    h.emit(SELLER_FUNNEL.QUALIFIED_SELLER_LISTING, item)
    assert.equal(h.calls.length, 1)
})

test('separate page sessions do not recount the same listing', () => {
    const data = new Map()
    const item = { listing_id: 'repeat', listing_type: 'auction', seller_role: 'SELLER' }
    harness({ storage: data }).emit(SELLER_FUNNEL.AUCTION_SUBMITTED, item)
    const h = harness({ storage: data })
    h.emit(SELLER_FUNNEL.AUCTION_SUBMITTED, item)
    assert.equal(h.calls.length, 0)
})

test('generic checkout purchase and buyer enquiries do not become qualified seller events', () => {
    const h = harness()
    h.emit('purchase', { fee_type: 'KYC_VERIFICATION' })
    h.emit('generate_lead', { lead_type: 'vehicle_chat_enquiry', content_id: 'car-12' })
    assert.ok(h.calls.every(x => x.name !== 'QualifiedSellerListing' && x.name !== 'RetailListingFeePaid'))
})
