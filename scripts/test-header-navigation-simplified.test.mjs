// #716 navigation programme: the header must not duplicate the logo's Home link,
// and every remaining destination must stay reachable.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const header = readFileSync("src/components/layout/Header.tsx", "utf8")
const navStart = header.indexOf("const navLinks: NavLink[] = [")
const navBlock = header.slice(navStart, header.indexOf("\n]\n", navStart))

test("the logo is the home link, so the bar has no separate Home item", () => {
    assert.match(header, /<Link href="\/" className="flex items-center" aria-label="CarMazium home">/)
    assert.doesNotMatch(navBlock, /name: "Home"/)
})

test("every other header destination is kept", () => {
    for (const item of ['kind: "buy-menu"', 'kind: "sell-menu"', '{ name: "Get Valuation", href: "/sell" }', 'kind: "trade-menu"', '{ name: "Compare", href: "/compare" }', '{ name: "Pricing", href: "/pricing" }', '{ name: "About", href: "/about" }']) {
        assert.ok(navBlock.includes(item), item)
    }
    for (const href of ['href="/search"', 'href="/auctions/browse"', 'href="/sell?sellMode=retail#sell-options"', 'href="/sell?sellMode=auction#sell-options"', 'href="/download-app"']) {
        assert.ok(header.includes(href), href)
    }
})
