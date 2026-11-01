import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const code = ts.transpileModule(read('src/lib/adminListingModeration.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
runInNewContext(code, { exports })
const { getModerationChannel, getModerationPrice, getModerationListingHref } = exports

test('retail listings stay explicitly identified and retail priced', () => {
  const item = { type:'CLASSIFIED', price: 8500, slug: 'retail-car', auction:null }
  assert.equal(getModerationChannel(item),'Retail')
  assert.equal(getModerationPrice(item).value,'£8,500')
  assert.equal(getModerationPrice(item).label,'Retail asking price')
  assert.equal(getModerationListingHref(item),'/buy-cars/retail-car')
})

test('auction listings display starting bid, seller reserve and direct auction destination', () => {
  const item = { type:'AUCTION', price: 2500, slug:'vauxhall-antara-2013-0bea', auction:{
    id:'auction-id', startingBid:'1750', reservePrice:'2200', buyItNowPrice:null,
    status:'ACTIVE',
  }, bids:[] }
  assert.equal(getModerationChannel(item),'Auction')
  assert.equal(getModerationPrice(item).value,'£1,750')
  assert.equal(getModerationPrice(item).label,'Starting bid')
  assert.equal(getModerationPrice(item).detail,'Reserve £2,200')
  assert.equal(getModerationPrice(item).buyNow,null)
  assert.equal(getModerationListingHref(item),'/auctions/live/auction-id')
})

test('auction bid prices cannot be confused with a separate retail valuation', () => {
  const item = { type:'AUCTION', price: 4000, auction:{
    startingBid:1750,reservePrice:2200,buyItNowPrice:3800
  }, bids:[{amount:2400}] }
  assert.equal(getModerationPrice(item).value,'£2,400')
  assert.equal(getModerationPrice(item).label,'Current bid')
  assert.equal(getModerationPrice(item).detail,'Reserve £2,200')
  assert.equal(getModerationPrice(item).buyNow,'Buy It Now £3,800')
})

test('old auction drafts without a schedule must not show the retail price as the starting bid', () => {
  const item = { type:'AUCTION', price:3000, id:'draft-auction-id', auction:null, bids:[] }
  assert.equal(getModerationChannel(item),'Auction')
  assert.equal(getModerationPrice(item).value,'Auction terms unavailable')
  assert.equal(getModerationListingHref(item),'/vehicle/draft-auction-id')
})

test('type filter is applied server-side before data and total count are paginated', () => {
  const admin = read('backend/src/admin/admin.service.ts')
  const controller = read('backend/src/admin/admin.controller.ts')
  const api = read('src/lib/adminApi.ts')
  assert.match(controller,/Query\('listingType'\) listingType\?: string/)
  assert.match(controller,/status, search, listingType\)/)
  assert.match(admin,/Invalid listing type filter/)
  assert.match(admin,/selectedType && selectedType !== 'ALL' \? \{ type: selectedType/)
  assert.match(admin,/listing\.findMany\(\{\s*where/)
  assert.match(admin,/listing\.count\(\{ where \}\)/)
  assert.match(admin,/where: \{ deletedAt: null, cancelledAt: null, archivedAt: null \}/)
  assert.match(admin,/startingBid: true/)
  assert.match(admin,/buyItNowPrice: true/)
  assert.match(api,/query\.set\('listingType', listingType\)/)
})

test('mobile, desktop, and pending queue show channel labels and correct price', () => {
  const page = read('src/app/dashboard/admin/listings/page.tsx')
  const editor = read('src/components/dashboard/ListingEditModal.tsx')
  assert.match(page,/aria-label="Filter by listing type"/)
  assert.match(page,/\['AUCTION', 'Auctions'\]/)
  assert.match(page,/\['CLASSIFIED', 'Retail'\]/)
  assert.match(page,/setPage\(1\); setListingTypeFilter\(value\)/)
  assert.match(page,/searchQuery \|\| undefined,\s*listingTypeFilter/)
  assert.match(page,/pendingListings\.filter\(\(listing\) =>\s*\(listingTypeFilter === 'ALL' \|\| listing\.type === listingTypeFilter\)/)
  assert.ok((page.match(/<ListingChannelPill type=\{l\.type\} \/>/g)||[]).length>=3,
    'render channel in pending review, mobile and desktop rows')
  assert.ok((page.match(/getModerationPrice\(l\)\.value/g)||[]).length>=3)
  assert.ok((page.match(/getModerationListingHref\(l\)/g)||[]).length>=2)
  assert.match(page, /aria-pressed=\{listingTypeFilter === value\}/)
  assert.match(editor,/Listing valuation \(£\) — not the bidding price/)
  assert.match(editor,/Auction Starting Bid, Reserve and Buy It Now are separate settings/)
})

test('moderation type filtering changes no prices, bids, seller roles or financial records', () => {
  const admin = read('backend/src/admin/admin.service.ts')
  assert.match(admin,/Invalid listing type filter/)
  assert.doesNotMatch(read('src/lib/adminListingModeration.ts'),/fetch\(|\\.update\(|\\.delete\(/)
})
