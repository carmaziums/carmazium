import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(path.join(root, p), 'utf8')
const page = read('src/app/auth/login/page.tsx')
const auth = read('src/context/AuthContext.tsx')

test('login does not treat every signed-in user as a permanent loading spinner', () => {
  assert.ok(!page.includes('if (authLoading || user)'))
  assert.match(page, /if \(authLoading\)/)
  assert.match(page, /if \(user && !profile\)/)
  assert.match(page, /if \(user && profile\)/)
  assert.match(page, /Account verification temporarily unavailable/)
})

test('signed-in accounts without a backend profile get recovery rather than customer registration', () => {
  assert.match(page, /retryAccountVerification/)
  assert.match(page, /refreshProfile\(\)/)
  assert.match(page, /Retry account verification/)
  assert.match(page, /signOutAndRetry/)
  assert.match(page, /Sign out and try another account/)
  assert.ok(!page.includes('user_metadata?.role'))
})

test('verified dealer and admin navigate directly to verified-role workspaces', () => {
  assert.match(page, /profile\?\.role === "ADMIN"/)
  assert.match(page, /profile\?\.role === "DEALER"/)
  assert.match(page, /"\/dashboard\/dealer"/)
  assert.match(page, /"\/dashboard\/admin"/)
  assert.match(page, /targetAfterLogin\.startsWith\("\/dashboard\/admin"\)/)
  assert.match(page, /showManualNavigation/)
  assert.match(page, /Open dashboard directly/)
})

test('profile recovery does not wait indefinitely for another Supabase auth lock', () => {
  const start = auth.indexOf('    const refreshProfile = async () => {')
  const end = auth.indexOf('\n    return (', start)
  assert.ok(start > 0 && end > start)
  const fn = auth.slice(start, end)
  assert.ok(!fn.includes('supabase.auth.getSession()'))
  assert.match(fn, /fetchProfile\(expectedUserId\)/)
  assert.match(auth, /activeUserIdRef\.current === expectedUserId/)
  assert.match(auth, /response\.data\?\.id === expectedUserId/)
  assert.match(auth, /const watchdog = setTimeout/)
  assert.match(auth, /18000/)
})

test('password login, Apple/Google OAuth and email-verification controls remain available', () => {
  assert.match(page, /supabase\.auth\.signInWithPassword\(formData\)/)
  assert.match(page, /provider: "apple"/)
  assert.match(page, /provider: "google"/)
  assert.match(page, /email_confirmed_at/)
  assert.match(page, /redirectTo:/)
})
