import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")

test("private legal seller evidence is separate from public listing and gated behind privacy approval", () => {
  const schema = read("backend/prisma/schema.prisma")
  const sql = read("backend/prisma/migrations/20261104175000_purchase_seller_legal_snapshots/migration.sql")
  const snapshot = read("backend/src/dealers/purchase-seller-legal-snapshot.ts")
  assert.match(schema, /model PurchaseSellerLegalSnapshot/)
  assert.match(schema, /@@map\("purchase_seller_legal_snapshots"\)/)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /REVOKE ALL .* FROM PUBLIC, anon, authenticated/)
  assert.match(snapshot, /PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED === 'true'/)
  assert.match(snapshot, /where: \{ saleId, buyerId \}/)
  assert.match(snapshot, /update: \{\}/)
  assert.doesNotMatch(snapshot, /bankAccount|sortCode|directorIdProof|proofOfAddress/)
})

test("receipt uses captured seller legal fields only after checking buyer and auction fee", () => {
  const pdf = read("backend/src/dealers/purchase-receipt-pdf.service.ts")
  const listing = read("backend/src/listings/listings.service.ts")
  const record = read("backend/src/dealers/purchase-listing-record.ts")
  const sellerPage = read("backend/src/dealers/purchase-receipt-seller-page.ts")
  assert.match(pdf, /getDealerPurchaseDetail\(requesterId, saleId\)/)
  assert.match(pdf, /if \(purchase.channel === 'AUCTION' && !purchase.buyerFee.settled\)/)
  assert.match(pdf, /getPurchaseSellerDetails\(requesterId, saleId\)/)
  assert.match(pdf, /readPurchaseSellerLegalSnapshot\(this.prisma, saleId, sale.buyerId\)/)
  assert.match(pdf, /advertisedPriceAtCapture/)
  assert.match(listing, /capturePurchaseSellerLegalSnapshot\(this.prisma,/)
  assert.match(record, /capturePurchaseSellerLegalSnapshot\(prisma, input\)/)
  assert.match(sellerPage, /Account-confirmed postal address/)
  assert.doesNotMatch(sellerPage, /'Verified postal address'/)
})

test("legacy purchases remain readable without inventing a historic identity snapshot", () => {
  const pdf = read("backend/src/dealers/purchase-receipt-pdf.service.ts")
  const sellerPage = read("backend/src/dealers/purchase-receipt-seller-page.ts")
  assert.match(pdf, /sellerDataSource: 'CURRENT_PROFILE'/)
  assert.match(sellerPage, /Current account information - not a historic snapshot/)
  assert.match(sellerPage, /NOT verified residence/)
})
