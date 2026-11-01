import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const traderPage = readFileSync(new URL('../src/app/pricing/traders/page.tsx', import.meta.url), 'utf8')
const pricing = readFileSync(new URL('../src/lib/pricingConfig.ts', import.meta.url), 'utf8')

test('verified dealers are clearly shown the shared £1 retail price', () => {
    assert.match(traderPage, /£\{PRICING\.listing\.basic\.price\} per car, one-off until sold/)
    assert.match(traderPage, /Verified dealers pay the same Basic retail listing price as private sellers/)
    assert.match(traderPage, /No compulsory subscription/)
    assert.match(traderPage, /Each published retail car has its own listing fee/)
    assert.match(pricing, /sellerListingFee:\s*1,/)
    assert.match(pricing, /basic:\s*\{\s*price:\s*1,/)
})

test('optional packages and the Basic listing CTA remain accessible', () => {
    assert.match(traderPage, /PRICING\.listing\.standard\.price/)
    assert.match(traderPage, /PRICING\.listing\.premium\.price/)
    assert.match(traderPage, /href="\/sell\?sellMode=retail&package=basic"/)
    assert.match(traderPage, /no CarMazium retail buyer fee/)
})
