import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')
const exports = {}
const compiled=ts.transpileModule(read('src/lib/adminListingModeration.ts'),{
  compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 },
}).outputText
runInNewContext(compiled,{exports,Intl,Date})
const {getModerationListingDates} = exports

test('admin first listed date comes from immutable creation record not updatedAt',()=>{
  const value=getModerationListingDates({
    firstListingRecordAt:'2026-10-30T19:10:17.317Z',
    updatedAt:'2026-11-01T15:49:30.963Z',
  })
  assert.equal(value.firstListed,'30 Oct 2026')
  assert.equal(value.lastRelisted,null)
})

test('admin relist event appears on the same card alongside original record date',()=>{
  const value=getModerationListingDates({
    createdAt:'2026-10-03T08:00:00.000Z',
    lastRelistedAt:'2026-11-01T11:15:00.000Z',
    updatedAt:'2026-11-01T15:45:00.000Z',
  })
  assert.equal(value.firstListed,'03 Oct 2026')
  assert.equal(value.lastRelisted,'01 Nov 2026')
})

test('bad or absent date never displays bogus 1970/relist timestamp',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(getModerationListingDates({}))),{firstListed:null,lastRelisted:null})
  assert.equal(getModerationListingDates({createdAt:'invalid'}).firstListed,null)
})

test('admin list resolves latest authentic relist events without N+1 lookup',()=>{
  const service=read('backend/src/admin/admin.service.ts')
  const start=service.indexOf('async getAllListings(')
  const end=service.indexOf('async relistDraftAsAuction(',start)
  const section=service.slice(start,end)
  assert.match(section,/type:\s*\{\s*in:\s*\['admin_draft_auction_relist', 'seller_listing_relisted'\]/)
  assert.match(section,/OR:\s*data\.map\(listing\s*=>/)
  assert.match(section,/payload:\s*\{\s*path:\s*\['listingId'\], equals: listing\.id/)
  assert.match(section,/orderBy:\s*\{\s*createdAt: 'desc'\s*\}/)
  assert.match(section,/lastRelistedById\.has\(id\)/)
  assert.match(section,/firstListingRecordAt: listing\.createdAt/)
  assert.match(section,/lastRelistedAt: lastRelistedById\.get\(listing\.id\) \?\? null/)
  assert.doesNotMatch(section,/lastRelistedAt: listing\.updatedAt/)
  assert.doesNotMatch(section,/lastRelistedAt: listing\.auction\.startTime/)
})

test('seller withdrawn-to-active relisting records an audited event atomically',()=>{
  const src=read('backend/src/listings/listings.service.ts')
  assert.match(src,/status === 'ACTIVE' && listing\.status === 'WITHDRAWN'/)
  assert.match(src,/type: 'seller_listing_relisted'/)
  assert.match(src,/await tx\.analyticsEvent\.create\(/)
  assert.match(src,/tx\.listing\.updateMany\(\{\s*where: \{ id, status: 'WITHDRAWN', deletedAt: null \}/)
  assert.match(src,/throw new ConflictException\('This listing changed/)
})

test('all admin listing surfaces show dates; missing relists are hidden',()=>{
  const src=read('src/app/dashboard/admin/listings/page.tsx')
  assert.match(src,/getModerationListingDates\(listing\)/)
  assert.ok((src.match(/<ListingHistoryDates listing=\{l\} \/>/g)||[]).length>=3)
  assert.match(src,/\{lastRelisted && \(/)
  assert.match(src,/First listed:/)
  assert.match(src,/Relisted:/)
  assert.match(src,/Older listings may have gone live after this date/)
})
