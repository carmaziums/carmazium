import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")

test("recovered-purchase table is distinct from financial Sales, protected by RLS", () => {
    const model = read("backend/prisma/schema.prisma")
    const sql = read("backend/prisma/migrations/20261104142500_dealer_purchase_reconciliations/migration.sql")
    assert.match(model, /model DealerPurchaseReconciliation/)
    const reanchor = read("backend/prisma/migrations/20261104165000_reanchor_recovered_purchases_to_original_listing/migration.sql")
    assert.match(reanchor, /"stockListingId" DROP NOT NULL/)
    assert.match(reanchor, /"sourceListingId" SET NOT NULL/)
    assert.match(reanchor, /buyer_source_key/)
    assert.doesNotMatch(reanchor, /UPDATE public\.listings|UPDATE public\.auctions|INSERT INTO public\.sales/i)
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public.dealer_purchase_reconciliations/)
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
    assert.match(sql, /UNIQUE \("buyerId","stockListingId"\)/)
    assert.match(sql, /"purchasePrice" NUMERIC\(12,2\)/)
    assert.doesNotMatch(sql, /INSERT INTO public\.sales|UPDATE public\.auctions/i)
})

test("recovered purchases require buyer authorization, and never set fees or win auctions", () => {
    const svc = read("backend/src/dealers/dealers.service.ts")
    const controller = read("backend/src/dealers/dealers.controller.ts")
    const segment = svc.split("async getDealerReconciledPurchases(")[1].split("async getDealerPurchases(")[0]
    assert.match(segment, /assertDealerPermission\(actor, 'VIEW_PURCHASES'\)/)
    assert.match(segment, /where: \{ buyerId: actor\.ownerUserId, status: 'COMPLETED' \}/)
    assert.match(segment, /purchasePrice: r\.purchasePrice === null \? null/)
    assert.match(segment, /purchaseChannel: 'RECONCILED'/)
    assert.match(segment, /sourceListing: \{/)
    assert.match(segment, /seller: \{ select: \{ firstName: true, lastName: true \} \}/)
    assert.match(segment, /listingId: r\.sourceListingId/)
    assert.match(segment, /vehicleTitle: l\.title/)
    assert.match(segment, /imageUrl: l\.images\[0\]/)
    assert.match(segment, /originalListedAt: l\.createdAt/)
    assert.doesNotMatch(segment, /r\.stockListing\.(title|images|mileage)/)
    assert.match(controller, /@Get\('purchases\/reconciled'\)/)
    assert.match(controller, /@Get\('purchases\/reconciled\/:id'\)/)
    assert.match(controller, /@Get\('purchases\/reconciled\/:id\/receipt.pdf'\)/)
    assert.doesNotMatch(segment, /sale\.create|auction\.update|paymentsService/)
})

test("completed history includes recovered vehicles without asserting payment or deleting stock", () => {
    const history = read("src/components/dealer/DealerPurchasesView.tsx")
    const row = read("src/components/dealer/PipelineRow.tsx")
    const details = read("src/app/dashboard/dealer/purchases/reconciled/[id]/page.tsx")
    const receipt = read("src/components/purchases/PurchaseReceiptButton.tsx")
    assert.match(history, /\/dealers\/purchases\/reconciled/)
    assert.match(history, /setPurchases\(\[\.\.\.regular, \.\.\.recovered\]\)/)
    assert.match(history, /status: "checks_complete"/)
    assert.match(history, /reconciledPurchase/)
    assert.match(row, /Purchased from original CarMazium auction listing/)
    assert.match(row, /Original auction seller:/)
    assert.match(history, /if \(channel === "auction" && isRetailPurchase\(p\)\) return false/)
    assert.doesNotMatch(history, /channel === "auction" && p\.reconciledPurchase\) return false/)
    assert.match(details, /Original auction seller/)
    assert.match(details, /Original auction listed/)
    assert.match(row, /item\.purchasePriceUnrecorded/)
    assert.match(row, /reconciled=\{item\.reconciledPurchase\}/)
    assert.match(details, /Completed purchase record/)
    assert.match(details, /does not change the historic auction outcome/)
    assert.match(receipt, /reconciled.*\?/s)
    for (const [name, source] of [["history", history], ["row", row], ["details", details], ["receipt", receipt]]) {
        const output = ts.transpileModule(source, {
            compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
            reportDiagnostics: true, fileName: name + ".tsx",
        })
        assert.equal(output.diagnostics?.filter(x => x.category === ts.DiagnosticCategory.Error).length, 0)
    }
})
