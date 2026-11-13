import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/approvedAuctionAttribution.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function setup({ enabled = true, consent = true, token = 'test-token', ids = true, fail = false } = {}) {
    const sent = []
    const exports = {}
    const state = { consent }
    runInNewContext(js, {
        exports, setTimeout, clearTimeout, AbortSignal,
        process: { env: { NEXT_PUBLIC_APPROVED_AUCTION_ATTRIBUTION: String(enabled),
            NEXT_PUBLIC_API_URL: 'https://api.example.test', NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST' } },
        window: { gtag: (_action, _id, field, callback) => callback(ids ? (field === 'client_id' ? '123.456' : 123456) : undefined) },
        localStorage: { getItem: () => JSON.stringify({ decision: 'accepted', decidedAt: '2026-11-12T12:00:00.000Z' }) },
        require: name => name === './trackingConsent'
            ? { hasTrackingConsent: () => state.consent, TRACKING_CONSENT_STORAGE_KEY: 'test' }
            : { getAccessToken: async () => token },
        fetch: async (url, request) => { if (fail) throw Error('offline'); sent.push({ url, request }); return { ok: true } },
    })
    return { ...exports, sent, state }
}

test('captures only the consented GA identity and verified bearer before publish', async () => {
    const ctx = setup()
    await ctx.captureApprovedAuctionAttribution('listing-1')
    assert.equal(ctx.sent.length, 1)
    assert.deepEqual(JSON.parse(ctx.sent[0].request.body), {
        listingId: 'listing-1', clientId: '123.456', sessionId: '123456', consentAt: '2026-11-12T12:00:00.000Z',
    })
    assert.equal(ctx.sent[0].request.headers.Authorization, 'Bearer test-token')
    assert.equal(ctx.sent[0].request.credentials, 'omit')
})
for (const options of [{ enabled: false }, { consent: false }, { token: null }, { ids: false }]) {
    test(`does not capture when prerequisites are absent: ${JSON.stringify(options)}`, async () => {
        const ctx = setup(options)
        await ctx.captureApprovedAuctionAttribution('listing-1')
        assert.equal(ctx.sent.length, 0)
    })
}
test('rechecks consent after asynchronous identity lookup', async () => {
    const ctx = setup()
    const capture = ctx.captureApprovedAuctionAttribution('listing-1')
    ctx.state.consent = false
    await capture
    assert.equal(ctx.sent.length, 0)
})
test('network failure does not prevent publish or consent withdrawal', async () => {
    const ctx = setup({ fail: true })
    await assert.doesNotReject(ctx.captureApprovedAuctionAttribution('listing-1'))
    await assert.doesNotReject(ctx.revokeApprovedAuctionAttribution())
})
test('withdrawal contacts the server without identifiers or a cookie identity', async () => {
    const ctx = setup({ consent: false })
    await ctx.revokeApprovedAuctionAttribution()
    assert.equal(ctx.sent[0].url, 'https://api.example.test/analytics/auction-attribution/revoke')
    assert.equal(ctx.sent[0].request.credentials, 'omit')
    assert.equal(ctx.sent[0].request.body, undefined)
})
