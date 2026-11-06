import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const analyticsSource = readFileSync(new URL('../src/hooks/useAnalytics.ts', import.meta.url), 'utf8')
const checkoutSource = readFileSync(new URL('../src/app/checkout/success/page.tsx', import.meta.url), 'utf8')
const metaPixelSource = readFileSync(new URL('../src/components/analytics/MetaPixel.tsx', import.meta.url), 'utf8')
const wizardSource = readFileSync(new URL('../src/components/listing/ListingWizard.tsx', import.meta.url), 'utf8')
const backendPaymentsSource = readFileSync(new URL('../backend/src/payments/payments.service.ts', import.meta.url), 'utf8')

const helperStart = analyticsSource.indexOf('const META_SELLER_CONVERSION_STORAGE_PREFIX')
const helperEnd = analyticsSource.indexOf('function mirrorToMeta(', helperStart)
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'verified conversion helper is present')
const helperSource = analyticsSource.slice(helperStart, helperEnd)

function createTrackingHarness({ storage = new Map(), consent = true, delivered = true } = {}) {
    const sent = []
    const exports = {}
    const js = ts.transpileModule(helperSource +
        '\nexports.trackMetaSellerConversionOnce = trackMetaSellerConversionOnce;', {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const localStorage = {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
    }
    runInNewContext(js, {
        exports,
        window: { fbq: () => {}, localStorage },
        hasTrackingConsent: () => consent,
        trackMetaEvent: (name, params, opts) => {
            if (!delivered) return false
            sent.push({ name, params, eventID: opts.eventID })
            return true
        },
    })
    return { sent, storage, fire: exports.trackMetaSellerConversionOnce }
}

test('one completed auction and one paid retail conversion per listing, even after reload', () => {
    const storage = new Map()
    const first = createTrackingHarness({ storage })
    first.fire('Lead', 'auction-001', { content_category: 'auction_listing_submitted' })
    first.fire('Lead', 'auction-001', {})
    first.fire('Purchase', 'retail-001', { value: 1 })
    first.fire('Purchase', 'retail-001', { value: 1 })
    assert.deepEqual(first.sent.map(x => x.name), ['Lead', 'Purchase'])
    assert.equal(first.sent[0].eventID, 'seller_lead:auction-001')
    assert.equal(first.sent[1].eventID, 'seller_purchase:retail-001')

    const refreshed = createTrackingHarness({ storage })
    refreshed.fire('Lead', 'auction-001', {})
    refreshed.fire('Purchase', 'retail-001', {})
    assert.equal(refreshed.sent.length, 0, 'refresh and repeated checkout do not count again')
    refreshed.fire('Lead', 'auction-002', {})
    refreshed.fire('Purchase', 'retail-002', {})
    assert.equal(refreshed.sent.length, 2, 'new vehicles are new conversions')
})

test('no consent or no pixel delivery does not consume the conversion', () => {
    const storage = new Map()
    createTrackingHarness({ storage, consent: false }).fire('Lead', 'auction-003', {})
    createTrackingHarness({ storage, delivered: false }).fire('Purchase', 'retail-003', {})
    assert.equal(storage.size, 0)
    const restored = createTrackingHarness({ storage })
    restored.fire('Lead', 'auction-003', {})
    restored.fire('Purchase', 'retail-003', {})
    assert.equal(restored.sent.length, 2)
})

test('invalid listing IDs cannot create success events', () => {
    const ctx = createTrackingHarness()
    for (const id of [undefined, null, '', 'contains/slash', 'A'.repeat(49)]) {
        ctx.fire('Lead', id, {})
        ctx.fire('Purchase', id, {})
    }
    assert.equal(ctx.sent.length, 0)
})

test('Meta seller events are gated to the two verified outcomes, not wizard or PageView', () => {
    assert.match(analyticsSource, /case SELLER_FUNNEL\\.LISTING_SUBMITTED:\\s*case SELLER_FUNNEL\\.AUCTION_SUBMITTED:/)
    assert.match(analyticsSource, /payload\\.listing_type === "auction"[\\s\\S]*payload\\.qualification === "auction_review"[\\s\\S]*payload\\.outcome === "pending_review"/)
    assert.match(analyticsSource, /trackMetaSellerConversionOnce\\("Lead", payload\\.listing_id/)
    assert.match(analyticsSource, /case SELLER_FUNNEL\\.LISTING_FEE_PAID:/)
    assert.match(analyticsSource, /payload\\.currency === "GBP" && Number\\(payload\\.value\\) === 1/)
    assert.match(analyticsSource, /trackMetaSellerConversionOnce\\("Purchase", payload\\.listing_id/)
    assert.doesNotMatch(analyticsSource, /trackMetaEvent\\("SellerCompleteListing"/)
    assert.doesNotMatch(analyticsSource, /trackMetaEvent\\("AuctionListingCreated"/)
    assert.doesNotMatch(analyticsSource, /trackMetaSellerLeadOnce/)
})

test('Stripe success page verifies payment and delegates Meta Purchase once', () => {
    assert.match(checkoutSource, /if \\(data\\?\\.paymentStatus !== 'paid'\\)/)
    assert.match(checkoutSource, /data\\.metadata\\?\\.type === 'LISTING_FEE'/)
    assert.match(checkoutSource, /trackEvent\\(SELLER_FUNNEL\\.LISTING_FEE_PAID/)
    assert.match(checkoutSource, /seller_role: profile\\?\\.role \\|\\| 'UNKNOWN'/)
    assert.doesNotMatch(checkoutSource, /trackMetaEvent\\("Purchase"/)
    assert.match(backendPaymentsSource, /type=retail-listing&session_id=\\{CHECKOUT_SESSION_ID\\}/)
    assert.match(wizardSource, /auctionSubmission\\.pendingReview \\? 'pending_review' : 'published'/)
    assert.match(metaPixelSource, /if \\(!META_PIXEL_ID \\|\\| !hasTrackingConsent\\(\\)\\) return false/)
})
