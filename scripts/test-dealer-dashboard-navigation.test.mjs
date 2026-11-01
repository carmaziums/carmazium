import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

// Arrays returned from the vm context belong to another realm, so compare via Array.from.
// Dealer dashboard UX: (1) no dealer option may become unreachable,
// (2) the "Needs your attention" rules behave as specified.

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")

function load(path, modules = {}) {
    const compiled = ts.transpileModule(read(path), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        reportDiagnostics: true,
    })
    assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
    const exports = {}
    const require = name => {
        if (name in modules) return modules[name]
        if (name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) })
        throw new Error("Unexpected import " + name)
    }
    runInNewContext(compiled.outputText, { exports, require }, { filename: path })
    return exports
}

const stage = load("src/lib/auctionSellerStage.ts")
const { DEALER_ROUTE_CONFIG, DEALER_SECTION_ORDER, dealerRouteIsActive, getDealerRoute, sortBySection } = load("src/config/dealerRouteConfig.ts")
const { buildAttentionItems, PROVISIONAL_WINDOW_MS } = load("src/lib/dealerAttention.ts", { "@/lib/auctionSellerStage": stage })
const sidebar = read("src/components/dashboard/DashboardSidebar.tsx")
const tabs = read("src/components/dealer/BuyAndBidTabs.tsx")

// Every dealer destination that existed before the UX pass (main @ 3d25c36).
const EVERY_DEALER_ROUTE = [
    "/dashboard/dealer", "/dashboard/dealer/inventory", "/dashboard/dealer/crm", "/dashboard/dealer/offers",
    "/dashboard/dealer/auctions", "/dashboard/dealer/auctions/won", "/dashboard/cancellations",
    "/dashboard/dealer/messages", "/dashboard/dealer/team", "/profile?section=business", "/dashboard/partner",
    "/dashboard/service/capabilities", "/dashboard/service/jobs", "/dashboard/service/leads",
    "/dashboard/dealer/my-offers", "/dashboard/dealer/bids", "/dashboard/dealer/wishlist",
    "/dashboard/dealer/finance", "/dashboard/dealer/analytics", "/dashboard/dealer/earnings",
]

test("no dealer menu destination was removed", () => {
    const hrefs = DEALER_ROUTE_CONFIG.map(r => r.href)
    // The simplified owner-approved Buy menu keeps a distinct canonical href
    // for each destination. Some historical pages remain directly accessible
    // as tabs/deep links rather than duplicating their menu entries.
    for (const href of EVERY_DEALER_ROUTE) {
        if (href === "/dashboard/dealer/my-offers") {
            assert.match(read("src/app/dashboard/dealer/my-offers/page.tsx"), /redirect\("\/dashboard\/dealer\/bids\?tab=retail"\)/,
                "legacy retail offers must redirect to the new gated retail tab")
            continue
        }
        assert.ok(hrefs.includes(href), "missing original destination " + href)
    }
    for (const href of ["/auctions/browse", "/dashboard/dealer/wishlist",
        "/dashboard/dealer/bids", "/dashboard/dealer/purchases"]) {
        assert.ok(hrefs.includes(href), "missing new canonical Buy destination " + href)
    }
})

