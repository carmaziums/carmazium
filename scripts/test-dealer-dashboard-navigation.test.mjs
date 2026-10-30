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
    for (const href of EVERY_DEALER_ROUTE) assert.ok(hrefs.includes(href), "missing " + href)
    // The previously unlinked purchase history page is now in the menu too.
    assert.ok(hrefs.includes("/dashboard/dealer/purchases"))
})

test("hidden routes are listed under More tools on desktop and mobile, not dropped", () => {
    assert.match(sidebar, /DEALER_ROUTE_CONFIG\.filter\(route =>\s*route\.hidden && dealerRouteVisible\(route\)/)
    assert.match(sidebar, /More tools/)
    assert.match(sidebar, /\.\.\.currentLinks, \.\.\.dealerMoreLinks/)
    assert.ok(DEALER_ROUTE_CONFIG.filter(r => r.hidden).length >= 10)
})

test("menu items stay highlighted on their related pages", () => {
    const buy = getDealerRoute("/dashboard/dealer/auctions")
    for (const p of ["/dashboard/dealer/auctions", "/dashboard/dealer/auctions/won", "/dashboard/dealer/auctions/shortlisted", "/dashboard/dealer/bids"]) {
        assert.ok(dealerRouteIsActive(buy, p), p)
    }
    // Purchase History has been its own menu item since PR #697.
    assert.ok(dealerRouteIsActive(getDealerRoute("/dashboard/dealer/purchases"), "/dashboard/dealer/purchases"))
    assert.ok(dealerRouteIsActive(getDealerRoute("/dashboard/dealer/crm"), "/dashboard/dealer/offers"))
    assert.ok(dealerRouteIsActive(getDealerRoute("/dashboard/dealer/inventory"), "/dashboard/dealer/add-listing"))
    // Home must not light up for every dealer page.
    assert.ok(!dealerRouteIsActive(getDealerRoute("/dashboard/dealer"), "/dashboard/dealer/crm"))
    assert.ok(!dealerRouteIsActive(buy, "/dashboard/dealer/auctionsx"))
})

test("pages read their own titles, not a neighbour's", () => {
    assert.equal(getDealerRoute("/dashboard/dealer/messages").title, "Messages")
    assert.equal(getDealerRoute("/dashboard/dealer/finance").title, "Finance Applications")
    assert.match(read("src/app/dashboard/dealer/messages/page.tsx"), /getDealerRoute\("\/dashboard\/dealer\/messages"\)/)
    assert.match(read("src/app/dashboard/dealer/finance/page.tsx"), /getDealerRoute\("\/dashboard\/dealer\/finance"\)/)
    assert.throws(() => getDealerRoute("/nope"))
})

test("Buy & Bid tabs appear on every page in that area and keep all previous tabs", () => {
    for (const label of ["My Auctions", "Live Auctions", "Shortlisted", "My Bids", "Auction Wins", "All Purchases"]) {
        assert.ok(tabs.includes(`label: "${label}"`), label)
    }
    // Purchase History became its own menu item in PR #697 and no longer repeats this bar.
    for (const page of ["auctions/page.tsx", "auctions/shortlisted/page.tsx", "bids/page.tsx", "auctions/won/page.tsx"]) {
        assert.match(read("src/app/dashboard/dealer/" + page), /<BuyAndBidTabs/, page)
    }
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
    assert.equal(getDealerRoute("/dashboard/dealer/auctions").label, "Buy & Bid")
    // Page title matches the phone app's Buy & Bid hub ("Auctions & Buying").
    assert.equal(getDealerRoute("/dashboard/dealer/auctions").title, "Auctions & Buying")
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

test("purchase-only staff retain a link to Auction Wins even without VIEW_TRADE", () => {
    const won = getDealerRoute("/dashboard/dealer/auctions/won")
    const hub = getDealerRoute("/dashboard/dealer/auctions")
    assert.equal(won.requiredPermission, "VIEW_PURCHASES")
    assert.equal(hub.requiredPermission, "VIEW_TRADE")
    // The Buy & Bid hub disappears without VIEW_TRADE; its hidden purchase
    // destination must therefore stay inside More tools for purchase staff.
    assert.match(sidebar, /!hasDealerPermission\('VIEW_TRADE'\)/)
    assert.match(sidebar, /BUY_AND_BID_TABS\.some\(tab => tab\.href === route\.href\)/)
})

