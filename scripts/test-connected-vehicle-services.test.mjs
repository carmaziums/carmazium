import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
function load(path, mocks = {}) {
    const exports = {}
    const { outputText } = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
    vm.runInNewContext(outputText, { exports, URLSearchParams, encodeURIComponent, require: n => mocks[n] || require(n) })
    return exports
}
const context = load('src/lib/vehicleServiceContext.ts')
const listing = { id: 'vehicle-123', title: 'Toyota & Lexus?', status: 'ACTIVE', type: 'CLASSIFIED', vrm: 'AB12 CDE', make: 'Toyota', model: 'Yaris', year: 2020, location: 'Birmingham & area' }
test('delivery and inspection carry the same selected vehicle without corrupting special characters', () => {
    for (const kind of ['delivery', 'inspection']) {
        const url = new URL(context.vehicleServicePath(kind, listing), 'https://example.test')
        assert.equal(url.pathname, `/services/${kind}/new`)
        for (const [key, value] of Object.entries({ listingId: listing.id, vehicleTitle: listing.title, registration: listing.vrm, pickup: listing.location, year: '2020' })) assert.equal(url.searchParams.get(key), value)
    }
})
function render(vehicle, enabled = true) {
    const { VehicleServicesPanel } = load('src/components/services/VehicleServicesPanel.tsx', {
        '@/lib/vehicleServiceContext': context, '@/lib/apiClient': {},
        '@/lib/featureFlags': Object.fromEntries(['delivery', 'inspection', 'finance', 'warranty'].map(k => [k + 'ServiceEnabled', enabled])),
        'next/link': { __esModule: true, default: props => React.createElement('a', props) },
    })
    return renderToStaticMarkup(React.createElement(VehicleServicesPanel, { listing: vehicle }))
}
test('panel presents connected retail services and checks finance before advertising it', () => {
    const html = render(listing)
    for (const text of ['Warranty', 'Inspection', 'Delivery', 'Checking finance availability', 'pay the seller directly']) assert.ok(html.includes(text))
    assert.ok(!html.includes('href="/services/finance'))
    assert.ok(html.includes('/services/inspection/new?listingId=vehicle-123'))
})
test('no services are promoted for closed stock, auctions or disabled services', () => {
    for (const status of ['SOLD', 'OFFER_ACCEPTED', 'DRAFT', 'WITHDRAWN']) assert.equal(render({ ...listing, status }), '')
    assert.equal(render({ ...listing, type: 'AUCTION' }), '')
    assert.equal(render(listing, false), '')
})