test("hidden routes are listed under More tools on desktop and mobile, not dropped", () => {
    assert.match(sidebar, /DEALER_ROUTE_CONFIG\.filter\(route =>\s*route\.hidden && dealerRouteVisible\(route\)/)
    assert.match(sidebar, /More tools/)
    assert.match(sidebar, /\.\.\.currentLinks, \.\.\.dealerMoreLinks/)
    assert.ok(DEALER_ROUTE_CONFIG.filter(r => r.hidden).length >= 10)
})

test("simplified Buy destinations highlight the correct related pages", () => {
    const mine = getDealerRoute("/dashboard/dealer/auctions")
    const live = getDealerRoute("/auctions/browse")
    const saved = getDealerRoute("/dashboard/dealer/wishlist")
    const bids = getDealerRoute("/dashboard/dealer/bids")
    const purchases = getDealerRoute("/dashboard/dealer/purchases")
    assert.ok(dealerRouteIsActive(mine, "/dashboard/dealer/auctions"))
    assert.ok(!dealerRouteIsActive(mine, "/dashboard/dealer/auctions/won"))
    assert.ok(dealerRouteIsActive(live, "/auctions/browse"))
    assert.ok(dealerRouteIsActive(saved, "/dashboard/dealer/auctions/shortlisted"))
    assert.ok(dealerRouteIsActive(bids, "/dashboard/dealer/my-offers"))
    for (const path of ["/dashboard/dealer/purchases",
        "/dashboard/dealer/auctions/won", "/dashboard/cancellations"]) {
        assert.ok(dealerRouteIsActive(purchases, path), "purchase route " + path)
    }
    assert.ok(dealerRouteIsActive(getDealerRoute("/dashboard/dealer/crm"), "/dashboard/dealer/offers"))
    assert.ok(dealerRouteIsActive(getDealerRoute("/dashboard/dealer/inventory"), "/dashboard/dealer/add-listing"))
    assert.ok(!dealerRouteIsActive(getDealerRoute("/dashboard/dealer"), "/dashboard/dealer/crm"))
    assert.ok(!dealerRouteIsActive(live, "/auctions/browse-x"))
})

test("pages read their own titles, not a neighbour's", () => {
    assert.equal(getDealerRoute("/dashboard/dealer/messages").title, "Messages")
    assert.equal(getDealerRoute("/dashboard/dealer/finance").title, "Finance Applications")
    assert.match(read("src/app/dashboard/dealer/messages/page.tsx"), /getDealerRoute\("\/dashboard\/dealer\/messages"\)/)
    assert.match(read("src/app/dashboard/dealer/finance/page.tsx"), /getDealerRoute\("\/dashboard\/dealer\/finance"\)/)
    assert.throws(() => getDealerRoute("/nope"))
})

test("legacy Buy and purchase URLs redirect to their equivalent approved tabs", () => {
    const redirects = [
        ["src/app/dashboard/dealer/my-offers/page.tsx", "/dashboard/dealer/bids?tab=retail"],
        ["src/app/dashboard/dealer/auctions/shortlisted/page.tsx", "/dashboard/dealer/wishlist?tab=auctions"],
        ["src/app/dashboard/dealer/auctions/won/page.tsx", "/dashboard/dealer/purchases?detail=wins&tab=progress&channel=auction"],
    ]
    for (const [path, target] of redirects) {
        const source = read(path)
        assert.ok(source.includes('redirect("' + target + '")'), "broken legacy redirect: " + path)
    }
    for (const label of ["Live Auctions", "Saved", "Bids & Offers", "Purchases"]) {
        assert.ok(DEALER_ROUTE_CONFIG.some(route => route.label === label && route.section === "Buy"), "missing Buy destination " + label)
    }
    assert.equal(DEALER_ROUTE_CONFIG.find(r => r.href === "/dashboard/dealer/auctions").section, "Sell")
})

test("payout link opens the Payouts section", () => {
    const page = read("src/app/dashboard/dealer/auctions/page.tsx")
    assert.ok(page.includes('href="/profile?section=payouts"'))
    assert.ok(!page.includes('href="/dashboard/dealer/settings"'))
})

const NOW = Date.parse("2026-10-29T12:00:00Z")
const ALL = { canManageOffers: true, canViewPurchases: true, canManageInventory: true }
const vehicle = { year: 2019, make: "Ford", model: "Focus", title: "Ford Focus" }

test("attention list: nothing to do gives an empty list", () => {
    assert.equal(buildAttentionItems({ now: NOW, pendingOffers: 0, unreadMessages: 0, wonAuctions: [], myAuctions: [], ...ALL }).length, 0)
})

test("attention list: provisional offer is shown until its 72-hour deadline, then disappears", () => {
    const mine = [{ id: "a1", status: "ENDED", winnerId: null, provisionalOfferBidId: "b1",
        provisionalOfferedAt: new Date(NOW - 10 * 3600_000).toISOString(), listing: vehicle }]
    const [item] = buildAttentionItems({ now: NOW, pendingOffers: 0, unreadMessages: 0, wonAuctions: [], myAuctions: mine, ...ALL })
    assert.equal(item.kind, "provisional")
    assert.equal(item.href, "/auctions/live/a1")
    assert.ok(item.urgent)
    assert.match(item.title, /2019 Ford Focus/)
    const later = NOW + PROVISIONAL_WINDOW_MS
    assert.equal(buildAttentionItems({ now: later, pendingOffers: 0, unreadMessages: 0, wonAuctions: [], myAuctions: mine, ...ALL }).length, 0)
})

test("attention list: unpaid auction win asks for the £125 fee; paid or refused wins do not", () => {
    const won = [
        { id: "w1", status: "ENDED", winnerId: "d", buyerFeePaid: false, buyerFeeDeadlineAt: "2026-10-31T18:00:00Z", listing: vehicle },
        { id: "w2", status: "ENDED", winnerId: "d", buyerFeePaid: true, buyerFeeDeadlineAt: null, listing: vehicle },
        { id: "w3", status: "ENDED", winnerId: "d", buyerFeePaid: false, buyerRefusedAt: "2026-10-28T10:00:00Z", buyerFeeDeadlineAt: "2026-10-31T18:00:00Z", listing: vehicle },
    ]
    const items = buildAttentionItems({ now: NOW, pendingOffers: 0, unreadMessages: 0, wonAuctions: won, myAuctions: [], ...ALL })
    assert.deepEqual(Array.from(items, i => i.key), ["fee-w1"])
    assert.match(items[0].detail, /Sat 31 Oct/) // shown in UK time
})

test("attention list: offers, handovers and messages, in urgency order", () => {
    const mine = [{ id: "s1", status: "ENDED", winnerId: "buyer", buyerFeePaid: true, sellerFundsConfirmedAt: null, listing: vehicle }]
    const items = buildAttentionItems({ now: NOW, pendingOffers: 2, unreadMessages: 1, wonAuctions: [], myAuctions: mine, ...ALL })
    assert.deepEqual(Array.from(items, i => i.kind), ["offers", "handovers", "messages"])
    assert.equal(items[0].title, "2 buyer offers are waiting for your reply")
    assert.equal(items[2].title, "1 unread message")
})

test("attention list respects team permissions", () => {
    const items = buildAttentionItems({
        now: NOW, pendingOffers: 3, unreadMessages: 0, wonAuctions: [], myAuctions: [],
        canManageOffers: false, canViewPurchases: false, canManageInventory: false,
    })
    assert.equal(items.length, 0)
})

test("dealer menu and bottom bar use the same names as the phone app", () => {
    assert.equal(getDealerRoute("/dashboard/dealer/inventory").label, "Stock")
    assert.equal(getDealerRoute("/dashboard/dealer/inventory").title, "Stock")
    assert.equal(getDealerRoute("/dashboard/dealer/auctions").label, "My Auctions")
    assert.equal(getDealerRoute("/auctions/browse").label, "Live Auctions")
    assert.equal(getDealerRoute("/dashboard/dealer/wishlist").label, "Saved")
    assert.equal(getDealerRoute("/dashboard/dealer/bids").label, "Bids & Offers")
    assert.equal(getDealerRoute("/dashboard/dealer/purchases").label, "Purchases")
    // Expandable phone-menu rows read the label from config, not a hard-coded copy.
    assert.ok(!sidebar.includes('font-medium">Stock<'))
    assert.ok(!sidebar.includes('font-medium">Buy &amp; Bid<'))
})

test("dealer menu groups are Sell, Buy, Business, Services, each heading shown once", () => {
    assert.deepEqual([...DEALER_SECTION_ORDER], ["Dashboard", "Sell", "Buy", "Business", "Services"])
    const sections = sortBySection([...DEALER_ROUTE_CONFIG]).map(r => r.section)
    const runs = sections.filter((s, i) => s !== sections[i - 1])
    assert.deepEqual(runs, [...DEALER_SECTION_ORDER], runs.join(","))
    assert.ok(DEALER_ROUTE_CONFIG.every(r => DEALER_SECTION_ORDER.includes(r.section)))
    assert.match(sidebar, /sortBySection\(\[\.\.\.currentLinks, \.\.\.dealerMoreLinks\]\)/)
    assert.ok(!/dealerMoreLinks\.map\(link => \(\{ \.\.\.link, section: `More tools/.test(sidebar))
})

test("dealer sidebar loads team permissions on pages outside the dealer layout", () => {
    assert.match(sidebar, /props\.role === "dealer" && !provided/)
    assert.match(sidebar, /<DealerAccessProvider>\s*<DashboardSidebarInner/)
})

test("purchase-only staff retain the Purchases menu and historical auction-win deep link", () => {
    const purchases = getDealerRoute("/dashboard/dealer/purchases")
    const wins = getDealerRoute("/dashboard/dealer/auctions/won")
    assert.equal(purchases.requiredPermission, "VIEW_PURCHASES")
    assert.equal(wins.requiredPermission, "VIEW_PURCHASES")
    assert.ok(!purchases.hidden)
    assert.ok(dealerRouteIsActive(purchases, "/dashboard/dealer/auctions/won"))
    assert.match(sidebar, /dealerRouteVisible\(route\)/)
    assert.ok(read("src/app/dashboard/dealer/auctions/won/page.tsx").includes("channel=auction"))
})

test("Bids & offers uses separate permission-gated auction and retail tabs", () => {
    const sw = read("src/components/dealer/BidsOffersSwitch.tsx")
    assert.ok(sw.includes('/dashboard/dealer/bids?tab=auction'))
    assert.ok(sw.includes('/dashboard/dealer/bids?tab=retail'))
    assert.ok(sw.includes('permission: "VIEW_TRADE"'))
    assert.ok(sw.includes('permission: "MANAGE_OFFERS"'))
    assert.ok(sw.includes('!loading && hasPermission(v.permission)'))
    const bids = read("src/app/dashboard/dealer/bids/page.tsx")
    assert.ok(bids.includes('params.get("tab") === "retail" ? <DealerRetailOffersView /> : <AuctionBidsContent />'))
    assert.ok(bids.includes('<BidsOffersSwitch />'))
    const retail = read("src/components/dealer/DealerRetailOffersView.tsx")
    assert.ok(retail.includes('<BidsOffersSwitch />'))
    assert.ok(retail.includes('getMyOffers()'))
    const hub = read("carmazium app/carmazium app/src/screens/main/DealerBuyBidScreen.tsx")
    assert.ok(hub.includes("label: 'Bids & offers'"))
    assert.ok(hub.includes("navigation?.navigate('DealerMyOffers', { fromBidsOffers: true })"))
})

test("trade-only and retail-only team staff retain distinct permission gates", () => {
    const { bidsOffersTabHref } = load("src/lib/dealerBidsOffersNavigation.ts")
    assert.equal(bidsOffersTabHref(true, true), "/dashboard/dealer/bids")
    assert.equal(bidsOffersTabHref(true, false), "/dashboard/dealer/bids")
    assert.equal(bidsOffersTabHref(false, true), "/dashboard/dealer/my-offers")
    assert.equal(bidsOffersTabHref(false, false), null)
    const dealerLayout = read("src/app/dashboard/dealer/layout.tsx")
    assert.ok(dealerLayout.includes('permission = pathname === "/dashboard/dealer/bids" && searchParams.get("tab") === "retail"'))
    assert.ok(dealerLayout.includes('? "MANAGE_OFFERS" : match[1]'))
    assert.ok(dealerLayout.includes('["/dashboard/dealer/bids", "VIEW_TRADE"]'))
    assert.ok(dealerLayout.includes('["/dashboard/dealer/my-offers", "MANAGE_OFFERS"]'))
})

test("retail offers do not load auction positions for staff without VIEW_TRADE", () => {
    const retail = read("src/components/dealer/DealerRetailOffersView.tsx")
    assert.ok(retail.includes('const canViewTrade = !accessLoading && hasPermission("VIEW_TRADE")'))
    assert.ok(retail.includes('canViewTrade ? getMyActiveAuctionBids().catch(() => []) : Promise.resolve([])'))
    assert.ok(retail.includes('getMyOffers()'))
})
