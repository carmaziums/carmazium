#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = path => readFileSync(resolve(root, path), 'utf8')
const code = ts.transpileModule(read('src/lib/dashboardAccess.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
new Function('exports', code)(exports)
const { getDashboardAccessDecision: dashboard, getAdminAccessDecision: admin } = exports

const incomplete = { role: 'BUYER', firstName: 'Buyer' }
const complete = { role: 'DEALER', firstName: 'A', lastName: 'B',
  phone: '01234', location: 'Birmingham', postcode: 'B1 1AA' }
const administrator = { role: 'ADMIN' } // no seller/dealer onboarding details

const route = (profile, pathname = '/dashboard') => dashboard({
  loading: false, hasUser: true, profile, pathname,
})
const adminRoute = profile => admin({ loading: false, hasUser: true, profile })

test('verified ADMIN bypasses buyer/dealer onboarding and goes directly to admin', () => {
  assert.equal(route(administrator), 'admin')
  assert.equal(route(administrator, '/dashboard/user'), 'admin')
  assert.equal(route(administrator, '/dashboard/dealer'), 'admin')
  assert.equal(route(administrator, '/dashboard/admin'), 'ready')
  assert.equal(route(administrator, '/dashboard/admin/users'), 'ready')
  assert.equal(adminRoute(administrator), 'ready')
})

test('temporary profile API failure cannot turn an admin session into buyer onboarding', () => {
  assert.equal(route(null), 'profile-unavailable')
  assert.equal(route(null, '/dashboard/admin'), 'ready')
  assert.equal(adminRoute(null), 'profile-unavailable')
})

test('ordinary users still complete onboarding if required', () => {
  assert.equal(route(incomplete), 'onboarding')
  assert.equal(route({ ...complete, role: 'SELLER', phone: '  ' }), 'onboarding')
  assert.equal(route(complete), 'ready')
  assert.equal(route({ ...complete, role: 'FINANCE_PARTNER' }), 'ready')
})

test('admin access must be denied to ordinary profiles and never inferred from auth metadata', () => {
  assert.equal(adminRoute(complete), 'denied')
  assert.equal(adminRoute(incomplete), 'denied')
  assert.equal(adminRoute({ role: 'SELLER' }), 'denied')
  assert.equal(adminRoute(null), 'profile-unavailable')
  assert.equal(admin({ loading: true, hasUser: true, profile: administrator }), 'loading')
  assert.equal(admin({ loading: false, hasUser: false, profile: administrator }), 'login')
  assert.equal(dashboard({ loading: false, hasUser: false, profile: administrator, pathname: '/dashboard/admin' }), 'login')
})

test('routing uses authenticated backend profile, not client-side user_metadata', () => {
  const source = read('src/lib/dashboardAccess.ts')
  assert.ok(source.includes('profile.role'))
  assert.ok(!source.includes('user_metadata'))
  const landing = read('src/app/dashboard/page.tsx')
  assert.ok(landing.includes("profile.role"))
  assert.ok(!landing.includes("user_metadata?.role"))
})

test('every admin page is guarded and previous redirect loops are removed', () => {
  const layout = read('src/app/dashboard/admin/layout.tsx')
  assert.ok(layout.includes('<AdminAccessGate>'))
  const gate = read('src/components/dashboard/AdminAccessGate.tsx')
  assert.ok(gate.includes('getAdminAccessDecision'))
  assert.ok(gate.includes('Retry admin verification'))
  assert.ok(!gate.includes('user_metadata'))
  const dashboardGate = read('src/components/dashboard/ProfileCompletionGate.tsx')
  assert.ok(dashboardGate.includes('getDashboardAccessDecision'))
  assert.ok(dashboardGate.includes('profile-unavailable'))
  const adminPage = read('src/app/dashboard/admin/page.tsx')
  assert.ok(!adminPage.includes("router.replace('/dashboard')"))
  const onboarding = read('src/app/auth/onboarding/page.tsx')
  assert.ok(onboarding.includes('isVerifiedAdmin'))
  assert.ok(onboarding.includes('router.replace("/dashboard/admin")'))
  const header = read('src/components/layout/Header.tsx')
  assert.ok(header.includes('Admin Control Panel'))
})
