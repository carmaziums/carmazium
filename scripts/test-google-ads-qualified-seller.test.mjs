import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const adsSource = readFileSync(new URL('../src/lib/googleAds.ts', import.meta.url), 'utf8')
const wizardSource = readFileSync(new URL('../src/components/listing/ListingWizard.tsx', import.meta.url), 'utf8')
const checkoutSource = readFileSync(new URL('../src/app/checkout/success/page.tsx', import.meta.url), 'utf8')
const paymentsSource = readFileSync(new URL('../src/lib/paymentApi.ts', import.meta.url), 'utf8')
const analyticsHookSource = readFileSync(new URL('../src/hooks/useAnalytics.ts', import.meta.url), 'utf8')
const funnelSource = readFileSync(new URL('../src/lib/gtm.ts', import.meta.url), 'utf8')

function setup({ qualifiedLabel = 'NEW_QUALIFIED_LABEL' } = {}) {
    const sent = []
    const exports = {}
    const env = {
        NEXT_PUBLIC_GOOGLE_ADS_ID: 'AW-TEST',
        NEXT_PUBLIC_GADS_LABEL_LISTING_FEE_PAID: 'EXISTING_PAID_LABEL',
    }
    if (qualifiedLabel) env.NEXT_PUBLIC_GADS_LABEL_QUALIFIED_SELLER = qualifiedLabel
    const js = ts.transpileModule(adsSource, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    runInNewContext(js, {
        exports,
        process: { env },
        window: { gtag: (action, type, payload) => sent.push({ action, type, ...payload }) },
    })
    return { sent, ...exports }
}

const auction = (listing_id = 'vehicle-1') => ({
    listing_id,
    listing_type: 'auction',
    qualification: 'auction_review',
    outcome: 'pending_review',
    seller_role: 'SELLER',
})

const retail = (listing_id = 'vehicle-2') => ({
    listing_id,
    listing_type: 'retail',
    qualification: 'retail_payment',
    payment_status: 'paid',
    seller_role: 'SELLER',
    value: 1,
    currency: 'GBP',
})

test('only a successful auction review submission qualifies; same vehicle cannot qualify twice', () => {
    const ctx = setup()
    ctx.trackAdsConversion('qualified_seller_listing', auction())
    ctx.trackAdsConversion('qualified_seller_listing', auction()) // rejection/resubmission
    ctx.trackAdsConversion('qualified_seller_listing', retail('vehicle-1')) // conversion to retail
    assert.equal(ctx.sent.length, 1)
    assert.equal(ctx.sent[0].send_to, 'AW-TEST/NEW_QUALIFIED_LABEL')
    assert.equal(ctx.sent[0].transaction_id, 'qualified_listing:vehicle-1')
    assert.equal(ctx.sent[0].value, undefined, 'qualified conversion is not reported as £ revenue')
})

test('confirmed retail payment qualifies once per distinct vehicle, not per checkout session', () => {
    const ctx = setup()
    ctx.trackAdsConversion('qualified_seller_listing', { ...retail(), transaction_id: 'checkout-1' })
    ctx.trackAdsConversion('qualified_seller_listing', { ...retail(), transaction_id: 'checkout-2' })
    ctx.trackAdsConversion('qualified_seller_listing', retail('vehicle-3'))
    assert.deepEqual(ctx.sent.map(x => x.transaction_id), [
        'qualified_listing:vehicle-2',
        'qualified_listing:vehicle-3',
    ])
})

test('unpaid/draft/invalid/admin/anonymous conversions never fire', () => {
    const ctx = setup()
    ctx.trackAdsConversion('qualified_seller_listing', { ...auction(), outcome: 'awaiting_payment' })
    ctx.trackAdsConversion('qualified_seller_listing', { ...auction(), listing_id: undefined })
    ctx.trackAdsConversion('qualified_seller_listing', { ...retail(), payment_status: 'pending' })
    ctx.trackAdsConversion('qualified_seller_listing', { ...retail(), seller_role: 'admin' })
    ctx.trackAdsConversion('listing_submitted', auction())
    assert.equal(ctx.sent.length, 0)
})

test('paid retail keeps its existing Ads action but uses a stable short ID, never an oversized Stripe session', () => {
    const ctx = setup()
    const id1 = 'f3e1a204-5c3b-4261-87c0-d4231acdd130'
    const id2 = 'e0bd4aba-204a-4bbb-9b42-49eb6721187c'
    const stripe = 'cs_live_' + 'A'.repeat(85)
    const paid = { listing_id: id1, transaction_id: stripe, value: 1, currency: 'GBP', seller_role: 'SELLER' }
    ctx.trackAdsConversion('listing_fee_paid', paid)
    // Reload/repaid checkout with a new Stripe ID must not recount a vehicle.
    ctx.trackAdsConversion('listing_fee_paid', { ...paid, transaction_id: stripe + '-another-session' })
    ctx.trackAdsConversion('listing_fee_paid', { ...paid, listing_id: id2 })
    assert.equal(ctx.sent.length, 2)
    assert.equal(ctx.sent[0].send_to, 'AW-TEST/EXISTING_PAID_LABEL')
    assert.equal(ctx.sent[0].transaction_id, 'listing_fee:' + id1)
    assert.equal(ctx.sent[1].transaction_id, 'listing_fee:' + id2)
    assert.ok(ctx.sent.every(x => x.transaction_id.length <= 64))
    assert.ok(ctx.sent.every(x => x.value === 1 && x.currency === 'GBP'))
})


test('consented enhanced conversions send a normalised email immediately before the Ads conversion', () => {
    const ctx = setup()
    const paid = {
        listing_id: 'vehicle-email-1',
        value: 1,
        currency: 'GBP',
        seller_role: 'SELLER',
    }
    ctx.trackAdsConversion('listing_fee_paid', paid, { email: ' Seller.Example@Example.COM ' })
    assert.equal(ctx.sent.length, 2)
    assert.deepEqual(ctx.sent[0], {
        action: 'set',
        type: 'user_data',
        email: 'seller.example@example.com',
    })
    assert.equal(ctx.sent[1].action, 'event')
    assert.equal(ctx.sent[1].type, 'conversion')
    assert.equal(ctx.sent[1].send_to, 'AW-TEST/EXISTING_PAID_LABEL')
})

test('analytics boundary withholds enhanced-conversion identifiers without tracking consent', () => {
    assert.match(
        analyticsHookSource,
        /hasTrackingConsent\(\) \? options\.googleAdsUserData : undefined/,
    )
    assert.match(
        analyticsHookSource,
        /trackAdsConversion\([\s\S]*options\.googleAdsUserData[\s\S]*\)/,
    )
})

test('missing and oversized listing IDs never create malformed paid conversion hits', () => {
    const ctx = setup()
    const checkout = { transaction_id: 'cs_live_' + 'B'.repeat(95), value: 1, currency: 'GBP' }
    ctx.trackAdsConversion('listing_fee_paid', checkout)
    ctx.trackAdsConversion('listing_fee_paid', { ...checkout, listing_id: 'A'.repeat(49) })
    ctx.trackAdsConversion('listing_fee_paid', { ...checkout, listing_id: 'invalid/id' })
    assert.equal(ctx.sent.length, 0)
    assert.equal(ctx.listingFeeTrackingId('5ce31506-c6ba-4e9e-b5bc-51cb2106ea25'),
        'listing_fee:5ce31506-c6ba-4e9e-b5bc-51cb2106ea25')
    assert.equal(ctx.listingFeeTrackingId(null), null)
})

test('unexpected oversized qualified listing IDs are also rejected', () => {
    const ctx = setup()
    ctx.trackAdsConversion('qualified_seller_listing', auction('X'.repeat(60)))
    assert.equal(ctx.sent.length, 0)
})

test('unconfigured new label makes no Ads changes, preserving old bidding until explicitly activated', () => {
    const ctx = setup({ qualifiedLabel: null })
    ctx.trackAdsConversion('qualified_seller_listing', auction())
    assert.equal(ctx.sent.length, 0)
    ctx.trackAdsConversion('listing_fee_paid', {
        listing_id: 'abc-456', transaction_id: 'cs_live_' + 'X'.repeat(90), value: 1,
    })
    assert.equal(ctx.sent.length, 1)
    assert.equal(ctx.sent[0].send_to, 'AW-TEST/EXISTING_PAID_LABEL')
    assert.equal(Array.from(ctx.configuredAdsConversions()).includes('qualified_seller_listing'), false)
})

test('auction goal only follows confirmed publish-to-review result, not merely wizard completion', () => {
    assert.match(funnelSource, /QUALIFIED_SELLER_LISTING: 'qualified_seller_listing'/)
    assert.match(wizardSource, /listing_type === 'auction' && outcome === 'pending_review'/)
    assert.match(wizardSource, /SELLER_FUNNEL\.QUALIFIED_SELLER_LISTING/)
    assert.match(wizardSource, /googleAdsUserData: \{ email: user\?\.email \|\| undefined \}/)
    assert.equal((wizardSource.match(/const auctionSubmission = await publishListing\(/g) || []).length, 3)
    assert.equal((wizardSource.match(/auctionSubmission\.pendingReview \? 'pending_review' : 'published'/g) || []).length, 3)
})

test('retail goal only follows verified Stripe LISTING_FEE payment, and retains legacy paid event', () => {
    assert.match(checkoutSource, /data\?\.paymentStatus === 'paid'/)
    assert.match(checkoutSource, /data\.metadata\?\.type === 'LISTING_FEE'/)
    assert.match(checkoutSource, /trackEvent\(SELLER_FUNNEL\.LISTING_FEE_PAID/)
    assert.match(checkoutSource, /googleAdsUserData: \{ email: data\.customerEmail \|\| undefined \}/)
    assert.match(checkoutSource, /listingFeeTrackingId\(data\.metadata\?\.listingId\)/)
    assert.match(checkoutSource, /if \(data\.metadata\?\.listingId && profile\?\.role !== 'ADMIN'\)/)
    assert.match(checkoutSource, /trackEvent\(SELLER_FUNNEL\.QUALIFIED_SELLER_LISTING/)
})


function paymentStatusRunner() {
    const exports = {}
    const js = ts.transpileModule(paymentsSource, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    runInNewContext(js, {
        exports,
        require: () => ({ apiClient: () => { throw Error('Do not make network calls in tests') } }),
        setTimeout,
    })
    return exports.waitForPaidCheckoutSession
}

test('Stripe success retries pending status and sends no paid signal before verified status', async () => {
    const waitForPaid = paymentStatusRunner()
    const seen = []
    const states = [
        { paymentStatus: 'unpaid', metadata: { type: 'LISTING_FEE' } },
        { paymentStatus: 'paid', metadata: { type: 'LISTING_FEE', listingId: 'verified-123' } },
    ]
    const confirmed = await waitForPaid('cs_test_123', async (id) => {
        seen.push(id)
        return states.shift()
    }, 3, 0)
    assert.equal(seen.length, 2)
    assert.equal(confirmed.paymentStatus, 'paid')
    assert.equal(confirmed.metadata.listingId, 'verified-123')
})

test('transient Stripe session-status failure does not permanently lose paid conversion', async () => {
    const waitForPaid = paymentStatusRunner()
    let attempts = 0
    const confirmed = await waitForPaid('cs_test_456', async () => {
        if (++attempts === 1) throw Error('502 upstream')
        return { paymentStatus: 'paid' }
    }, 3, 0)
    assert.equal(attempts, 2)
    assert.equal(confirmed.paymentStatus, 'paid')
})

test('never mark checkout paid without Stripe confirmation; bounded polling', async () => {
    const waitForPaid = paymentStatusRunner()
    let attempts = 0
    const pending = await waitForPaid('cs_test_789', async () => {
        attempts += 1
        return { paymentStatus: 'unpaid' }
    }, 3, 0)
    assert.equal(attempts, 3)
    assert.equal(pending.paymentStatus, 'unpaid')
    assert.equal(await waitForPaid('', async () => ({ paymentStatus: 'paid' }), 3, 0), null)
    assert.match(checkoutSource, /if \(data\?\.paymentStatus !== 'paid'\)/)
    assert.match(checkoutSource, /setConfirmationPending\(true\)/)
    assert.match(checkoutSource, /if \(data\?\.paymentStatus === 'paid' && trackedSessionId\.current !== sessionId\)/)
})

test('already-consented users are not lost during React consent hydration', () => {
    assert.match(analyticsHookSource, /if \(hasTrackingConsent\(\)\) \{/)
    assert.match(analyticsHookSource, /if \(!sessionId\.current\) sessionId\.current = getSessionId\(\)/)
    assert.match(analyticsHookSource, /hasTrackingConsent\(\) \? options\.googleAdsUserData : undefined/)
})
