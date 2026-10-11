import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const home = read("src/app/HomeClient.tsx")
const compact = read("src/components/features/HomeAppPromoCompact.tsx")
const large = read("src/components/layout/FooterAppPromo.tsx")
const installation = read("src/app/download-app/page.tsx")

test("homepage replaces old low-contrast banner instead of stacking another identical strip", () => {
  assert.ok(home.includes("<HomeAppPromoCompact />"))
  assert.equal(home.split("<HomeAppPromoCompact />").length - 1, 1)
  assert.ok(!home.includes("iPhone or Android — check the verified install links"))
  assert.ok(!home.includes("iPhone &amp; Android"))
  assert.ok(!home.includes("bg-gradient-to-r from-red-500/10 via-[var(--bg-card)]"))
  assert.ok(home.indexOf("<HomeAppPromoCompact />") < home.indexOf("<DiscoverSection />"))
})

test("compact banner shares approved campaign palette while remaining compact and responsive", () => {
  assert.ok(compact.includes("bg-[#0a1850]"))
  assert.ok(compact.includes("from-[#ffbc93]"))
  assert.ok(compact.includes("sm:grid-cols-3"))
  assert.ok(compact.includes("lg:grid-cols-[1fr_1.15fr]"))
  assert.ok(compact.includes("motion-reduce:transform-none"))
  assert.ok(compact.includes('aria-labelledby="carmazium-app-home-title"'))
  assert.ok(compact.includes('id="carmazium-app-home-title"'))
})

test("platform CTAs route to verified installation status and Microsoft Store is honest", () => {
  assert.ok(compact.includes('href="/download-app#iphone"'))
  assert.ok(compact.includes('href="/download-app#android"'))
  assert.ok(compact.includes("Microsoft Store"))
  assert.ok(compact.includes('href="/download-app#windows"'))
  assert.ok(compact.includes("Check official CarMazium Microsoft Store installation options"))
  assert.ok(!compact.includes('href="https://'))
  assert.ok(!compact.includes("cursor-default"))
  assert.ok(installation.includes('id="iphone"'))
  assert.ok(installation.includes('id="android"'))
  assert.ok(installation.includes('id="windows"'))
  assert.ok(installation.includes("links.microsoftStore.href"))
})

test("larger footer artwork keeps its visuals and makes Microsoft CTA clickable", () => {
  assert.ok(large.includes('id="footer-app-promo-heading"'))
  assert.ok(large.includes("Microsoft Store"))
  assert.ok(large.includes('href="/download-app#windows"'))
  assert.ok(large.includes("See official CarMazium Microsoft Store installation options"))
  assert.ok(!large.includes("cursor-not-allowed"))
})
