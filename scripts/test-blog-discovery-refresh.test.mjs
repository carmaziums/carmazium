import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, imports) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, require: name => imports[name], Response, Request, console })
  return exports
}
function route(fetcher) {
  const events = []
  const { POST } = load('src/app/api/blog/revalidate/route.ts', {
    '@/lib/serverBackendFetch': { serverBackendFetch: fetcher },
    'next/cache': {
      revalidateTag: (...args) => events.push(['tag', ...args]),
      revalidatePath: (...args) => events.push(['path', ...args]),
    },
  })
  return { POST, events }
}
function request(token = 'fixture-token') {
  return new Request('https://www.carmazium.com/api/blog/revalidate?path=/dashboard', {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}`, Cookie: 'do-not-forward' } : {},
    body: JSON.stringify({ path: '/dashboard', tags: ['private'] }),
  })
}
test('unauthenticated refresh never calls backend or expires cached pages', async () => {
  const { POST, events } = route(() => { throw new Error('must not run') })
  assert.equal((await POST(request(null))).status, 401)
  assert.equal(events.length, 0)
})
test('denied admin identity and upstream failure never invalidate any cache', async () => {
  for (const status of [401, 403, 500]) {
    const { POST, events } = route(async () => new Response(null, { status }))
    assert.equal((await POST(request())).status, status === 500 ? 503 : status)
    assert.equal(events.length, 0)
  }
  const { POST, events } = route(async () => Response.json({ data: [] }))
  assert.equal((await POST(request())).status, 502)
  assert.equal(events.length, 0)
})
test('verified admin refresh expires only blog data, blog routes and sitemap', async () => {
  let seen
  const { POST, events } = route(async (...args) => {
    seen = args
    return Response.json({ success: true, data: [], pagination: { total: 0 } })
  })
  const response = await POST(request())
  assert.equal(response.status, 200)
  assert.equal((await response.json()).refreshed, true)
  assert.equal(seen[0], '/blog/admin/all?page=1&limit=1')
  assert.equal(seen[1].cache, 'no-store')
  assert.deepEqual(Object.keys(seen[1].headers), ['Authorization'])
  assert.equal(seen[2].retries, 0)
  assert.equal(JSON.stringify(events), JSON.stringify([
    ['tag', 'public-blog', { expire: 0 }], ['path', '/sitemap.xml'], ['path', '/blog', 'layout'],
  ]))
})
const { blogCoverWidths, blogCoverSrcSet } = load('src/lib/blogCover.ts', {})
test('covers preserve small originals and offer at most three real sizes', () => {
  assert.equal(JSON.stringify(blogCoverWidths(1672)), '[480,960,1600]')
  assert.equal(JSON.stringify(blogCoverWidths(700)), '[480,700]')
  assert.equal(JSON.stringify(blogCoverWidths(320)), '[320]')
  assert.equal(blogCoverSrcSet('https://example.com/old.png'), undefined)
  assert.equal(blogCoverSrcSet('https://example.com/x-blogcover-w3000.webp'), undefined)
  assert.equal(blogCoverSrcSet('https://example.com/x-blogcover-w1600.webp'),
    'https://example.com/x-blogcover-w480.webp 480w, https://example.com/x-blogcover-w960.webp 960w, https://example.com/x-blogcover-w1600.webp 1600w')
})
