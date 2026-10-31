import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// Dealer mobile UX spec, item 3: on phones the Stock status strip that ran off
// the right-hand edge is replaced by a Status dropdown/panel listing every
// status; the header is Search, Add Vehicle, Status and Sort; Import Listing
// and Bulk Import stay reachable as secondary actions.

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const web = read("src/app/dashboard/dealer/inventory/page.tsx")
const native = read("carmazium app/carmazium app/src/screens/main/DealerInventoryScreen.tsx")
const header = read("src/components/dashboard/PageHeader.tsx")

test("web: phones get a Status dropdown with every status and its count", () => {
    assert.match(web, /const INVENTORY_STATUSES = \["ALL", "ACTIVE", "PENDING_REVIEW", "REJECTED", "DRAFT", "SOLD"\] as const/)
    assert.match(web, /grid grid-cols-2 gap-2 lg:hidden/)
    assert.match(web, /<select\s+value=\{statusFilter\}/)
    assert.match(web, /\{INVENTORY_STATUSES\.map\(s => \(\s*<option key=\{s\} value=\{s\}>/)
    assert.match(web, /\(\{statusCount\(s\)\}\)/)
    // The old strip is desktop-only now and no longer scrolls sideways.
    assert.match(web, /hidden lg:flex gap-2 p-1/)
    assert.doesNotMatch(web, /rounded-xl w-full lg:w-auto overflow-x-auto shrink-0/)
})

test("web: Sort reorders without filtering, with the same options as the app", () => {
    assert.match(web, /value=\{sortBy\}/)
    assert.match(web, /return sortInventory\(rows, sortBy\)/)
    for (const label of ["Newest first", "Price: high to low", "Price: low to high"]) {
        assert.ok(web.includes(`label: "${label}"`), label)
        assert.ok(native.includes(`label: '${label}'`), label)
    }
})

test("web: imports stay reachable but secondary on phones; nothing removed", () => {
    for (const action of ["Import Listing", "Bulk Import", "Add Vehicle"]) assert.ok(web.includes(action), action)
    assert.match(web, /<details className="relative sm:hidden">/)
    assert.equal((web.match(/setIsImportModalOpen\(true\)/g) || []).length, 2, "Import Listing on phone menu and desktop")
    assert.equal((web.match(/setIsBulkImportOpen\(true\)/g) || []).length, 2, "Bulk Import on phone menu and desktop")
    assert.match(web, /hidden sm:inline-flex/)
    assert.ok(web.includes("hasPermission('MANAGE_INVENTORY')"), "permission gate unchanged")
    assert.match(web, /\{canManageInventory && \(\s*<>/)
})

test("web: compact header on phones only", () => {
    assert.match(web, /subHeader=\{DEALER_ROUTE_CONFIG\[1\]\.subHeader\}\s*compact/)
    assert.match(header, /compact \? "mb-3 gap-3 pb-3 md:mb-7 md:gap-5 md:pb-5" : "mb-7 gap-5 pb-5"/)
    assert.match(header, /compact = false/)
})

test("app: Status and Sort buttons open panels; no sideways status strip", () => {
    assert.ok(!/horizontal\s+showsHorizontalScrollIndicator=\{false\}\s+contentContainerStyle=\{styles\.filterScroll\}/.test(native))
    assert.ok(native.includes("statusPanel: { flexDirection: 'row', flexWrap: 'wrap'"))
    assert.ok(native.includes('{FILTERS.map((f) => {'))
    for (const status of ["'All'", "'Live'", "'Under Review'", "'Rejected'", "'Draft'", "'Sold'", "'Sale pending'", "'Other'"]) {
        assert.ok(native.includes(`label: ${status}`), status)
    }
    assert.ok(native.includes("accessibilityState={{ expanded: openPanel === 'sort' }}"))
    assert.ok(native.includes("onPress={() => { setSortOrder(o.value); setOpenPanel(null); }}"))
})

test("app: imports behind one secondary button, still gated", () => {
    assert.ok(native.includes("accessibilityLabel=\"Import options\""))
    assert.ok(native.includes("{canManageInventory && openPanel === 'import' && ("))
    assert.ok(native.includes("setShowImportModal(true)"))
    assert.ok(native.includes("setShowBulkImportModal(true)"))
    assert.ok(native.includes("accessibilityLabel=\"Add Vehicle\""))
})
