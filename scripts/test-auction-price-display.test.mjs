import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const compile = path => {
  const src = read(path);
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(js, { exports });
  return exports;
};
const web = compile("src/lib/auctionPricing.ts");
const app = compile("carmazium app/carmazium app/src/data/listings.ts");

test("auction with no valid bids shows Starting bid, not a generic listing valuation", () => {
  const item = { type: "AUCTION", price: "2500.00", auction: {
    id: "auction-one", status: "ACTIVE", startingBid: 1750, currentBid: 1750,
    hasBids: false, reserveMet: false, buyItNowPrice: null,
  } };
  assert.equal(web.getListingPricePresentation(item).price, "£1,750");
  assert.equal(web.getListingPricePresentation(item).label, "Starting bid");
  assert.equal(web.getListingPricePresentation(item).reserveLabel, "Reserve not met");
  assert.equal(web.getListingPricePresentation(item).buyItNowLabel, null);
  const native = app.getNativeListingPrice({ ...item, listingType: "AUCTION" });
  assert.equal(native.amount, "£1,750");
  assert.equal(native.label, "Starting bid");
});

test("genuine current bid and reserve status are used after valid bids", () => {
  const listing = { type: "AUCTION", price: 3500, auction: {
    status: "ACTIVE", startingBid: 1750, currentBid: 2350,
    hasBids: true, reserveMet: true, buyItNowPrice: 2800,
  } };
  const p = web.getListingPricePresentation(listing);
  assert.equal(p.price, "£2,350");
  assert.equal(p.label, "Current bid");
  assert.equal(p.reserveLabel, "Reserve met");
  assert.equal(p.buyItNowLabel, "Buy It Now £2,800");
  const mobile = app.getNativeListingPrice({ ...listing, listingType: "AUCTION" });
  assert.equal(mobile.amount, "£2,350");
  assert.equal(mobile.reserveLabel, "Reserve met");
});

test("retail and dual-listed retail preserve the actual retail asking price", () => {
  const retail = { type: "CLASSIFIED", price: "£2,500", auction: {
    startingBid: 1750, currentBid: 1800, hasBids: true,
  } };
  assert.equal(web.getListingPricePresentation(retail).price, "£2,500");
  assert.equal(web.getListingPricePresentation(retail).label, "Retail asking price");
  const native = app.getNativeListingPrice({ price: 2500, listingType: "CLASSIFIED" });
  assert.equal(native.amount, "£2,500");
});

test("missing auction terms NEVER fall back to listing.price", () => {
  const missing = { type: "AUCTION", price: 2500, auction: null };
  assert.equal(web.getListingPricePresentation(missing).price, "View auction");
  assert.equal(app.getNativeListingPrice({ listingType: "AUCTION", price: 2500, auction: null }).amount, "View auction");
});

test("backend derives valid bid prices, filters deleted/cancelled/archived bids, and redacts reserve", () => {
  const backend = read("backend/src/listings/listings.service.ts");
  assert.match(backend, /bids:\s*\{\s*where:\s*\{\s*deletedAt:\s*null,\s*cancelledAt:\s*null,\s*archivedAt:\s*null/);
  assert.match(backend, /orderBy:\s*\{\s*amount:\s*'desc'\s*\},\s*take:\s*1/);
  assert.match(backend, /currentBid:\s*highest\s*\?\?\s*Number\(auctionPublic\.startingBid\)/);
  assert.match(backend, /reserveMet:\s*highest\s*!==\s*null\s*&&\s*highest\s*>=\s*Number\(reservePrice\)/);
  assert.match(backend, /const \{\s*reservePrice,\s*\.\.\.auctionPublic\s*\} = safe\.auction/);
  assert.match(backend, /delete listingWithCount\.auction\.reservePrice/);
  assert.match(backend, /delete listingWithCount\.bids/);
});

test("web and app cards use API bid display and the actual auction route", () => {
  const search = read("src/app/search/page.tsx");
  const card = read("src/components/features/CarCard.tsx");
  const mobileCard = read("carmazium app/carmazium app/src/components/VehicleCard.tsx");
  const mobileHorizontal = read("carmazium app/carmazium app/src/components/HorizontalVehicleCard.tsx");
  const mobileSearch = read("carmazium app/carmazium app/src/screens/main/SearchScreen.tsx");
  assert.equal((search.match(/auction=\{listing\.auction\}/g) || []).length, 2);
  assert.match(card, /getListingPricePresentation\(\{ type: listingType, price, auction \}\)/);
  assert.match(card, /detailHref = listingType === "AUCTION"/);
  assert.match(card, /listingType !== "AUCTION" && status === 'ACTIVE'/);
  assert.match(mobileCard, /getNativeListingPrice\(listing\)\.amount/);
  assert.match(mobileHorizontal, /getNativeListingPrice\(listing\)\.amount/);
  assert.match(mobileSearch, /item\.listingType === 'AUCTION' && item\.auction\?\.id/);
  assert.match(mobileSearch, /navigation\.navigate\('LiveAuctionDetailed'/);
  for (const p of ["src/app/buy-cars/[slug]/page.tsx", "src/app/vehicle/[id]/page.tsx"]) {
    assert.match(read(p), /permanentRedirect\([^)]*\/auctions\/live\//, p);
  }
});
