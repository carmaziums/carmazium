// Owner decision (31 Oct 2026, #724): official DVLA/MOT facts, the V5C issue
// date and a legitimately recorded VIN stay visible to buyers on web and app,
// while seller-private declarations stay out of public payloads.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (p) => readFileSync(p, "utf8")
const APP = "carmazium app/carmazium app/src/"
const webFacts = read("src/components/listing/BuyerVehicleInformation.tsx")
const appFacts = read(APP + "components/BuyerVehicleFacts.tsx")
const service = read("backend/src/listings/listings.service.ts")

test("web buyer facts show the V5C date and MOT history, and drop missing values instead of inventing them", () => {
    assert.match(webFacts, /\{ label: "Last V5C issue date", value: ukDate\(listing\.dateOfLastV5CIssued\) \}/)
    assert.match(webFacts, /Array\.isArray\(listing\.motHistory\) \? listing\.motHistory : \[\]/)
    assert.match(webFacts, /if \(!date\) return null/)
    // Every buyer vehicle page renders the same panel.
    for (const page of ["src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx", "src/app/vehicle/[id]/VehicleDetailPageClient.tsx", "src/app/auctions/live/[id]/page.tsx"]) {
        assert.match(read(page), /<BuyerVehicleInformation listing=/, page)
    }
})

test("app buyer facts match web for the V5C date and MOT history", () => {
    assert.match(appFacts, /\['Last V5C issued', displayDate\(data\.dateOfLastV5CIssued\)\]/)
    assert.match(appFacts, /Array\.isArray\(data\.motHistory\) \? data\.motHistory : \[\]/)
    assert.match(appFacts, /\.filter\(\(entry\): entry is readonly \[string, string\] => entry\[1\] !== null\)/)
    assert.match(read(APP + "screens/vehicle/VehicleDetailScreen.tsx"), /<BuyerVehicleFacts record=/)
    assert.match(read(APP + "screens/vehicle/AuctionDetailScreen.tsx"), /<BuyerVehicleFacts record=/)
})

test("recorded VIN is available both visibly to buyers and in vehicle structured data", () => {
    assert.match(read("src/components/seo/JsonLd.tsx"), /if \(vin\) schema\.vehicleIdentificationNumber = vin/)
    assert.match(webFacts, /\{ label: "VIN \(recorded\)", value: listing\.vin \}/)
    assert.match(appFacts, /\['VIN \(recorded\)', data\.vin\]/)
})

test("public search and detail strip seller-private fields but never official vehicle facts", () => {
    const privateList = service.match(/PUBLIC_DETAIL_PRIVATE_FIELDS = \[([\s\S]*?)\] as const/)
    assert.ok(privateList, "private field list exists")
    for (const field of ["rejectionReason", "partnerDistributionAcceptedAt", "deletedAt"]) {
        assert.match(privateList[1], new RegExp(`'${field}'`))
    }
    // Owner decision: the seller's keeper-relationship note is for buyers too.
    for (const official of ["vin", "dateOfLastV5CIssued", "motHistory", "officialVehicleData", "motExpiryDate", "notOwnerRelationship"]) {
        assert.doesNotMatch(privateList[1], new RegExp(`'${official}'`), official)
    }
    assert.match(service, /const managesListing = await this\.viewerManagesListing\(viewerId, listing\.sellerId\)/)
    assert.match(service, /if \(!managesListing\)/)
})

test("keeper relationship is public only when seller answers No", () => {
    assert.doesNotMatch(service, /notOwnerRelationship: _notOwnerRelationship/)
    assert.match(service, /if \(safe\.isLegalRegisteredKeeper !== false\) delete safe\.notOwnerRelationship/)
    assert.match(service, /if \(listing\.isLegalRegisteredKeeper !== false\) delete listingWithCount\.notOwnerRelationship/)
})

test("buyers see the seller's relationship to the owner when the seller is not the registered keeper (web and app)", () => {
    assert.match(webFacts, /\{ label: "Seller's relationship to the owner \(seller\)", value: listing\.isLegalRegisteredKeeper === false \? listing\.notOwnerRelationship : null \}/)
    assert.match(appFacts, /\["Seller's relationship to the owner \(seller\)", data\.isLegalRegisteredKeeper === false \? data\.notOwnerRelationship : null\]/)
})
