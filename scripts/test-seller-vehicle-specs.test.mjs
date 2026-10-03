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


const pendingSource = readFileSync(new URL("../src/lib/pendingSellerHandoff.ts", import.meta.url), "utf8")
const pendingOutput = ts.transpileModule(pendingSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
})
assert.equal(pendingOutput.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
const handoff = {}
runInNewContext(pendingOutput.outputText, {
    exports: handoff,
    require: id => {
        assert.equal(id, "./sellerVehicleSpecs")
        return exports
    },
}, { filename: "pendingSellerHandoff.js" })
const { createSellerHandoff, parseSellerHandoff, saveSellerHandoff, readSellerHandoff, clearSellerHandoff, SELLER_HANDOFF_KEY } = handoff

test("guest FREE Auction and £1 Retail handoffs retain selected vehicle, normalized VRM and journey only", () => {
    for (const listingType of ["AUCTION", "CLASSIFIED"]) {
        const saved = createSellerHandoff(listingType, {
            vrm: "AB12 CDE", make: "Ford", model: "Focus", year: "2019", mileage: "45000",
            transmission: "MANUAL", bodyType: "HATCHBACK", fuelType: "PETROL",
            email: "private@example.test", priceAsking: "19999", images: ["private-photo"],
        }, "550e8400-e29b-41d4-a716-446655440000", true, 100)
        assert.equal(saved.listingType, listingType)
        assert.equal(saved.vehicle.vrm, "AB12CDE")
        assert.equal(saved.vehicle.transmission, "MANUAL")
        assert.equal(saved.vehicle.bodyType, "HATCHBACK")
        assert.equal(saved.vehicle.email, undefined)
        assert.equal(saved.vehicle.priceAsking, undefined)
        assert.equal(saved.vehicle.images, undefined)
        assert.equal(parseSellerHandoff(JSON.stringify(saved), 101)?.valuationId, "550e8400-e29b-41d4-a716-446655440000")
    }
})

test("handoff is tab-scoped, consumable and expires after twenty minutes", () => {
    const memory = new Map()
    const storage = {
        getItem: k => memory.get(k) ?? null,
        setItem: (k, v) => memory.set(k, v),
        removeItem: k => memory.delete(k),
    }
    assert.equal(saveSellerHandoff(storage, "AUCTION", {
        vrm: "AB12CDE", make: "Ford", model: "Focus", year: "2019", mileage: "50000",
    }), true)
    assert.equal(readSellerHandoff(storage).listingType, "AUCTION")
    clearSellerHandoff(storage)
    assert.equal(memory.has(SELLER_HANDOFF_KEY), false)
    const candidate = createSellerHandoff("CLASSIFIED", {
        vrm: "AB12CDE", make: "Ford", model: "Focus", year: "2019", mileage: "50000",
    }, undefined, true, 200)
    assert.equal(parseSellerHandoff(JSON.stringify(candidate), 200 + 21 * 60_000), null)
    assert.equal(parseSellerHandoff(JSON.stringify(candidate), 199), null)
    assert.equal(parseSellerHandoff(JSON.stringify({ ...candidate, vehicle: { ...candidate.vehicle, vrm: "INVALID !!!" } }), 201), null)
})

test("restored historical invalid specs require details; motorcycles never need hidden body type", () => {
    const { hasCompleteSellerVehicleSpecs } = exports
    assert.equal(hasCompleteSellerVehicleSpecs({ transmission: "MANUAL", bodyType: "SUV", vehicleType: "CAR" }, carBodies), true)
    assert.equal(hasCompleteSellerVehicleSpecs({ transmission: "", bodyType: "SUV", vehicleType: "CAR" }, carBodies), false)
    assert.equal(hasCompleteSellerVehicleSpecs({ transmission: "MANUAL", bodyType: "HGV_BOX", vehicleType: "CAR" }, carBodies), false)
    assert.equal(hasCompleteSellerVehicleSpecs({ transmission: "CVT", vehicleType: "MOTORCYCLE" }, []), true)
    assert.equal(hasCompleteSellerVehicleSpecs({ transmission: "", vehicleType: "MOTORCYCLE" }, []), false)
})

test("wizard persists guest handoff and blocks invalid restored details before submitting", () => {
    const wizard = readFileSync(new URL("../src/components/listing/ListingWizard.tsx", import.meta.url), "utf8")
    assert.match(wizard, /saveSellerHandoff\(/)
    assert.match(wizard, /readSellerHandoff\(sessionStorage\)/)
    assert.match(wizard, /clearSellerHandoff\(sessionStorage\)/)
    assert.match(wizard, /const specsValid = hasCompleteSellerVehicleSpecs\(/)
    assert.match(wizard, /setCurrentStep\(specsValid \? 2 : 1\)/)
    assert.match(wizard, /const error = getStepValidationError\(step\)/)
    assert.ok(wizard.indexOf("const error = getStepValidationError(step)") < wizard.indexOf("setIsSubmitting(true)"))
})


const isolationSrc = readFileSync(new URL("../src/lib/sellerDraftIsolation.ts", import.meta.url), "utf8")
const isolationJs = ts.transpileModule(isolationSrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const isolation = {}
runInNewContext(isolationJs.outputText, {
    exports: isolation,
    require: id => {
        assert.equal(id, "./sellerVehicleSpecs")
        return exports
    },
})
test("browser drafts are scoped to separate authenticated accounts and legacy keys are never transferred", () => {
    const a = isolation.sellerDraftKeys("seller-a")
    const b = isolation.sellerDraftKeys("seller-b")
    assert.notEqual(a.draft, b.draft)
    assert.notEqual(a.hpiDraftId, b.hpiDraftId)
    assert.equal(isolation.sellerDraftKeys(""), null)
    const store = new Map([
        ["carmazium_listing_draft", "old user vehicle details"],
        ["carmazium_listing_draft_step", "4"],
        ["carmazium_hpi_draft_id", "another person's listing"],
        [a.draft, "seller A's own draft"],
    ])
    isolation.discardUnownedLegacySellerDraft({ removeItem: key => store.delete(key) })
    assert.equal(store.has("carmazium_listing_draft"), false)
    assert.equal(store.get(a.draft), "seller A's own draft")
    assert.equal(store.has(b.draft), false)
})
test("HPI return must match checkout, draft, URL and the same saved listing", () => {
    const binding = isolation.createHpiBinding("AB12 CDE", "listing-1", 1000)
    assert.equal(isolation.matchesHpiReturn(binding, "AB12CDE", "ab12 cde", "listing-1", 1001), true)
    assert.equal(isolation.matchesHpiReturn(binding, "CD34EFG", "AB12CDE", "listing-1", 1001), false)
    assert.equal(isolation.matchesHpiReturn(binding, "AB12CDE", "CD34EFG", "listing-1", 1001), false)
    assert.equal(isolation.matchesHpiReturn(binding, "AB12CDE", "AB12CDE", "listing-2", 1001), false)
    assert.equal(isolation.matchesHpiReturn(binding, "AB12CDE", "AB12CDE", "listing-1", 1000 + 3 * 3600000), false)
    assert.equal(isolation.matchesHpiReturn(null, "AB12CDE", "AB12CDE", "listing-1", 1001), false)
    assert.equal(isolation.parseHpiBinding(JSON.stringify(binding)).listingId, "listing-1")
    assert.equal(isolation.parseHpiBinding("{nope"), null)
})
test("seller wizard never writes the previous account's draft while identity changes", () => {
    const wizard = readFileSync(new URL("../src/components/listing/ListingWizard.tsx", import.meta.url), "utf8")
    assert.match(wizard, /readyDraftOwner === user\.id && activeDraftOwnerRef\.current === user\.id/)
    assert.match(wizard, /discardUnownedLegacySellerDraft\(localStorage\)/)
    assert.match(wizard, /matchesHpiReturn\(binding, parsed\.vrm, urlVrm, savedDraftId\)/)
    assert.match(wizard, /sessionStorage\.setItem\(draftKeys\.hpiCheckout, JSON\.stringify\(binding\)\)/)
    assert.doesNotMatch(wizard, /localStorage\.getItem\('carmazium_listing_draft'\)/)
})


const declarationSource = readFileSync(new URL("../src/lib/sellerDeclarationValidation.ts", import.meta.url), "utf8")
const declarationJS = ts.transpileModule(declarationSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
})
assert.equal(declarationJS.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
const declarations = {}
runInNewContext(declarationJS.outputText, { exports: declarations })
const { getMissingSellerDeclarations, sellerDeclarationErrorMessage } = declarations
const completedDeclarations = {
    writeOffCategory: "NONE",
    stolenRecovered: false,
    hasOutstandingFinance: false,
    isLegalRegisteredKeeper: true,
    notOwnerRelationship: "",
    isDepartedSale: false,
    departedRelationship: "",
    declarationAcknowledged: true,
}

test("completed retail and auction declaration choices show no error, including valid No answers", () => {
    const missing = getMissingSellerDeclarations(completedDeclarations)
    assert.equal(missing.length, 0)
    assert.equal(sellerDeclarationErrorMessage(missing), null)
})
test("an otherwise completed seller only sees the exact missing confirmation-checkbox warning", () => {
    const missing = getMissingSellerDeclarations({ ...completedDeclarations, declarationAcknowledged: false })
    assert.deepEqual(Array.from(missing), ["confirmation checkbox"])
    assert.equal(sellerDeclarationErrorMessage(missing), "Please tick the confirmation box to continue.")
})
test("selling on behalf of another keeper is allowed only after their relationship is specified", () => {
    const ownerMissing = getMissingSellerDeclarations({
        ...completedDeclarations, isLegalRegisteredKeeper: false, notOwnerRelationship: "",
    })
    assert.deepEqual(Array.from(ownerMissing), ["relationship to the registered keeper"])
    const authorised = getMissingSellerDeclarations({
        ...completedDeclarations, isLegalRegisteredKeeper: false, notOwnerRelationship: "Family member",
    })
    assert.equal(authorised.length, 0)
})
test("multiple missing declarations identify required answers without treating import No as an error", () => {
    const missing = getMissingSellerDeclarations({
        ...completedDeclarations,
        stolenRecovered: null,
        hasOutstandingFinance: null,
        declarationAcknowledged: false,
    })
    assert.deepEqual(Array.from(missing), [
        "stolen/recovered answer", "outstanding finance answer", "confirmation checkbox",
    ])
    assert.match(sellerDeclarationErrorMessage(missing), /outstanding finance answer/)
    assert.equal(getMissingSellerDeclarations({
        ...completedDeclarations, isDepartedSale: true, departedRelationship: "",
    })[0], "estate/departed-sale relationship")
})
test("both web selling methods use one accessible high-contrast native checkbox and shared validation", () => {
    const wizard = readFileSync(new URL("../src/components/listing/ListingWizard.tsx", import.meta.url), "utf8")
    assert.match(wizard, /<input\s+id="seller-declaration-acknowledged"\s+type="checkbox"/)
    assert.match(wizard, /onChange=\{event => set\("declarationAcknowledged", event\.target\.checked\)\}/)
    assert.match(wizard, /htmlFor="seller-declaration-acknowledged"/)
    assert.match(wizard, /peer-focus-visible:outline/)
    assert.match(wizard, /border-slate-700 bg-white dark:border-slate-100 dark:bg-slate-900/)
    assert.match(wizard, /text-sm sm:text-base font-medium leading-relaxed text-\[var\(--text-primary\)\]/)
    assert.match(wizard, /missing\.push\(\.\.\.missingSellerDeclarations\)/)
    assert.match(wizard, /sellerDeclarationErrorMessage\(missingSellerDeclarations\)/)
    assert.equal((wizard.match(/id="seller-declaration-acknowledged"/g) || []).length, 1)
    assert.doesNotMatch(wizard, /onClick=\{\(\) => set\("declarationAcknowledged"/)
    assert.doesNotMatch(wizard, /Please complete all declarations above before proceeding/)
})


const auctionSrc = readFileSync(new URL("../src/lib/sellerAuctionDraft.ts", import.meta.url), "utf8")
const auctionCompiled = ts.transpileModule(auctionSrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
})
assert.equal(auctionCompiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
const auctionHelper = {}
runInNewContext(auctionCompiled.outputText, { exports: auctionHelper })
const { parseSellerAuctionDraft, sellerAuctionDraftReady } = auctionHelper
const auctionFixture = {
    startTime: "NOW", reservePrice: "5500",
    startingBid: "4000", minIncrement: "100", buyItNowPrice: "",
}

test("saved auction schedule accepts a valid immediate or future start", () => {
    const parsed = parseSellerAuctionDraft(JSON.stringify(auctionFixture))
    assert.equal(parsed.reservePrice, "5500")
    assert.equal(sellerAuctionDraftReady(parsed, 1000), true)
    assert.equal(sellerAuctionDraftReady({ ...parsed, startTime: "2027-04-10T12:00:00" }, 1000), true)
})
test("missing, corrupt, expired or invalid saved auctions cannot jump to Review", () => {
    assert.equal(parseSellerAuctionDraft("{no"), null)
    assert.equal(sellerAuctionDraftReady(null, 1000), false)
    assert.equal(sellerAuctionDraftReady({ ...auctionFixture, reservePrice: "" }, 1000), false)
    assert.equal(sellerAuctionDraftReady({ ...auctionFixture, minIncrement: "-1" }, 1000), false)
    assert.equal(sellerAuctionDraftReady({ ...auctionFixture, startTime: "bad-date" }, 1000), false)
    assert.equal(sellerAuctionDraftReady({ ...auctionFixture, startTime: "1970-01-01T00:00:02" }, 10_000), false)
    assert.equal(sellerAuctionDraftReady({ ...auctionFixture, buyItNowPrice: "bad" }, 1000), false)
})
test("retail and auction draft keys are isolated between authenticated sellers", () => {
    const a = isolation.sellerDraftKeys("seller-a")
    const b = isolation.sellerDraftKeys("seller-b")
    assert.notEqual(a.auctionSchedule, b.auctionSchedule)
    assert.notEqual(a.auctionSchedule, a.draft)
})
test("web Review always gates photos, prices and auction schedule before API or payment", () => {
    const wizard = readFileSync(new URL("../src/components/listing/ListingWizard.tsx", import.meta.url), "utf8")
    const submit = wizard.slice(wizard.indexOf("const handleSubmit = async () =>"), wizard.indexOf("setIsSubmitting(true)", wizard.indexOf("const handleSubmit = async ()")))
    assert.match(submit, /\[1, 2, 3, 4\]/)
    assert.match(submit, /\[1, 2, 3\]/)
    assert.match(submit, /getStepValidationError\(step\)/)
    assert.match(wizard, /localStorage\.setItem\(draftKeys\.auctionSchedule, JSON\.stringify\(auctionSchedule\)\)/)
    assert.match(wizard, /sellerAuctionDraftReady\(savedAuction\)/)
    assert.match(wizard, /setAuctionSchedule\(returnedAuction \?\? \{ \.\.\.EMPTY_SELLER_AUCTION_DRAFT \}\)/)
})
test("web HPI return never unlocks when backend refuses entitlement or checkout vehicle differs", () => {
    const wizard = readFileSync(new URL("../src/components/listing/ListingWizard.tsx", import.meta.url), "utf8")
    assert.match(wizard, /status\.metadata\?\.listingId !== savedDraftId/)
    assert.match(wizard, /normalizeVehicleRegistration\(status\.metadata\?\.vrm\) !== binding\?\.vrm/)
    assert.match(wizard, /if \(!result\.applied\)/)
    const guarded = wizard.slice(wizard.indexOf("return applyHpiFee(sessionId).then(result =>"), wizard.indexOf("sessionStorage.removeItem(draftKeys.hpiCheckout)", wizard.indexOf("return applyHpiFee(sessionId).then(result =>")))
    assert.ok(guarded.indexOf("if (!result.applied)") < guarded.indexOf("setIsHpiUnlocked(true)"))
})


test("final web auction validation refuses nonnumeric prices rather than trusting parseFloat NaN", () => {
    const wizard = readFileSync(new URL("../src/components/listing/ListingWizard.tsx", import.meta.url), "utf8")
    assert.match(wizard, /!Number\.isFinite\(Number\(auctionSchedule\.reservePrice\)\)/)
    assert.match(wizard, /!Number\.isFinite\(Number\(auctionSchedule\.startingBid\)\)/)
    assert.match(wizard, /!Number\.isFinite\(pMin\)/)
})
