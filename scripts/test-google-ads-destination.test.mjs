import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const gtm = readFileSync(new URL('../src/components/analytics/GoogleTagManager.tsx', import.meta.url), 'utf8')
const consent = readFileSync(new URL('../src/components/analytics/GoogleConsentMode.tsx', import.meta.url), 'utf8')
const ads = readFileSync(new URL('../src/lib/googleAds.ts', import.meta.url), 'utf8')

test('Google Ads destination is explicitly configured once in the existing GTM queue', () => {
    assert.match(gtm, /NEXT_PUBLIC_GOOGLE_ADS_ID/)
    assert.match(gtm, /ADS_DESTINATION = ADS_ID && \/\^AW-/)
    assert.match(gtm, /window\.gtag\('config', '\$\{ADS_DESTINATION\}', \{ send_page_view: false \}\)/)
    assert.equal((gtm.match(/gtm\.js\?id=/g) || []).length, 1)
    assert.doesNotMatch(gtm, /gtag\/js\?id=/, 'never load a duplicate Google base tag')
    assert.ok(gtm.indexOf('gtm.js?id=') < gtm.indexOf("window.gtag('config'"),
        'destination registration must follow GTM queue initialization')
})

test('consent defaults precede the Google Ads destination registration', () => {
    assert.match(consent, /strategy="beforeInteractive"/)
    assert.match(consent, /'ad_storage': 'denied'/)
    assert.match(consent, /'ad_user_data': 'denied'/)
    assert.match(gtm, /strategy="afterInteractive"/)
})

test('Google Ads conversions still require the genuine qualified listing event', () => {
    assert.match(ads, /QUALIFIED_EVENT = 'qualified_seller_listing'/)
    assert.match(ads, /params\.qualification === 'auction_review'/)
    assert.match(ads, /params\.payment_status === 'paid'/)
    assert.match(ads, /window\.gtag\('event', 'conversion', payload\)/)
})
