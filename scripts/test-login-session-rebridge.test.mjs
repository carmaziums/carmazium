import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(path.join(root, p), 'utf8')
const source = read('src/lib/supabaseSessionIdentity.ts')
const auth = read('src/context/AuthContext.tsx')
const api = read('src/lib/apiClient.ts')

const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const context = { exports: {}, atob }
vm.runInNewContext(compiled, context)
const { isSessionTokenForUser } = context.exports
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const tokenFor = sub => encode({ alg: 'HS256' }) + '.' + encode({ sub }) + '.placeholder'

test('recovery accepts only the current Supabase identity, never a previous signed-in account', () => {
  assert.equal(isSessionTokenForUser(tokenFor('current-user'), 'current-user'), true)
  assert.equal(isSessionTokenForUser(tokenFor('previous-user'), 'current-user'), false)
  assert.equal(isSessionTokenForUser('broken.jwt', 'current-user'), false)
  assert.equal(isSessionTokenForUser('', 'current-user'), false)
  assert.equal(isSessionTokenForUser(tokenFor('current-user'), ''), false)
  assert.equal(isSessionTokenForUser(tokenFor(undefined), 'current-user'), false)
})

test('initial failed session bridge is not permanently marked successful', () => {
  assert.match(auth, /if \(bridgedTokenRef\.current === token && activeUserIdRef\.current === userId\)/)
  assert.match(auth, /bridgedTokenRef\.current = null/)
  assert.match(auth, /bridgeInFlightRef\.current === work/)
})

test('retry reconstructs the backend session before fetching the profile', () => {
  const start = auth.indexOf('    const refreshProfile = async () => {')
  const end = auth.indexOf('\n    return (', start)
  assert.ok(start > 0 && end > start)
  const recovery = auth.slice(start, end)
  assert.match(recovery, /getAccessToken\(\)/)
  assert.match(recovery, /refreshAccessToken\(\)/)
  assert.match(recovery, /isSessionTokenForUser\(token, expectedUserId\)/)
  assert.match(recovery, /apiClient\('\/auth\/supabase-session'/)
  assert.match(recovery, /method: 'POST'/)
  assert.ok(recovery.indexOf("apiClient('/auth/supabase-session'") < recovery.lastIndexOf('await fetchProfile(expectedUserId)'))
  assert.match(recovery, /activeUserIdRef\.current === expectedUserId/)
  assert.match(recovery, /profileRecoveryInFlightRef/)
  assert.doesNotMatch(recovery, /supabase\.auth\.getSession\(\)/)
})

test('the same already-verified profile only refreshes, without another session bridge', () => {
  assert.match(auth, /if \(profile\?\.id === expectedUserId\) \{\s*await fetchProfile\(expectedUserId\)\s*return/)
})

test('expired Supabase bridge does not redirect before one bounded token refresh', () => {
  assert.match(api, /response\.status === 401 && endpoint === '\/auth\/supabase-session'/)
  assert.match(api, /throw new Error\('AUTH_BRIDGE_UNAUTHORIZED'\)/)
  const special = api.indexOf("endpoint === '/auth/supabase-session'")
  const genericRedirect = api.indexOf('if (isAuthError(response.status, message))')
  assert.ok(special < genericRedirect)
  assert.match(auth, /bridgeResult === 'unauthorized'/)
  assert.match(auth, /const refreshed = await refreshAccessToken\(\)/)
})

test('recovery does not weaken backend-verified role or identity checks', () => {
  assert.match(auth, /response\.data\?\.id === expectedUserId/)
  assert.match(auth, /activeUserIdRef\.current === expectedUserId/)
  assert.doesNotMatch(auth, /user_metadata\?\.role/)
  assert.match(auth, /await apiClient\('\/auth\/supabase-session'/)
})
