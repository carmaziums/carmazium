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


function browserClient({ fetchWithRetry, fetch = async () => { throw new Error('unexpected direct fetch') }, token = 'current.jwt', refresh = async () => null, timers = setTimeout } = {}) {
  const exports = {}
  const source = ts.transpileModule(apiSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(source, {
    exports, require: name => name === './supabase'
      ? { getAccessToken: async () => token, refreshAccessToken: refresh, supabase: { auth: { signOut: async () => {} } } }
      : { fetchWithRetry },
    process: { env: { NEXT_PUBLIC_API_URL: 'https://backend.example' } },
    window: { location: { pathname: '/auth/login', search: '' } },
    fetch, setTimeout: timers, clearTimeout, AbortController, Response, FormData,
  })
  return exports.apiClient
}

test('browser profile uses authenticated same-origin route first, with no direct request on success', async () => {
  const calls = []
  const client = browserClient({ fetchWithRetry: async (url, options, retry) => {
    calls.push({ url, options, retry })
    return Response.json({ success: true, data: { id: 'verified', role: 'DEALER' } })
  } })
  const result = await client('/users/me')
  assert.equal(result.data.role, 'DEALER')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/account-profile')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer current.jwt')
  assert.equal(calls[0].options.credentials, 'same-origin')
  assert.equal(calls[0].options.cache, 'no-store')
  assert.equal(calls[0].retry.retries, 0)
})

test('profile refresh stays on same-origin route and sends the newly refreshed token', async () => {
  const calls = []
  const client = browserClient({ refresh: async () => 'fresh.jwt', fetchWithRetry: async (url, options) => {
    calls.push({ url, authorization: options.headers.Authorization })
    return calls.length === 1 ? Response.json({ message: 'denied' }, { status: 401 })
      : Response.json({ success: true, data: { id: 'verified' } })
  } })
  await client('/users/me')
  assert.deepEqual(calls, [
    { url: '/api/account-profile', authorization: 'Bearer current.jwt' },
    { url: '/api/account-profile', authorization: 'Bearer fresh.jwt' },
  ])
})

test('a permission denial never tries an alternate route to obtain a profile', async () => {
  let calls = 0
  const client = browserClient({ fetchWithRetry: async () => {
    calls++
    return Response.json({ message: 'Account verification denied' }, { status: 403 })
  } })
  await assert.rejects(client('/users/me'), /Account verification denied/)
  assert.equal(calls, 1)
})

test('relay transport outage allows only one bounded direct profile read', async () => {
  const calls = []
  const client = browserClient({ fetchWithRetry: async (url, options, config) => {
    calls.push({ url, config })
    if (calls.length === 1) throw new Error('relay unavailable')
    return Response.json({ message: 'backend unavailable' }, { status: 503 })
  } })
  await assert.rejects(client('/users/me'), /backend unavailable/)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, 'https://backend.example/users/me')
  assert.equal(calls[1].config.timeoutMs, 4000)
  assert.equal(calls[1].config.retries, 0)
})

test('cancelled profile lookup cannot start a fallback request', async () => {
  const controller = new AbortController()
  let calls = 0
  const client = browserClient({ fetchWithRetry: async () => {
    calls++
    controller.abort()
    throw new Error('cancelled')
  } })
  await assert.rejects(client('/users/me', { signal: controller.signal }), /cancelled/)
  assert.equal(calls, 1)
})

test('other reads retain their backend path and guest profile reads are not relayed', async () => {
  const urls = []
  const client = browserClient({ token: null, fetchWithRetry: async url => {
    urls.push(url); return Response.json({ success: true })
  } })
  await client('/listings')
  await client('/users/me')
  assert.deepEqual(urls, ['https://backend.example/listings', 'https://backend.example/users/me'])
})

test('cookie bridge timeout is bounded and never replays the POST', async () => {
  let calls = 0
  let timeout
  const client = browserClient({
    timers: (callback, delay) => { timeout = delay; return setTimeout(callback, 1) },
    fetch: async (url, options) => {
      calls++
      assert.equal(url, 'https://backend.example/auth/supabase-session')
      assert.equal(options.method, 'POST')
      return await new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason)))
    },
  })
  await assert.rejects(client('/auth/supabase-session', { method: 'POST', body: '{}' }), /timed out/)
  assert.equal(timeout, 5000)
  assert.equal(calls, 1)
})
