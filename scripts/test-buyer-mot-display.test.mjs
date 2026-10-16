import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const report = read("src/components/listing/BuyerVehicleInformation.tsx")
const auction = read("src/app/vehicle/[id]/VehicleDetailPageClient.tsx")
const retail = read("src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx")
const seller = read("src/app/sell/page.tsx")

test("both auction and retail buyers render the same complete persisted vehicle information", () => {
    for (const page of [auction, retail]) {
        assert.match(page, /import \{ BuyerVehicleInformation \}/)
        assert.match(page, /<BuyerVehicleInformation listing=\{listing\} \/>/)
    }
    assert.equal((retail.match(/<BuyerVehicleInformation listing=\{listing\} \/>/g) || []).length, 1)
    assert.equal((auction.match(/<BuyerVehicleInformation listing=\{listing\} \/>/g) || []).length, 1)
})

test("buyer sees all persisted DVLA metadata and seller specs without invented data", () => {
    for (const name of ["listing.make", "listing.model", "listing.variant", "listing.vrm",
        "listing.monthOfFirstRegistration", "listing.firstUsedDate", "listing.motStatus",
        "listing.motExpiryDate", "listing.taxStatus", "listing.taxDueDate", "listing.wheelplan",
        "listing.typeApproval", "listing.dateOfLastV5CIssued", "listing.markedForExport",
        "listing.fuelType", "listing.transmission", "listing.engineSize", "listing.co2Emissions",
        "listing.euroStandard", "listing.bodyType", "listing.seats", "listing.doors",
        "listing.serviceHistory", "listing.owners", "listing.numberOfKeys"]) {
        assert.ok(report.includes(name), name + " missing")
    }
    assert.match(report, /facts\.filter\(f => present\(f\.value\)\)/)
    assert.match(report, /Only known fields are shown/)
    assert.doesNotMatch(report, /listing\.vin|listing\.seller\.phone|MOT_API_KEY|MOT_HISTORY_CLIENT_SECRET/)
})

test("MOT records show dated mileage, failures, advisories, and all stored tests when requested", () => {
    for (const marker of ["test.testResult", "test.completedDate", "test.odometerValue", "test.odometerUnit",
        "test.defects", "test.motTestNumber", "test.expiryDate", "defect.text", "defect.type"]) {
        assert.ok(report.includes(marker), marker)
    }
    assert.match(report, /historical MOT reading, not the vehicle/)
    assert.match(report, /showAllMot \? mot : mot\.slice\(0, 5\)/)
    assert.match(report, /setShowAllMot\(v => !v\)/)
    assert.match(report, /test\.testResult === "PASSED"/)
    assert.match(report, /Results may have changed/)
    assert.match(report, /No MOT test history was saved/)
    assert.match(report, /www\.gov\.uk\/check-mot-history/)
})

test("first-use date survives the registration-to-listing handoff", () => {
    assert.match(seller, /firstUsedDate: vehicle\.firstUsedDate \|\| ""/)
    assert.match(seller, /motHistory: vehicle\.motHistory \|\| \[\]/)
    assert.match(seller, /saveSellerHandoff/)
})

test("seller's current mileage is never overwritten with the historical MOT odometer", () => {
    const wizard = read("src/components/listing/ListingWizard.tsx")
    assert.match(wizard, /set\("motHistory", normalizeMotHistorySnapshot\(r\.motHistory\)\)/)
    assert.doesNotMatch(wizard, /if \(latestOdometer\) set\("mileage", latestOdometer\)/)
    assert.match(wizard, /Historical MOT mileage is evidence/)
})
