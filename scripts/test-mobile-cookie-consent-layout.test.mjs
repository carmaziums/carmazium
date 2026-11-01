import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const banner = read("src/components/analytics/CookieConsentBanner.tsx")
const consent = read("src/context/ConsentContext.tsx")

test("first-time visitors retain explicit accept, reject and cookie-policy access", () => {
  assert.match(banner, /if \(!bannerOpen\) return null/)
  assert.match(banner, /onClick=\{rejectAll\}/)
  assert.match(banner, /onClick=\{acceptAll\}/)
  assert.match(banner, /href="\/cookie-policy"/)
  assert.match(banner, /Reject All/)
  assert.match(banner, /Accept All/)
  assert.match(banner, /One cookie keeps you logged in/)
  assert.match(consent, /openPreferences: \(\) => setBannerOpen\(true\)/)
  assert.match(consent, /granted: hydrated && decision === "accepted"/)
})

test("cookie banner is compact on all mobile routes and retains readable desktop layout", () => {
  assert.match(banner, /className="fixed bottom-0 inset-x-0 z-\[100\] p-2 sm:p-5"/)
  assert.match(banner, /items-start sm:items-center p-3 gap-2 sm:p-6 sm:gap-4/)
  assert.match(banner, /className="hidden sm:flex w-10 h-10/)
  assert.match(banner, /className="text-xs sm:text-sm text-\[var\(--text-secondary\)\] leading-relaxed/)
  assert.match(banner, /flex items-center gap-2 shrink-0 w-full sm:w-auto/)
  assert.match(banner, /py-2 sm:py-2\.5/)
  assert.doesNotMatch(banner, /isSellLanding|usePathname/)
})
