import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('buyer collection is scoped to recorded buyer, dealer staff role and settled auction fee',()=>{
  const service=read('backend/src/listings/listings.service.ts')
  const start=service.indexOf('async confirmVehicleCollectedByBuyer(')
  const end=service.indexOf('/** Shared completion',start)
  const code=service.slice(start,end)
  assert.ok(start>0)
  assert.match(code,/sale\.buyerId !== userId/)
  assert.match(code,/actor\.ownerUserId !== sale\.buyerId/)
  assert.match(code,/assertDealerPermission\(actor, 'MANAGE_OFFERS'\)/)
  assert.match(code,/auction\.winnerId !== sale\.buyerId/)
  assert.match(code,/!auction\.buyerFeePaid \|\| !auction\.buyerFeeTransactionId/)
  assert.match(code,/PENDING_COUNTERPARTY.*PENDING_ADMIN.*APPROVED/)
  assert.match(code,/pg_advisory_xact_lock/)
  assert.match(code,/tx\.sale\.updateMany/)
  assert.match(code,/purchaseStatus: 'CHECKS_COMPLETE'/)
  assert.match(code,/tx\.analyticsEvent\.create/)
  assert.match(code,/buyer_vehicle_collected/)
  assert.doesNotMatch(code,/tx\.auction\.update|sellerBonusReleased\s*=|tx\.transaction\.update|serviceJob\.update/)
})

test('API exposes buyer action with authentication and private buyer purchase history',()=>{
  const api=read('backend/src/listings/listings.controller.ts')
  assert.match(api,/@Post\('purchase-sales\/:saleId\/confirm-collection'\)/)
  assert.match(api,/@Get\('my-purchase-sales'\)/)
  assert.match(api,/listingsService\.confirmVehicleCollectedByBuyer\(saleId, user\.id\)/)
  assert.match(api,/listingsService\.getMyRecordedPurchaseSales\(user\.id\)/)
  assert.match(api,/UseGuards\(SessionAuthGuard\)/)
})

test('buyer-collected action is available on dealer card, detail and private buyer purchases',()=>{
  const button=read('src/components/purchases/BuyerCollectedButton.tsx')
  const card=read('src/components/dealer/PipelineRow.tsx')
  const page=read('src/app/dashboard/dealer/purchases/[id]/page.tsx')
  const privateTab=read('src/components/dashboard/PrivatePurchasesTab.tsx')
  assert.match(button,/I've collected this car|I&amp;apos;ve collected this car|I&apost;ve collected this car|I&apos;ve collected this car/)
  assert.match(button,/physically received this vehicle and have paid the seller directly/)
  assert.match(button,/method: "POST"/)
  assert.match(card,/<BuyerCollectedButton saleId=\{item\.id\}/)
  assert.match(card,/item\.buyerCollectedAt/)
  assert.match(page,/<BuyerCollectedButton/)
  assert.match(page,/tab=completed/)
  assert.match(privateTab,/my-purchase-sales/)
  assert.match(privateTab,/<BuyerCollectedButton/)
})

test('completed-stage classification and authentic collection history',()=>{
  const view=read('src/components/dealer/DealerPurchasesView.tsx')
  const statuses=read('src/lib/purchaseDestinations.ts')
  const dealer=read('backend/src/dealers/dealers.service.ts')
  assert.match(view,/onCollected=\{\(\) => setRefreshVersion/)
  assert.match(view,/CHECKS_COMPLETE: "checks_complete"/)
  assert.match(statuses,/PURCHASE_HISTORY_STATUSES = \["sold", "checks_complete", "delivery_requested"\]/)
  assert.match(dealer,/collectedAtBySaleId\.get\(sale\.id\)/)
  assert.match(dealer,/buyerCollectedAt: collectedEvent\?\.createdAt\.toISOString\(\)/)
  assert.doesNotMatch(dealer,/buyerCollectedAt:\s*auction\.handoverSubmittedAt/)
})
