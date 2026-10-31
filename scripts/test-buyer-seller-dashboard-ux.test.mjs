import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

// Buyer/seller dashboard UX: (1) no buyer or seller option may become
// unreachable, (2) the "Needs your attention" rules behave as specified.
// Arrays from the vm context belong to another realm, so compare via Array.from.

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
        throw new Error("Unexpected import " + name)
    }
    runInNewContext(compiled.outputText, { exports, require }, { filename: path })
    return exports
}

const stage = load("src/lib/auctionSellerStage.ts")
const dealerAttention = load("src/lib/dealerAttention.ts", { "@/lib/auctionSellerStage": stage })
const { buildUserAttentionItems } = load("src/lib/userAttention.ts", {
    "@/lib/auctionSellerStage": stage,
    "@/lib/dealerAttention": dealerAttention,
})
const sidebar = read("src/components/dashboard/DashboardSidebar.tsx")
const dashboard = read("src/app/dashboard/user/page.tsx")

// Every buyer/seller menu destination before this change (main @ 238b930).
const EVERY_USER_MENU_HREF = [
    // #704 merged My Listings + My Auctions into My cars (tab=cars); old
    // tab=inventory links are mapped to it and /dashboard/seller/auctions stays
    // reachable (highlighted under My cars, and via ?manage=1 for the manager).
    "/dashboard/user?tab=overview", "/services/jobs", "/dashboard/user?tab=cars",
    "/dashboard/user?tab=offers", "/dashboard/user?tab=earnings",
    "/dashboard/user?tab=stats", "/dashboard/user?tab=bids", "/dashboard/user?tab=watchlist",
    "/dashboard/cancellations", "/dashboard/user?tab=messages", "/profile",
]

test("no buyer/seller menu destination was removed", () => {
    for (const href of EVERY_USER_MENU_HREF) assert.ok(sidebar.includes(`href: "${href}"`), "missing " + href)
    assert.ok(sidebar.includes('"/dashboard/seller/auctions"'), "auctions still highlighted under My cars")
    assert.match(dashboard, /rawTab === "inventory" \? "cars"/)
    assert.ok(read("src/components/dashboard/MyCarsAuctionPanel.tsx").includes("/dashboard/seller/auctions?manage=1"))
})

test("tools that only existed on standalone pages stay reachable (now via ?legacy=1 links)", () => {
    // #704 removed the duplicate "More tools" links; each specialist page is
    // linked from the matching dashboard tab and kept by LegacyDashboardRedirect.
    for (const href of ["/dashboard/seller/offers?legacy=1", "/dashboard/seller/earnings?legacy=1", "/dashboard/buyer/offers?legacy=1"]) {
        assert.ok(dashboard.includes(`href="${href}"`), href)
    }
    assert.ok(sidebar.includes('href: "/dashboard/user?tab=purchases"'), "buyer history lives under Purchases")
    assert.match(read("src/components/dashboard/LegacyDashboardRedirect.tsx"), /search\.get\("legacy"\) === "1"/)
})

test("standalone pages opened from notifications keep the right menu item highlighted", () => {
    for (const prefix of ["/dashboard/seller/offers", "/dashboard/buyer/offers", "/dashboard/buyer/messages", "/dashboard/seller/messages", "/dashboard/seller/earnings", "/dashboard/buyer/watchlist"]) {
        assert.ok(sidebar.includes(`"${prefix}"`), prefix)
    }
    assert.match(sidebar, /activePrefixes: \["\/dashboard\/buyer\/messages", "\/dashboard\/seller\/messages"\]/)
})

test("mobile bottom bar includes Messages; Saved Cars stays reachable from More", () => {
    const block = sidebar.split("const sellerMobileHrefs = [")[1].split("]")[0]
    assert.ok(block.includes('"/dashboard/user?tab=messages"'))
    assert.ok(!block.includes('"/dashboard/user?tab=watchlist"'))
    // Everything not in the bottom bar is listed in the More panel.
    assert.match(sidebar, /currentLinks\.filter\(link => !primaryMobileHrefs\.includes\(link\.href\)\)/)
})

test("page headings match the menu and offer links to delivery requests and receipts", () => {
    for (const heading of [">My cars<", ">Offers Received<", ">My Offers<", ">Listing Performance<", ">Sales & Earnings<", ">Saved Cars<"]) {
        assert.ok(dashboard.includes(heading), heading)
    }
    assert.ok(dashboard.includes('href="/dashboard/seller/offers?legacy=1"'))
    assert.ok(dashboard.includes('href="/dashboard/buyer/offers?legacy=1"'))
    assert.ok(dashboard.includes('href="/dashboard/seller/earnings?legacy=1"'))
    assert.match(dashboard, /<UserAttentionPanel data=\{data\} loading=\{loading\} \/>/)
    // Existing overview actions are all still there.
    for (const kept of ['href="/sell"', 'href="/search"', "setTab('bids')", "setTab('messages')", "setTab('offers')", "setTab('earnings')", "setTab('watchlist')"]) {
        assert.ok(dashboard.includes(kept), kept)
    }
})

const NOW = Date.parse("2026-10-29T12:00:00Z")
const car = { year: 2018, make: "Vauxhall", model: "Corsa", title: "Vauxhall Corsa" }
const base = { now: NOW, myAuctions: [], incomingOffers: 0, counterOffersAwaitingMe: 0, pendingDeliveryRequests: 0, unreadMessages: 0 }

test("to-do list: nothing to do gives an empty list", () => {
    assert.equal(buildUserAttentionItems(base).length, 0)
})

test("to-do list: provisional auction decision is first, urgent, and expires after 72 hours", () => {
    const myAuctions = [{ id: "a9", status: "ENDED", winnerId: null, provisionalOfferBidId: "b",
        provisionalOfferedAt: new Date(NOW - 3600_000).toISOString(), listing: car }]
    const items = buildUserAttentionItems({ ...base, myAuctions, unreadMessages: 2 })
    assert.equal(items[0].kind, "provisional")
    assert.equal(items[0].href, "/auctions/live/a9")
    assert.ok(items[0].urgent)
    assert.match(items[0].title, /2018 Vauxhall Corsa/)
    assert.equal(buildUserAttentionItems({ ...base, myAuctions, now: NOW + 72 * 3600_000 }).length, 0)
})

test("to-do list: sold-at-auction handover step points to My Auctions", () => {
    const myAuctions = [{ id: "s1", status: "ENDED", winnerId: "dealer", buyerFeePaid: true, sellerFundsConfirmedAt: null, listing: car }]
    const [item] = buildUserAttentionItems({ ...base, myAuctions })
    assert.equal(item.kind, "handover")
    assert.equal(item.href, "/dashboard/seller/auctions")
})

test("to-do list: offers, counter-offers, delivery requests and messages, in order", () => {
    const items = buildUserAttentionItems({ ...base, incomingOffers: 1, counterOffersAwaitingMe: 2, pendingDeliveryRequests: 1, unreadMessages: 3 })
    assert.deepEqual(Array.from(items, i => i.kind), ["incomingOffers", "counterOffers", "deliveryRequests", "messages"])
    assert.equal(items[0].title, "1 buyer offer is waiting for your reply")
    assert.equal(items[1].title, "2 sellers replied to your offers with a new price")
    assert.equal(items[1].href, "/dashboard/user?tab=bids")
    assert.equal(items[2].href, "/dashboard/seller/offers")
    assert.equal(items[3].title, "3 unread messages")
})
