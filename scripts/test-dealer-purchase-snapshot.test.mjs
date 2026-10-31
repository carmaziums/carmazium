import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// Purchase-time listing snapshots and inspection notes (owner spec item 1).
// Ships switched off: nothing reads or writes the new tables until the owner
// applies the migration and sets PURCHASE_SNAPSHOTS_ENABLED=true.

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const APP = "carmazium app/carmazium app/src/"

test("migration is additive, idempotent, RLS-locked and documented as unapplied", () => {
    const sql = read("backend/prisma/migrations/20261031120000_purchase_snapshots_inspection_notes/migration.sql")
    assert.match(sql, /NOT YET APPLIED ANYWHERE/)
    assert.match(sql, /CREATE TABLE IF NOT EXISTS "purchase_listing_snapshots"/)
    assert.match(sql, /CREATE TABLE IF NOT EXISTS "purchase_inspection_notes"/)
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
    assert.doesNotMatch(sql, /\b(DROP|DELETE|UPDATE|TRUNCATE|ALTER TABLE "(sales|listings|auctions)")\b/i)
})

test("backend gate: off by default, capture is post-commit, first capture wins", () => {
    const record = read("backend/src/dealers/purchase-listing-record.ts")
    assert.match(record, /process\.env\.PURCHASE_SNAPSHOTS_ENABLED === 'true'/)
    assert.match(record, /update: \{\},/)
    assert.match(record, /where: \{ saleId: sale\.id \}/)
    assert.match(record, /RETRY_DELAYS_MS = \[1_000, 5_000\]/)
    assert.match(read("backend/src/tasks/purchase-snapshot-sweep.service.ts"), /@Cron\('\*\/10 \* \* \* \*'\)/)
    assert.match(read("backend/src/tasks/tasks.module.ts"), /PurchaseSnapshotSweepService,/)
    const sql = read("backend/prisma/migrations/20261031120000_purchase_snapshots_inspection_notes/migration.sql")
    assert.match(sql, /purchase_listing_snapshots_saleId_key"\s+ON "purchase_listing_snapshots" \("saleId"\)/)
    assert.match(record, /sale\.buyerId !== buyerId\) return true/)
    for (const forbidden of ["email", "phone", "address", "payout", "stripe"]) {
        assert.ok(!new RegExp(`\\b${forbidden}\\b`, "i").test(record.split("LISTING_RECORD_SELECT")[1].split("} as const")[0]), forbidden)
    }
    const auctions = read("backend/src/auctions/auctions.service.ts")
    const listings = read("backend/src/listings/listings.service.ts")
    // Seller-accepted offer, admin-assigned winner, Buy It Now, and the
    // normal timed/early close (a single SQL statement that inserts the Sale).
    assert.equal((auctions.match(/void capturePurchaseSnapshot\(this\.prisma/g) || []).length, 4)
    assert.match(auctions, /if \(row\.sale_completed && row\.winner_id && row\.listing_id\) \{\s*void capturePurchaseSnapshot\(this\.prisma, \{ listingId: row\.listing_id, buyerId: row\.winner_id \}\)/)
    // That capture runs after the statement and its consistency check, not inside it.
    const close = auctions.split("sale_created AS (")[1]
    assert.ok(close.indexOf("void capturePurchaseSnapshot") > close.indexOf("The auction changed while it was being finalised"))
    assert.equal((listings.match(/void capturePurchaseSnapshot\(this\.prisma/g) || []).length, 1)
    // Captures never run inside a sale transaction (a failure there would roll the sale back).
    for (const src of [auctions, listings]) {
        for (const m of src.matchAll(/\n        void capturePurchaseSnapshot/g)) {
            const before = src.slice(Math.max(0, m.index - 400), m.index + 9)
            assert.match(before, /\}\);\s*(\/\/[^\n]*\n\s*)?$/, "capture follows the closed transaction")
        }
    }
})

test("detail labels which record it is; notes never touch price or status", () => {
    const service = read("backend/src/dealers/dealers.service.ts")
    assert.match(service, /source: 'PURCHASE_SNAPSHOT' as const/)
    assert.match(service, /source: 'CURRENT_LISTING' as const/)
    const notes = service.split("async addPurchaseInspectionNote")[1].split("\n    }\n")[0]
    assert.doesNotMatch(notes, /sale\.update|soldPrice|purchaseStatus/)
    assert.match(notes, /assertDealerPermission|ownedPurchase/)
    assert.match(read("backend/src/dealers/dealers.controller.ts"), /@Post\('purchases\/:id\/inspection-notes'\)/)
    assert.match(read("backend/src/dealers/dto/create-inspection-note.dto.ts"), /@MaxLength\(2000\)/)
})

test("web and app show the snapshot label and only show notes when switched on", () => {
    const web = read("src/components/dealer/PurchaseVehicleRecord.tsx")
    const app = read(APP + "screens/main/DealerPurchaseDetailScreen.tsx")
    for (const src of [web, app]) {
        assert.match(src, /Saved when you bought this vehicle/)
        assert.match(src, /Later changes by the seller don(&apos;|')t affect it/)
        assert.match(src, /The seller may have changed it since you bought the vehicle/)
    }
    assert.match(read("src/app/dashboard/dealer/purchases/[id]/page.tsx"), /\{purchase\.inspectionNotesEnabled && <PurchaseInspectionNotes saleId=\{purchase\.id\} \/>\}/)
    assert.match(app, /\{detail\.inspectionNotesEnabled && <PurchaseInspectionNotes saleId=\{detail\.id\} \/>\}/)
    for (const notes of [read("src/components/dealer/PurchaseInspectionNotes.tsx"), read(APP + "components/dealer/PurchaseInspectionNotes.tsx")]) {
        assert.match(notes, /don(&apos;|')t\s+change the agreed price or purchase status/)
        for (const kind of ["NEW_DAMAGE", "DIFFERS_FROM_ADVERT", "GENERAL"]) assert.ok(notes.includes(kind), kind)
        assert.doesNotMatch(notes, /method: ["'](PATCH|PUT|DELETE)["']/)
    }
})
