import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")

test("purchase PDF is produced server-side only after buyer collection and normal permissions", () => {
    const service = read("backend/src/dealers/purchase-receipt-pdf.service.ts")
    const ctrl = read("backend/src/dealers/dealers.controller.ts")
    const module = read("backend/src/dealers/dealers.module.ts")
    assert.match(service, /getDealerPurchaseDetail\(requesterId, saleId\)/)
    assert.match(service, /if \(!purchase\.buyerCollectedAt\)/)
    assert.match(service, /!purchase\.buyerFee\.settled/)
    assert.match(service, /getPurchaseSellerDetails\(requesterId, saleId\)/)
    assert.match(ctrl, /@Get\('purchases\/:id\/receipt\.pdf'\)/)
    assert.match(ctrl, /renderForPurchase\(id, user\.id\)/)
    assert.match(ctrl, /'Cache-Control', 'private, no-store'/)
    assert.match(module, /PurchaseReceiptPdfService/)
    assert.doesNotMatch(service, /createPayment|paymentIntent\.create|transfer\.create/)
})

test("PDF never masquerades as proof of payment or a VAT invoice", () => {
    const source = read("backend/src/dealers/purchase-receipt-pdf.service.ts")
    assert.match(source, /not to CarMazium/)
    assert.match(source, /not a seller-issued invoice, a VAT invoice/)
    assert.match(source, /sellerFundsConfirmedAt/)
    assert.match(source, /pdf\.addPage/)
})

test("completed web purchase cards and detail have mobile-friendly PDF controls", () => {
    const button = read("src/components/purchases/PurchaseReceiptButton.tsx")
    const card = read("src/components/dealer/PipelineRow.tsx")
    const detail = read("src/app/dashboard/dealer/purchases/[id]/page.tsx")
    for (const [name, code] of [["button", button], ["card", card], ["detail", detail]]) {
        const compiled = ts.transpileModule(code, {
            compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
            reportDiagnostics: true,
            fileName: name + ".tsx",
        })
        assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
    }
    assert.match(button, /downloadAuthenticatedFile/)
    assert.match(button, /Download purchase receipt \(PDF\)/)
    assert.match(card, /item\.buyerCollectedAt && \(/)
    assert.match(detail, /purchase\.buyerCollectedAt && \(/)
    assert.match(card, /PurchaseReceiptButton saleId=\{item\.id\}/)
    assert.match(detail, /PurchaseReceiptButton saleId=\{purchase\.id\}/)
})
