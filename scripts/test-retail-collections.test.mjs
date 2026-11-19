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
    vm.runInNewContext(outputText, { exports, URLSearchParams, require: name => mocks[name] || require(name) })
    return exports
}
const listing = { slug: 'ford-fiesta-2019-1234', type: 'CLASSIFIED', status: 'ACTIVE', title: 'Ford Fiesta', make: 'Ford', year: 2019, location: 'Birmingham', price: 5000, mileage: 33000 }
const collections = { makes: [{ slug: 'ford', label: 'Ford', count: 41 }], locations: [{ slug: 'birmingham', label: 'Birmingham', count: 41 }] }
function app(total = 41) {
    const queries = []
    const catalogue = load('src/lib/retailCatalogue.ts', {
        react: { cache: fn => fn }, '@/components/seo/RetailVehicleJsonLd': { indexableRetail: l => l.status === 'ACTIVE' },
        '@/lib/serverBackendFetch': { serverBackendFetch: async url => { queries.push(new URLSearchParams(url.split('?')[1])); return { ok: true, json: async () => ({ data: total ? [listing] : [], pagination: { total, totalPages: Math.ceil(total / 40) } }) } } },
    })
    const paths = { collectionPath: (kind, slug, page = 1) => `/used-cars/${kind === 'makes' ? 'make' : 'in'}/${slug}${page > 1 ? `?page=${page}` : ''}`, getRetailCollections: async () => collections }
    const component = load('src/components/seo/RetailCollectionPage.tsx', {
        '@/lib/retailCollections': paths, '@/lib/retailCatalogue': catalogue, './RetailVehicleJsonLd': { retailVehicleName: l => l.title },
        '@/lib/listingApi': { formatPrice: p => `£${p}` }, 'next/navigation': { notFound() { throw new Error('404') } },
        'next/link': { __esModule: true, default: props => React.createElement('a', props) },
    })
    return { ...component, queries }
}
const props = (slug, page) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(page ? { page } : {}) })
test('make and location pages keep their filter through metadata, results and pagination', async () => {
    for (const [kind, slug, field, value] of [['makes', 'ford', 'make', 'Ford'], ['locations', 'birmingham', 'location', 'Birmingham']]) {
        const a = app(); const p = props(slug, '2')
        const meta = await a.collectionMetadata(kind, p)
        assert.equal(meta.alternates.canonical, `https://www.carmazium.com/used-cars/${kind === 'makes' ? 'make' : 'in'}/${slug}?page=2`)
        assert.equal(meta.robots.index, true)
        const html = renderToStaticMarkup(await a.RetailCollectionPage({ kind, ...p }))
        assert.match(html, /Ford Fiesta/); assert.match(html, /Previous page/); assert.match(html, /BreadcrumbList/)
        assert.ok(html.includes(`${field}=${value}`)); assert.ok(html.includes('vehicleType=CAR'))
        for (const q of a.queries) { assert.equal(q.get(field), value); assert.equal(q.get('vehicleType'), 'CAR'); assert.equal(q.get('page'), '2') }
    }
})
test('unknown collection and invalid pagination return 404; empty known collection is noindex with recovery', async () => {
    const a = app(0)
    await assert.rejects(a.collectionMetadata('makes', props('invented')), /404/)
    await assert.rejects(a.collectionMetadata('makes', props('ford', '-1')), /404/)
    await assert.rejects(a.collectionMetadata('makes', props('ford', '2')), /404/)
    const meta = await a.collectionMetadata('makes', props('ford'))
    assert.equal(meta.robots.index, false)
    const html = renderToStaticMarkup(await a.RetailCollectionPage({ kind: 'makes', ...props('ford') }))
    assert.match(html, /No matching vehicles right now/); assert.match(html, /Browse all available vehicles/)
})
test('upstream collection outages are not silently cached as empty stock', async () => {
    const module = load('src/lib/retailCollections.ts', { react: { cache: fn => fn }, './serverBackendFetch': { serverBackendFetch: async () => ({ ok: false, status: 503 }) } })
    await assert.rejects(module.getRetailCollections(), /temporarily unavailable/)
})
