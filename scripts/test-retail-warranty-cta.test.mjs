import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function loadCta(enabled = true) {
    const source = readFileSync(new URL('../src/components/services/VehicleWarrantyCta.tsx', import.meta.url), 'utf8')
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    })
    const exports = {}
    runInNewContext(outputText, { exports, encodeURIComponent, require: name => {
        if (name === '@/lib/featureFlags') return { warrantyServiceEnabled: enabled }
        if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
        return require(name)
    } })
    return props => renderToStaticMarkup(React.createElement(exports.VehicleWarrantyCta, props))
}

test('active retail cards and detail pages link the correct vehicle to the warranty form', () => {
    for (const compact of [true, false]) {
        const html = loadCta()({ listingId: 'car-123', listingType: 'CLASSIFIED', status: 'ACTIVE', compact })
        assert.match(html, /Buy this car with warranty/)
        assert.match(html, /href="\/services\/warranty\?listingId=car-123"/)
        if (!compact) assert.match(html, /Cover is arranged separately with the provider/)
    }
})

test('closed listings, auctions, missing identities and the emergency off switch cannot show the CTA', () => {
    const base = { listingId: 'car-123', listingType: 'CLASSIFIED', status: 'ACTIVE' }
    for (const status of ['SOLD', 'OFFER_ACCEPTED', 'WITHDRAWN', 'DRAFT', 'PENDING_REVIEW', 'REJECTED']) {
        assert.equal(loadCta()({ ...base, status }), '')
    }
    assert.equal(loadCta()({ ...base, listingType: 'AUCTION' }), '')
    assert.equal(loadCta()({ ...base, listingId: undefined }), '')
    assert.equal(loadCta(false)(base), '')
})
