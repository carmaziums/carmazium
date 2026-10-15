#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('public contact form composes an email instead of silently discarding the enquiry', () => {
    const web = read('src/app/contact/page.tsx')
    assert.match(web, /onSubmit=\{openEmailDraft\}/)
    assert.match(web, /event\.preventDefault\(\)/)
    assert.match(web, /new FormData\(event\.currentTarget\)/)
    assert.match(web, /window\.location\.href = "mailto:info@carmazium\.com\?subject="/)
    assert.match(web, /encodeURIComponent\(/)
    assert.match(web, /Nothing is sent from this website automatically\./)
    assert.match(web, /type="submit".*Open email draft/)
    for (const field of ['fullName', 'email', 'subject', 'message']) {
        assert.match(web, new RegExp('name="' + field + '"[^>]*required'))
    }
    assert.match(web, /type="email"/)
    assert.match(web, /role="status"/)
    assert.doesNotMatch(web, /<Button className="w-full">Send Message<\/Button>/)
})

test('website, app and app-support page share genuine public contact details', () => {
    const web = read('src/app/contact/page.tsx')
    const native = read('carmazium app/carmazium app/src/screens/main/ContactScreen.tsx')
    const support = read('src/app/app-support/page.tsx')
    const footer = read('src/components/layout/Footer.tsx')

    for (const file of [web, native, support, footer]) {
        assert.match(file, /info@carmazium\.com/)
        assert.match(file, /0121 838 5040/)
    }
    assert.match(web, /tel:\+441218385040/)
    assert.match(native, /tel:\+441218385040/)
    assert.match(support, /tel:\+441218385040/)
    assert.match(native, /181–187 Hunters Road/)
    assert.match(native, /B19 1ES/)
    assert.match(native, /accessibilityRole="button"/)
    assert.match(native, /maps\/search\/\?api=1/)
    for (const oldClaim of ['123 Luxury Lane', 'Mayfair, London', '+44 (0) 20 1234 5678', 'support@carmazium.com']) {
        assert.ok(!native.includes(oldClaim), 'Placeholder native contact detail: ' + oldClaim)
    }
})

test('contact page has discoverable canonical metadata, not an invented action endpoint', () => {
    const layout = read('src/app/contact/layout.tsx')
    const page = read('src/app/contact/page.tsx')
    assert.match(layout, /canonical: "\/contact"/)
    assert.match(page, /mailto:info@carmazium\.com/)
    assert.doesNotMatch(page, /fetch\(["']\/api\/contact/)
})
