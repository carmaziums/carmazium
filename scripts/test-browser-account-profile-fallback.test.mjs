import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => readFileSync(path.join(root, file), 'utf8')
const routeSource = read('src/app/api/account-profile/route.ts')
const apiSource = read('src/lib/apiClient.ts')
const authSource = read('src/context/AuthContext.tsx')

function routeWith(fetchWithRetry) {
  const compiled = ts.transpileModule(routeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(compiled, {
    exports,
    require: () => ({ fetchWithRetry }),
    Request, Response, URL,
    process: { env: { NEXT_PUBLIC_API_URL: 'https://carmazium-hjoh9w.fly.dev' } },
  })
  return exports.GET
}

test('same-origin profile relay requires bearer authorization', async () => {
  let calls = 0
  const get = routeWith(async () => { calls++; throw new Error('unexpected request') })
  const response = await get(new Request('https://www.carmazium.com/api/account-profile'))
  assert.equal(response.status, 401)
  assert.equal(calls, 0)
})

test('relay forwards only the bearer token to a fixed GET endpoint, never browser cookies', async () => {
  let seen
  const get = routeWith(async (url, opts, retries) => {
    seen = { url, opts, retries }
    return Response.json({ success: true, data: { id: 'verified-user', role: 'ADMIN' } })
  })
  const response = await get(new Request('https://www.carmazium.com/api/account-profile', {
    headers: { Authorization: 'Bearer signed.jwt.token', Cookie: 'sid=wrong-user' },
  }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).data.id, 'verified-user')
  assert.equal(seen.url, 'https://carmazium-hjoh9w.fly.dev/users/me')
  assert.equal(seen.opts.method, 'GET')
  assert.equal(seen.opts.cache, 'no-store')
  assert.equal(seen.opts.headers.Authorization, 'Bearer signed.jwt.token')
  assert.ok(!Object.keys(seen.opts.headers).some(k => k.toLowerCase() === 'cookie'))
  assert.equal(seen.retries.retries, 2)
  assert.match(response.headers.get('cache-control'), /no-store/)
})

test('relay preserves backend authentication rejection and never fabricates a profile', async () => {
  const get = routeWith(async () => new Response(null, { status: 401 }))
  const response = await get(new Request('https://www.carmazium.com/api/account-profile', {
    headers: { Authorization: 'Bearer invalid.jwt.token' },
  }))
  assert.equal(response.status, 401)
  assert.ok(!(await response.json()).data)
})

test('relay handles Fly connection failure safely without leaking backend traces', async () => {
  const get = routeWith(async () => { throw new Error('secret connection address') })
  const response = await get(new Request('https://www.carmazium.com/api/account-profile', {
    headers: { Authorization: 'Bearer signed.jwt.token' },
  }))
  assert.equal(response.status, 503)
  assert.doesNotMatch(await response.text(), /secret connection address/)
})

test('browser fallback is restricted to GET /users/me; writes and 401 are not replayed', () => {
  assert.match(apiSource, /endpoint === '\/users\/me' && method === 'GET'/)
  assert.match(apiSource, /typeof window !== 'undefined'/)
  assert.match(apiSource, /fetchWithRetry\('\/api\/account-profile'/)
  assert.match(apiSource, /credentials: 'same-origin'/)
  assert.match(apiSource, /cache: 'no-store'/)
  assert.match(apiSource, /if \(canRecoverProfile && !options\.signal\?\.aborted\)/)
  assert.match(apiSource, /\[502, 503, 504\]\.includes\(response\.status\)/)
  assert.match(apiSource, /if \(response\.status === 401 && \(isAdminMutation \|\| isIdempotentRead\)\)/)
  assert.match(authSource, /response\.data\?\.id === expectedUserId/)
  assert.doesNotMatch(authSource, /user_metadata\?\.role/)
})
