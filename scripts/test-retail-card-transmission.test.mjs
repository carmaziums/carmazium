import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")

// Exercise the actual shared label table, not a duplicate defined by the test.
const compiled = ts.transpileModule(read("../src/lib/vehicleLabels.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
})
assert.equal(compiled.diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0)
const exports = {}
runInNewContext(compiled.outputText, { exports }, { filename: "vehicleLabels.js" })

test("all persisted gearbox variants have clear public labels", () => {
    const labels = exports.TRANSMISSION_LABELS
    assert.equal(labels.MANUAL, "Manual")
    assert.equal(labels.AUTOMATIC, "Automatic")
    assert.equal(labels.SEMI_AUTOMATIC, "Semi-Automatic")
    assert.equal(labels.CVT, "CVT")
    assert.equal(labels.UNKNOWN, undefined)
})

test("shared retail card renders transmission only when data is present", () => {
    const source = read("../src/components/features/CarCard.tsx")
    assert.match(source, /transmission\?: string \| null/)
    assert.match(source, /TRANSMISSION_LABELS\[transmission\]/)
    assert.match(source, /\{transmissionLabel && \(/)
    assert.match(source, /<Cog size=\{10\} \/> \{transmissionLabel\}/)
    assert.match(source, /hasSpecs =[^\n]*transmissionLabel/)
})

test("both featured and ordinary Search cards receive the listing gearbox", () => {
    const source = read("../src/app/search/page.tsx")
    assert.equal((source.match(/transmission=\{listing\.transmission \?\? undefined\}/g) || []).length, 2)
})

test("homepage featured and more-to-explore cards receive the listing gearbox", () => {
    const source = read("../src/app/HomeClient.tsx")
    assert.equal((source.match(/transmission=\{listing\.transmission \?\? undefined\}/g) || []).length, 2)
})
