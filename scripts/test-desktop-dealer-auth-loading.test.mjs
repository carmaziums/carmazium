import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import vm from 'node:vm'

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
    assert.match(auth, /if \(previousUserId !== userId\)/)
    assert.match(auth, /subscription\.unsubscribe\(\)/)
})

test('dealer access and KYC remain server-verified and untouched', () => {
    assert.match(dealerLayout, /access\?\.isVerified === true/)
    assert.match(dealerLayout, /profile\?\.dealerProfile\?\.isVerified/)
    assert.match(dealerLayout, /DealerPermissionGate/)
    assert.match(auth, /apiClient<\{ success: boolean; data: UserProfile \}>\('\/users\/me'\)/)
    assert.doesNotMatch(auth, /user_metadata\?\.role/)
})
function authHarness() {
    const state = []
    const scheduled = []
    let effect
    let watchdog
    let listener
    let resolveProfile
    const profileRequest = new Promise(resolve => { resolveProfile = resolve })
    const react = {
        createContext: () => ({ Provider: 'provider' }),
        createElement: () => null,
        useContext: () => null,
        useRef: initial => ({ current: initial }),
        useEffect: callback => { effect = callback },
        useState: initial => {
            const index = state.length
            state.push(initial)
            return [initial, value => { state[index] = value }]
        },
    }
    const sdk = { auth: {
        onAuthStateChange: callback => { listener = callback; return { data: { subscription: { unsubscribe() {} } } } },
        getSession: async () => ({ data: { session: null } }),
    } }
    const exports = {}
    vm.runInNewContext(ts.transpileModule(auth, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    }).outputText, {
        exports,
        require: name => name === 'react' ? { __esModule: true, default: react, ...react }
            : name === '@/lib/supabase' ? { supabase: sdk }
            : name === '@/lib/apiClient' ? { apiClient: async endpoint => endpoint === '/users/me' ? profileRequest : {} }
            : { isSessionTokenForUser: () => true },
        window: { location: { hash: '', pathname: '/auth/login' } },
        setTimeout: (callback, delay) => { if (delay === 0) scheduled.push(callback); else if (delay === 18000) watchdog = callback; return callback },
        clearTimeout() {}, console: { warn() {}, error() {} },
    })
    exports.AuthProvider({ children: null })
    effect()
    return {
        state, resolveProfile, watchdog: () => watchdog(),
        event: (event, session) => { listener(event, session); while (scheduled.length) scheduled.shift()() },
    }
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

test('fresh login returns to checking state until the verified profile arrives', async () => {
    const h = authHarness()
    await flush()
    assert.equal(h.state[2], false, 'anonymous initialization completed')
    h.event('SIGNED_IN', { access_token: 'signed.jwt', user: { id: 'current' } })
    await flush()
    assert.equal(h.state[2], true, 'a pending profile must not display a failure')
    h.watchdog()
    assert.equal(h.state[2], true, 'mount-time SDK watchdog must not interrupt active verification')
    assert.equal(h.state[1], null)
    h.resolveProfile({ success: true, data: { id: 'current', role: 'DEALER' } })
    await flush()
    assert.equal(h.state[2], false)
    assert.equal(h.state[1].role, 'DEALER')
})

test('pending account verification cannot restore a profile after sign-out', async () => {
    const h = authHarness()
    await flush()
    h.event('SIGNED_IN', { access_token: 'signed.jwt', user: { id: 'current' } })
    await flush()
    h.event('SIGNED_OUT', null)
    h.resolveProfile({ success: true, data: { id: 'current', role: 'ADMIN' } })
    await flush()
    assert.equal(h.state[0], null)
    assert.equal(h.state[1], null)
    assert.equal(h.state[2], false)
})

test('a mismatched backend identity remains unavailable rather than acquiring its role', async () => {
    const h = authHarness()
    await flush()
    h.event('SIGNED_IN', { access_token: 'signed.jwt', user: { id: 'current' } })
    await flush()
    h.resolveProfile({ success: true, data: { id: 'other-user', role: 'ADMIN' } })
    await flush()
    assert.equal(h.state[1], null)
    assert.equal(h.state[2], false)
})
