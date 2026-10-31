// Guards for the 31 Oct 2026 page-by-page website audit (PR "Website audit").
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const read = (p) => readFileSync(p, "utf8")

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p, out)
        else if (/\.(tsx?|css)$/.test(name)) out.push(p)
    }
    return out
}
const webFiles = walk("src")

test("every image path referenced by the website exists in public/", () => {
    const missing = new Set()
    for (const file of webFiles) {
        for (const m of read(file).matchAll(/["'`(]\/((?:assets|images|icons)\/[\w ./-]+\.(?:png|jpe?g|webp|svg|gif))/g)) {
            if (!existsSync(join("public", m[1]))) missing.add(`${m[1]} (${file})`)
        }
    }
    assert.deepEqual([...missing], [])
})

test("large artwork is served as WebP, not the multi-hundred-KB originals", () => {
    for (const name of ["body-estate", "featured-sports", "featured-suv", "logo-light", "blog-keys"]) {
        assert.ok(existsSync(`public/assets/images/${name}.webp`), name)
    }
    const heavy = /\/assets\/images\/(body-[a-z]+|featured-(sports|suv)|logo-light|blog-keys|promo-car|customer-1|signup-bg)\.png/
    for (const file of webFiles) assert.doesNotMatch(read(file), heavy, file)
})

test("SEO: trader pricing has its own canonical; cookie policy has its own metadata", () => {
    const traders = read("src/app/pricing/traders/page.tsx")
    assert.match(traders, /canonical: "\/pricing\/traders"/)
    assert.match(traders, /within 72 hours of the win/)
    assert.match(read("src/app/cookie-policy/layout.tsx"), /canonical: "\/cookie-policy"/)
    for (const [file, path] of [["terms/page.tsx", "/terms"], ["privacy-policy/page.tsx", "/privacy-policy"], ["delete-account/page.tsx", "/delete-account"], ["app-support/page.tsx", "/app-support"]]) {
        assert.ok(read(`src/app/${file}`).includes(`canonical: ${file.startsWith("terms") ? "'" : '"'}${path}`), file)
    }
})

test("auction vehicle page no longer shows unverified history badges or a dead unlock button", () => {
    const page = read("src/app/vehicle/[id]/VehicleDetailPageClient.tsx")
    assert.doesNotMatch(page, />\s*Not Stolen\s*</)
    assert.doesNotMatch(page, /Unlock Full Report for £9\.99/)
})

test("finance calculator button opens the finance enquiry instead of doing nothing", () => {
    const calc = read("src/components/features/FinanceCalculator.tsx")
    assert.match(calc, /financeServiceEnabled && \(\s*<Link href="\/services\/finance"/)
    assert.doesNotMatch(calc, /<button[^>]*>Apply for Finance<\/button>/)
})

test("dealer sales export is labelled for what it contains and blocked when loading failed", () => {
    const page = read("src/app/dashboard/dealer/earnings/page.tsx")
    assert.match(page, /onClick=\{downloadReport\}/)
    assert.match(page, /Export sales CSV/)
    assert.doesNotMatch(page, /> Financial Report/)
    assert.match(page, /disabled=\{loading \|\| loadError \|\| filteredSales\.length === 0\}/)
    assert.match(page, /toCsv\(rows\)/)
    assert.match(page, /Your earnings could not be loaded/)
})

test("CSV cells neutralise formulas, including behind whitespace and control characters", () => {
    const src = read("src/lib/csvExport.ts")
        .replace(/^export /gm, "")
        .replace(/\((value|rows): [^)]*\): string/g, "($1)")
    const { csvCell, toCsv } = new Function(src + "; return { csvCell, toCsv }")()
    assert.equal(csvCell("=SUM(A1)"), `"'=SUM(A1)"`)
    assert.equal(csvCell("  +cmd"), `"'  +cmd"`)
    assert.equal(csvCell("\u0001@x"), `"'\u0001@x"`)
    assert.equal(csvCell("\t-1"), `"'\t-1"`)
    assert.equal(csvCell("Ford \"Focus\""), `"Ford ""Focus"""`)
    assert.equal(csvCell("AB12 CDE"), `"AB12 CDE"`)
    assert.equal(csvCell(-500), "-500")
    assert.equal(csvCell(null), `""`)
    assert.equal(toCsv([["a", 1], ["b", 2]]), `"a",1\r\n"b",2`)
})

test("loading, failed or missing damage data is never shown as 'No damage reported'", () => {
    for (const file of ["src/app/auctions/live/[id]/page.tsx", "src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx"]) {
        const src = read(file)
        assert.match(src, /useState\(true\)/, file)
        assert.match(src, /\.catch\(\(\) => \{ if \(!cancelled\) setDamageLoadFailed\(true\) \}\)/, file)
        assert.match(src, /\.finally\(\(\) => \{ if \(!cancelled\) setDamageLoading\(false\) \}\)/, file)
        assert.match(src, /setDamageRecords\(\[\]\)/, file)
        assert.match(src, /damageLoading\s*\?\s*"Loading the seller's damage details…"/, file)
        assert.match(src, /damageLoadFailed\s*\?\s*["']Damage details could not be loaded/, file)
    }
    const vehicle = read("src/app/vehicle/[id]/VehicleDetailPageClient.tsx")
    assert.match(vehicle, /const damageDataAvailable = Array\.isArray/)
    assert.match(vehicle, /Damage details are not available for this vehicle/)
})

test("no condition grade on record is not shown as Grade 1 — Excellent", () => {
    for (const file of ["src/app/auctions/live/[id]/page.tsx", "src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx", "src/app/vehicle/[id]/VehicleDetailPageClient.tsx"]) {
        const src = read(file)
        assert.doesNotMatch(src, /exteriorGrade \?\? 1/, file)
        assert.match(src, /\{grade !== null && \(/, file)
    }
})

test("auction vehicle page opens the real history report, not a description of one", () => {
    const vehicle = read("src/app/vehicle/[id]/VehicleDetailPageClient.tsx")
    assert.match(vehicle, /<HpiReportModal listingId=\{listing\.id\}/)
    assert.match(vehicle, /onClick=\{\(\) => setShowHpiModal\(true\)\}/)
    assert.doesNotMatch(vehicle, /available through the vehicle report section/)
})

test("footer app promo follows real store availability", () => {
    const promo = read("src/components/layout/FooterAppPromo.tsx")
    assert.match(promo, /getPublicMobileAppLinks\(\)/)
    assert.match(promo, /iosReady \? "Get it for" : "Coming soon for"/)
    assert.match(promo, /aria-hidden="true">C<\/span>/)
    assert.doesNotMatch(promo, /Install options are shown only when verified releases are ready/)
    assert.match(read("src/lib/mobileAppDownloads.ts"), /process\.env\.NEXT_PUBLIC_CARMAZIUM_IOS_APP_URL/)
})

test("visible copy uses the CarMazium brand casing, UK spelling and UK time", () => {
    for (const file of webFiles) {
        const lines = read(file).split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
        const text = lines.join("\n")
        assert.doesNotMatch(text, /(?<![@./\w-])Carmazium(?![\w-]|\.(com|co))(?! Ltd)/, file)
        assert.doesNotMatch(text, /\bFinali[z]e/, file)
    }
    assert.match(read("src/components/layout/Footer.tsx"), /9am – 6pm UK time/)
})
