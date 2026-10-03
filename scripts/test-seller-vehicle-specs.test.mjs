import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

// Transpile the actual helper used by the Next.js seller wizard without
// introducing a separate browser test runner or changing the release build.
const source = readFileSync(new URL("../src/lib/sellerVehicleSpecs.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
})
assert.equal(compiled.diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0)
const exports = {}
runInNewContext(compiled.outputText, { exports }, { filename: "sellerVehicleSpecs.js" })
const {
    normalizeSellerTransmission,
    normalizeSellerBodyType,
    normalizeVehicleRegistration,
    resolveSellerVehicleSpecs,
} = exports

const carBodies = ["SEDAN", "HATCHBACK", "SUV", "ESTATE", "PICKUP_TRUCK"]
const hgvBodies = ["HGV_BOX", "HGV_FLATBED"]

test("common user and lookup transmission spellings resolve to backend enum values", () => {
    for (const value of ["manual", " MANUAL ", "Manual"]) assert.equal(normalizeSellerTransmission(value), "MANUAL")
    for (const value of ["Automatic", "auto", "AUTOMATIC"]) assert.equal(normalizeSellerTransmission(value), "AUTOMATIC")
    for (const value of ["semi-automatic", "Semi Automatic", "SEMI_AUTOMATIC"]) {
        assert.equal(normalizeSellerTransmission(value), "SEMI_AUTOMATIC")
    }
    assert.equal(normalizeSellerTransmission("continuously variable"), "CVT")
    assert.equal(normalizeSellerTransmission("UNKNOWN"), "")
})

test("body types accept simple spelling aliases but cannot cross vehicle categories", () => {
    assert.equal(normalizeSellerBodyType("Saloon", carBodies), "SEDAN")
    assert.equal(normalizeSellerBodyType("hatch back", carBodies), "HATCHBACK")
    assert.equal(normalizeSellerBodyType("pickup", carBodies), "PICKUP_TRUCK")
    assert.equal(normalizeSellerBodyType("HGV box", hgvBodies), "HGV_BOX")
    assert.equal(normalizeSellerBodyType("HGV_BOX", carBodies), "")
    assert.equal(normalizeSellerBodyType("SUV", hgvBodies), "")
})

test("manual seller choices survive a delayed conflicting lookup for the same registration", () => {
    const specs = resolveSellerVehicleSpecs(
        { vrm: "AB12 CDE", transmission: "MANUAL", bodyType: "HATCHBACK" },
        { vrm: "ab12cde", transmission: "AUTOMATIC", bodyType: "SEDAN" },
        carBodies,
    )
    assert.equal(specs.transmission, "MANUAL")
    assert.equal(specs.bodyType, "HATCHBACK")
})

test("new lookup fills both empty fields without requiring repeat entry", () => {
    const specs = resolveSellerVehicleSpecs(
        { vrm: "AB12CDE", transmission: "", bodyType: "" },
        { vrm: "AB12 CDE", transmission: "manual", bodyType: "Saloon" },
        carBodies,
    )
    assert.equal(specs.transmission, "MANUAL")
    assert.equal(specs.bodyType, "SEDAN")
})

test("lookup can fill body type without changing a manually selected gearbox", () => {
    const specs = resolveSellerVehicleSpecs(
        { vrm: "AB12 CDE", transmission: "MANUAL", bodyType: "" },
        { vrm: "AB12CDE", transmission: "auto", bodyType: "SUV" },
        carBodies,
    )
    assert.equal(specs.transmission, "MANUAL")
    assert.equal(specs.bodyType, "SUV")
})

test("a different registration does not inherit the old vehicle's specifications", () => {
    const specs = resolveSellerVehicleSpecs(
        { vrm: "AB12 CDE", transmission: "MANUAL", bodyType: "SUV" },
        { vrm: "CD34EFG", transmission: "AUTOMATIC", bodyType: "SEDAN" },
        carBodies,
    )
    assert.equal(specs.transmission, "AUTOMATIC")
    assert.equal(specs.bodyType, "SEDAN")
    assert.equal(normalizeVehicleRegistration("cd34 efg"), "CD34EFG")
})

test("bad external body type never prevents a valid seller choice being retained", () => {
    const specs = resolveSellerVehicleSpecs(
        { vrm: "AB12CDE", transmission: "manual", bodyType: "SUV" },
        { vrm: "AB12CDE", transmission: "BAD_TYPE", bodyType: "HGV_BOX" },
        carBodies,
    )
    assert.equal(specs.transmission, "MANUAL")
    assert.equal(specs.bodyType, "SUV")
})

test("missing motorcycle body type remains empty and cannot become a hidden blocker", () => {
    const specs = resolveSellerVehicleSpecs(
        { vrm: "AB12CDE", transmission: "", bodyType: "" },
        { vrm: "AB12CDE", transmission: "manual", bodyType: "SUV" },
        [],
    )
    assert.equal(specs.transmission, "MANUAL")
    assert.equal(specs.bodyType, "")
})

test("seller wizard uses the policy at validation, lookup, landing merge and submit boundaries", () => {
    const wizard = readFileSync(new URL("../src/components/listing/ListingWizard.tsx", import.meta.url), "utf8")
    assert.match(wizard, /if \(!normalizeSellerTransmission\(formData\.transmission\)\) missing\.push\('transmission'\)/)
    assert.match(wizard, /if \(formData\.vehicleType !== 'MOTORCYCLE' && !normalizeSellerBodyType\(formData\.bodyType, bodyTypeKeys\)\)/)
    assert.match(wizard, /if \(lookupId !== lookupRequestRef\.current\) return/)
    assert.match(wizard, /if \(normalizeVehicleRegistration\(prev\.vrm\) !== requestedVrm\) return prev/)
    assert.ok(wizard.match(/resolveSellerVehicleSpecs\(/g)?.length >= 2)
    assert.match(wizard, /transmission: normalizeSellerTransmission\(formData\.transmission\) \|\| undefined/)
    assert.match(wizard, /bodyType: normalizeSellerBodyType\(formData\.bodyType, bodyTypeKeys\) \|\| undefined/)
})
