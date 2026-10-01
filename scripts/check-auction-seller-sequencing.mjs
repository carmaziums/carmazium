// Run after npm ci at the repo root: node scripts/check-auction-seller-sequencing.mjs
// Exercise the real shared presentation logic and enforce web/native parity.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const web = readFileSync(resolve('src/lib/auctionSellerStage.ts'), 'utf8')
const native = readFileSync(resolve('carmazium app/carmazium app/src/lib/auctionSellerStage.ts'), 'utf8')
assert.equal(native, web, 'Seller progression logic must be identical on website and native app')

function load(source) {
    const output = ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
    }}).outputText
    const exports = {}
    new Function('exports', output)(exports)
    return exports
}

const { getSellerAuctionStage, getSellerStageLabel, getSellerStageHint } = load(web)
const base = { status: 'ENDED', winnerId: 'buyer', buyerFeePaid: true,
    sellerFundsConfirmedAt: '2026-10-01T12:00:00Z' }
const cases = [
    [{ ...base, status: 'ACTIVE' }, 'NOT_APPLICABLE'],
    [{ ...base, winnerId: null }, 'NOT_APPLICABLE'],
    [{ ...base, buyerFeePaid: false }, 'WAITING_BUYER_FEE'],
    [{ ...base, sellerFundsConfirmedAt: null }, 'ARRANGE_INSPECTION_PAYMENT'],
    [{ ...base }, 'READY_FOR_HANDOVER'],
    [{ ...base, handoverRejectedAt: '2026-10-01T14:00:00Z' }, 'CORRECT_PROOF'],
    [{ ...base, handoverSubmittedAt: '2026-10-01T14:00:00Z',
        handoverRejectedAt: '2026-10-01T13:00:00Z' }, 'PROOF_UNDER_REVIEW'],
    [{ ...base, buyerFeePaid: false, sellerFundsConfirmedAt: null,
        handoverSubmittedAt: '2026-09-01T12:00:00Z' }, 'PROOF_UNDER_REVIEW'],
    [{ ...base, sellerBonusReleased: true }, 'PAYOUT_PROCESSING'],
    [{ ...base, sellerBonusReleased: true, stripePayoutTransferId: 'claim:seller-bonus:auction' }, 'PAYOUT_PROCESSING'],
    [{ ...base, sellerBonusReleased: true, stripePayoutTransferId: 'tr_real' }, 'BONUS_PAID'],
    [{ ...base, sellerBonusReleased: true, manualPayoutConfirmedAt: '2026-10-01T16:00:00Z' }, 'BONUS_PAID'],
    [{ ...base, buyerRefusedAt: '2026-10-01T12:00:00Z' }, 'INSPECTION_REFUSED'],
]
for (const [auction, expected] of cases) {
    const stage = getSellerAuctionStage(auction)
    assert.equal(stage, expected, JSON.stringify(auction))
    assert.ok(getSellerStageLabel(stage))
    assert.ok(getSellerStageHint(stage) || stage === 'NOT_APPLICABLE')
}
const webUI = readFileSync(resolve('src/app/dashboard/seller/auctions/page.tsx'), 'utf8')
const mobileUI = readFileSync(resolve('carmazium app/carmazium app/src/screens/seller/SellerAuctionsScreen.tsx'), 'utf8')
for (const [name, source] of [['web', webUI], ['mobile', mobileUI]]) {
    assert.match(source, /getSellerAuctionStage\(/, name + ' must use stage resolver')
    assert.match(source, /getSellerStageHint\(/, name + ' must render next-step hint')
    assert.match(source, /getSellerStageLabel\(/, name + ' must render accurate stage label')
}
const resultsUI = readFileSync(resolve('src/components/auctions/AuctionResultsModal.tsx'), 'utf8')
assert.match(resultsUI, /auction\.winnerId && auction\.buyerFeePaid && !auction\.buyerRefusedAt/,
    'Web results must not unlock contact while the buyer fee is unpaid or inspection refused')
assert.match(mobileUI, /resultsAuction\.winnerId && resultsAuction\.buyerFeePaid && !resultsAuction\.buyerRefusedAt/,
    'Native results must not unlock contact while the buyer fee is unpaid or inspection refused')
console.log('Auction seller sequencing: 13 stage cases, contact gating and web/native parity passed.')
