import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const require = createRequire(import.meta.url)
const home = read('src/app/HomeClient.tsx')
const ignoredMotion = new Set(['initial', 'animate', 'exit', 'transition', 'viewport', 'whileInView', 'whileHover'])
const motion = new Proxy({}, { get: (_, tag) => ({ children, ...props }) => React.createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !ignoredMotion.has(key))), children) })
const Link = ({children, ...props}) => React.createElement('a', props, children)
const Button = ({children, asChild, variant, shape, size, ...props}) => asChild ? children : React.createElement('button', props, children)
const Image = ({priority, fill, ...props}) => React.createElement('img', props)
function load(path) {
  const exports = {}
  const compiled = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  runInNewContext(compiled, { exports, console, URLSearchParams, require(id) {
    if (id === 'next/image') return Image
    if (id === 'next/link') return Link
    if (id === 'next/navigation') return { useRouter: () => ({ push() {} }) }
    if (id === 'next/dynamic') return () => () => null
    if (id === 'framer-motion') return { motion, AnimatePresence: ({children}) => children }
    if (id.endsWith('.css')) return new Proxy({}, { get: (_, key) => key })
    if (id === '@/components/features/BrowseByCategory') return load('src/components/features/BrowseByCategory.tsx')
    if (id === '@/components/ui/Button') return { Button }
    if (id === '@/components/ui/buttonVariants') return { buttonVariants: () => '' }
    if (id === '@/lib/utils') return { cn: (...xs) => xs.filter(Boolean).join(' ') }
    if (id === '@/context/AuthContext') return { useAuth: () => ({ profile: null }) }
    if (id === '@/lib/tradeAccess') return { canAccessTradeStock: () => false }
    if (id.startsWith('@/')) return new Proxy({}, { get: () => () => null })
    return require(id)
  } }, { filename: path })
  return exports
}
const html = renderToStaticMarkup(React.createElement(load('src/app/HomeClient.tsx').default, { initialListings: [], latestRetailListings: [] }))

test('server render exposes one readable hero and the AI form before hydration', () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1)
  assert.match(html, /Your car\.<br\/>Your choice\./)
  assert.match(html, /Sell your car through a free dealer auction/)
  assert.match(html, /<form[^>]*aria-busy="false"/)
  assert.match(html, /<label[^>]*for="home-ai-query"[^>]*>Describe the car you want/)
  assert.match(html, /Find matching cars/)
  const hero = html.slice(html.indexOf('<section'), html.indexOf('</section>'))
  assert.doesNotMatch(hero, /opacity:0|visibility:hidden|display:none/)
})

test('hero is a bounded static image with no autoplay or hydration-dependent theme selection', () => {
  assert.doesNotMatch(html, /<video/)
  assert.doesNotMatch(home, /showHeroVideo|heroPosterSrc|useScroll|useTransform/)
  assert.match(html, /home-marketplace-cars.webp/)
  assert.match(html, /width="1200" height="800"/)
  assert.ok(statSync(new URL('../public/assets/images/home-marketplace-cars.webp', import.meta.url)).size < 180000)
})

test('seller entry links carry the real channel and basic package while normal browse stays available', () => {
  assert.match(html, /href="\/sell\?sellMode=retail&amp;package=basic#sell-options"/)
  assert.match(html, /href="\/sell\?sellMode=auction#sell-options"/)
  assert.match(html, /href="\/sell"/)
  assert.match(html, /href="\/search"/)
  assert.match(html, /href="\/pricing"/)
  assert.match(html, /href="\/how-it-works"/)
  assert.match(html, /after approved handover\. Terms apply/)
})

test('all eight body types and all eight shopping categories retain crawlable filter links', () => {
  const body = renderToStaticMarkup(React.createElement(load('src/components/features/BrowseByBodyType.tsx').BrowseByBodyType))
  for (const type of ['COUPE', 'CONVERTIBLE', 'HATCHBACK', 'MPV', 'PICKUP_TRUCK', 'SEDAN', 'SUV', 'ESTATE']) assert.ok(body.includes('/search?bodyType=' + type))
  assert.ok(body.includes('/used-car-types'))
  for (const label of ['Small and sporty', 'Eco-friendly', 'Automatic', 'Seven-seater', 'Affordable 4x4', 'Great first cars', 'Dog-friendly', 'Fuel-efficient']) assert.ok(html.includes(label))
  assert.equal((html.match(/>Automatic<\/a>/g) || []).length, 1, 'categories must not be triplicated for an auto-moving carousel')
})
