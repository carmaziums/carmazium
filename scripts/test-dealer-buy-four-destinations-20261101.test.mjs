import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const dealerMenu = read('src/config/dealerRouteConfig.ts')
const sidebar = read('src/components/dashboard/DashboardSidebar.tsx')
const purchases = read('src/components/dealer/DealerPurchasesView.tsx')
const bids = read('src/app/dashboard/dealer/bids/page.tsx')
const offers = read('src/components/dealer/DealerRetailOffersView.tsx')
const saved = read('src/app/dashboard/dealer/wishlist/page.tsx')
const savedAuctions = read('src/components/dealer/DealerSavedAuctionsView.tsx')
const nativeMenu = read('carmazium app/carmazium app/src/components/GlobalDrawer.tsx')
const nativePurchases = read('carmazium app/carmazium app/src/screens/main/DealerPurchasesScreen.tsx')
const nativeBids = read('carmazium app/carmazium app/src/screens/main/DealerBuyBidScreen.tsx')
const nativeSaved = read('carmazium app/carmazium app/src/screens/main/SavedScreen.tsx')

test('the four Buy destinations and My Auctions under Sell match owner approval', () => {
  for (const name of ['Live Auctions', 'Saved', 'Bids & Offers', 'Purchases']) {
    assert.match(dealerMenu, new RegExp('label: "' + name + '"'))
    assert.match(nativeMenu, new RegExp("section: 'Buy', label: '" + name + "'"))
  }
  assert.match(dealerMenu,/label: "My Auctions"[\s\S]{0,160}section: "Sell"/)
  assert.match(nativeMenu,/section: 'Sell', label: 'My Auctions'/)
  assert.doesNotMatch(dealerMenu,/label: "Buy & Bid"/)
  assert.doesNotMatch(nativeMenu,/section: 'Buy', label: 'My Retail Offers'/)
  assert.match(sidebar,/hasDealerPermission\("VIEW_TRADE"\) \|\| hasDealerPermission\("MANAGE_OFFERS"\)/)
})

test('legacy web addresses redirect to the matching tab, without deleting their actions', () => {
  const expected = {
    'src/app/dashboard/dealer/purchases/history/page.tsx': '/dashboard/dealer/purchases?tab=completed&channel=all',
    'src/app/dashboard/dealer/purchases/retail/page.tsx': '/dashboard/dealer/purchases?tab=progress&channel=retail',
    'src/app/dashboard/dealer/auctions/won/page.tsx': '/dashboard/dealer/purchases?detail=wins&tab=progress&channel=auction',
    'src/app/dashboard/dealer/auctions/shortlisted/page.tsx': '/dashboard/dealer/wishlist?tab=auctions',
    'src/app/dashboard/dealer/my-offers/page.tsx': '/dashboard/dealer/bids?tab=retail',
  }
  for (const [file,to] of Object.entries(expected)) {
    const source=read(file)
    assert.match(source,/import \{ redirect \} from "next\/navigation"/,file)
    assert.ok(source.includes('redirect("' + to + '")'),file)
  }
  assert.match(read('src/app/dashboard/dealer/purchases/page.tsx'),/DealerAuctionWinsView/)
  assert.match(read('src/components/dealer/DealerAuctionWinsView.tsx'),/getWonAuctions/)
  assert.match(read('src/components/dealer/DealerAuctionWinsView.tsx'),/BuyerFeeCountdown/)
  assert.match(read('src/app/dashboard/dealer/layout.tsx'),/searchParams.get\("tab"\) === "retail"/)
})

test('web page UX has one row of stage tabs, compact type chips and retained purchase actions', () => {
  assert.match(purchases,/\["progress","In progress"\]/)
  assert.match(purchases,/\["completed","Completed"\]/)
  assert.match(purchases,/\["cancelled","Cancelled"\]/)
  assert.match(purchases,/\["all","auction","retail"\]/)
  assert.match(purchases,/getMySaleCancellations\("purchase-history"\)/)
  assert.match(purchases,/PendingRetailPurchaseRow/)
  assert.match(purchases,/SaleCancellationModal/)
  assert.match(purchases,/delivery_requested/)
  assert.match(purchases,/Delivery Requested remains under Completed/)
  assert.doesNotMatch(purchases,/<PurchaseDestinations/)
  assert.doesNotMatch(purchases,/<Columns3/)
  assert.match(bids,/params.get\("tab"\) === "retail"/)
  assert.match(offers,/BidsOffersSwitch/)
  assert.doesNotMatch(offers,/<MetricCard/)
  assert.match(saved,/DealerSavedTabs/)
  assert.match(saved,/No longer available/)
  assert.match(savedAuctions,/DealerSavedTabs active="auctions"/)
})

test('native app keeps tabs and payment actions without permission changes', () => {
  assert.match(nativeMenu,/id: 'dealer-live'/)
  assert.match(nativeMenu,/id: 'dealer-wishlist'/)
  assert.match(nativeMenu,/id: 'dealer-bids'/)
  assert.match(nativeMenu,/id: 'dealer-purchases'/)
  assert.match(nativeMenu,/requiredPermission: 'VIEW_PURCHASES'/)
  assert.match(nativeMenu,/requiredPermission: 'MANAGE_OFFERS'/)
  assert.match(nativeBids,/initialSection \|\| 'live'/)
  assert.doesNotMatch(nativeBids,/<ScrollView horizontal/)
  assert.match(nativePurchases,/const stage: PurchaseDestination/)
  assert.match(nativePurchases,/stage === 'cancelled'/)
  assert.match(nativePurchases,/getMySaleCancellations/)
  assert.match(nativePurchases,/HISTORY_STATUSES/)
  assert.match(nativePurchases,/SellerAuctions', \{ initialTab: 'WON'/)
  assert.match(nativePurchases,/CompletePurchaseButton/)
  assert.match(nativeSaved,/savedTab === 'auctions'/)
  assert.match(nativeSaved,/No longer available/)
  const dest=read('carmazium app/carmazium app/src/components/dealer/PurchaseDestinations.tsx')
  for(const label of ['In progress','Completed','Cancelled'])assert.ok(dest.includes(label))
  assert.doesNotMatch(dest,/Auction Wins', icon:/)
})


test('Saved Retail pages are filtered by the API before pagination, not hidden after mixed results', () => {
  const service=read('backend/src/watchlist/watchlist.service.ts')
  const controller=read('backend/src/watchlist/watchlist.controller.ts')
  const api=read('src/lib/listingApi.ts')
  const saved=read('src/app/dashboard/dealer/wishlist/page.tsx')
  assert.match(service,/retailOnly \? \{ userId, listing: \{ type: 'CLASSIFIED' as const \} \} : \{ userId \}/)
  assert.match(service,/findMany\(\{\s*where,/)
  assert.match(service,/count\(\{ where \}\)/)
  assert.match(controller,/type === 'retail'/)
  assert.match(api,/type === 'retail' \? '&type=retail'/)
  assert.match(saved,/getWatchlist\(page, 12, 'retail'\)/)
  assert.match(saved,/No longer available/)
  assert.match(saved,/onClick=\{\(\) => void handleRemove\(item\.listingId\)\}/)
})
