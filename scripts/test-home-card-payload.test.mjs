import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8")
const fieldsSrc = read("src/lib/homeCardListing.ts")
const fields = [...fieldsSrc.matchAll(/"([a-zA-Z]+)"/g)].map(m => m[1])

test("homepage sends only card fields to the browser", () => {
    const page = read("src/app/page.tsx")
    assert.match(page, /initialListings=\{featuredListings\.map\(toHomeCard\)\}/)
    assert.match(page, /latestRetailListings=\{latestRetailListings\.map\(toHomeCard\)\}/)
    for (const heavy of ["motHistory", "officialVehicleData", "vin", "vrm", "features", "seller", "description"]) {
        assert.ok(!fields.includes(heavy), heavy + " must not be sent to homepage cards")
    }
})

test("every field the homepage cards read is included", () => {
    const client = read("src/app/HomeClient.tsx")
    const used = new Set([...client.matchAll(/listing\.([a-zA-Z]+)/g)].map(m => m[1]))
    for (const key of used) assert.ok(fields.includes(key), "missing " + key)
})

test("card carousels render photos near the current slide, not the whole gallery", () => {
    const carousel = read("src/components/features/CardImageCarousel.tsx")
    // Only the cover is initially in the DOM; touch/trackpad/arrow input
    // mounts adjacent images before movement without paid transforms.
    assert.match(carousel, /i <= maxReached &&/)
    assert.match(carousel, /onTouchStart=\{prepareAdjacentImage\}/)
    assert.match(carousel, /src=\{cardImageUrl\(photo\.src\)\}/)
    // Arrow / keyboard navigation must mount the target image before scrolling.
    assert.match(carousel, /setMaxReached\(\(prev\) => Math\.max\(prev, clamped \+ 1\)\)/)
    assert.match(carousel, /requestAnimationFrame\(\(\) => \{/)
})

test("card photo resizing is opt-in (it is a billed Supabase feature)", () => {
    const helper = read("src/lib/cardImageUrl.ts")
    assert.match(helper, /NEXT_PUBLIC_CARD_IMAGE_RESIZE !== "true"\) return src/)
})
