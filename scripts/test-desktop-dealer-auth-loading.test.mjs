import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(path.resolve(root, file), 'utf8')
const auth = read('src/context/AuthContext.tsx')
const dashboardGate = read('src/components/dashboard/ProfileCompletionGate.tsx')
const dealerLayout = read('src/app/dashboard/dealer/layout.tsx')
const roleDecision = read('src/lib/dashboardAccess.ts')

test('browser auth event callback is synchronous and never acquires the nested Supabase auth lock', () => {
    const source = ts.createSourceFile('AuthContext.tsx', auth, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const callbacks = []
    const visit = node => {
        if (ts.isCallExpression(node) && node.expression.getText(source).endsWith('.onAuthStateChange')) {
            callbacks.push(node.arguments[0])
        }
        ts.forEachChild(node, visit)
    }
    visit(source)
    assert.equal(callbacks.length, 1)
    assert.ok(ts.isArrowFunction(callbacks[0]))
    assert.ok(!callbacks[0].modifiers?.some(x => x.kind === ts.SyntaxKind.AsyncKeyword))
    assert.match(callbacks[0].getText(source), /setTimeout/)
    assert.doesNotMatch(callbacks[0].getText(source), /\bawait\b/)
})

test('initial session has a bounded fallback with a safe profile-unavailable state', () => {
    assert.match(auth, /const watchdog = setTimeout/)
    assert.match(auth, /18000/)
    assert.match(auth, /supabase\.auth\.getSession\(\)\.then/)
    assert.match(auth, /\.catch\(\(error\)/)
    assert.match(dashboardGate, /decision === "profile-unavailable"/)
    assert.match(roleDecision, /if \(!profile\) return "profile-unavailable"/)
})

test('startup deduplicates bridge requests and prevents cross-account profile display', () => {
    assert.match(auth, /bridgeInFlightRef/)
    assert.match(auth, /bridgedTokenRef\.current === token && bridgeInFlightRef\.current/)
    assert.match(auth, /activeUserIdRef\.current === expectedUserId/)
    assert.match(auth, /response\.data\?\.id === expectedUserId/)
    assert.match(auth, /if \(previousUserId && previousUserId !== userId\)/)
    assert.match(auth, /subscription\.unsubscribe\(\)/)
})

test('dealer access and KYC remain server-verified and untouched', () => {
    assert.match(dealerLayout, /access\?\.isVerified === true/)
    assert.match(dealerLayout, /profile\?\.dealerProfile\?\.isVerified/)
    assert.match(dealerLayout, /DealerPermissionGate/)
    assert.match(auth, /apiClient<\{ success: boolean; data: UserProfile \}>\('\/users\/me'\)/)
    assert.doesNotMatch(auth, /user_metadata\?\.role/)
})
