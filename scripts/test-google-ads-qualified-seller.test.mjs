import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const adsSource = readFileSync(new URL('../src/lib/googleAds.ts', import.meta.url), 'utf8')
const wizardSource = readFileSync(new URL('../src/components/listing/ListingWizard.tsx', import.meta.url), 'utf8')
const checkoutSource = readFileSync(new URL('../src/app/checkout/success/page.tsx', import.meta.url), 'utf8')
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

test('existing paid retail action continues to work and deduplicates per Stripe session', () => {
    const ctx = setup()
    const paid = { transaction_id: 'cs_123', value: 1, currency: 'GBP', seller_role: 'SELLER' }
    ctx.trackAdsConversion('listing_fee_paid', paid)
    ctx.trackAdsConversion('listing_fee_paid', paid)
    assert.equal(ctx.sent.length, 1)
    assert.equal(ctx.sent[0].send_to, 'AW-TEST/EXISTING_PAID_LABEL')
    assert.equal(ctx.sent[0].transaction_id, 'cs_123')
    assert.equal(ctx.sent[0].value, 1)
})

test('unconfigured new label makes no Ads changes, preserving old bidding until explicitly activated', () => {
    const ctx = setup({ qualifiedLabel: null })
    ctx.trackAdsConversion('qualified_seller_listing', auction())
    assert.equal(ctx.sent.length, 0)
    ctx.trackAdsConversion('listing_fee_paid', { transaction_id: 'cs_456', value: 1 })
    assert.equal(ctx.sent.length, 1)
    assert.equal(ctx.sent[0].send_to, 'AW-TEST/EXISTING_PAID_LABEL')
    assert.equal(Array.from(ctx.configuredAdsConversions()).includes('qualified_seller_listing'), false)
})

test('auction goal only follows confirmed publish-to-review result, not merely wizard completion', () => {
    assert.match(funnelSource, /QUALIFIED_SELLER_LISTING: 'qualified_seller_listing'/)
    assert.match(wizardSource, /listing_type === 'auction' && outcome === 'pending_review'/)
    assert.match(wizardSource, /SELLER_FUNNEL\.QUALIFIED_SELLER_LISTING/)
    assert.equal((wizardSource.match(/const auctionSubmission = await publishListing\(/g) || []).length, 3)
    assert.equal((wizardSource.match(/auctionSubmission\.pendingReview \? 'pending_review' : 'published'/g) || []).length, 3)
})

test('retail goal only follows verified Stripe LISTING_FEE payment, and retains legacy paid event', () => {
    assert.match(checkoutSource, /data\?\.paymentStatus === 'paid'/)
    assert.match(checkoutSource, /data\.metadata\?\.type === 'LISTING_FEE'/)
    assert.match(checkoutSource, /trackEvent\(SELLER_FUNNEL\.LISTING_FEE_PAID/)
    assert.match(checkoutSource, /if \(data\.metadata\?\.listingId && profile\?\.role !== 'ADMIN'\)/)
    assert.match(checkoutSource, /trackEvent\(SELLER_FUNNEL\.QUALIFIED_SELLER_LISTING/)
})
