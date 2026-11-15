import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/welcomeTour.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { canAutoIntroduce } = exports;
const guidedSource = readFileSync(new URL('../src/lib/guidedWebsiteTour.ts', import.meta.url), 'utf8');
const guided = {};
new Function('exports', ts.transpileModule(guidedSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(guided);
const { getGuidedWebsiteSteps } = guided;
const account = { id: 'new-user', role: 'BUYER', createdAt: '2026-11-16T00:00:00Z' };

test('new users are introduced on a safe first authenticated landing page', () => {
    for (const route of ['/', '/dashboard', '/dashboard/dealer', '/dashboard/user', '/search']) assert.equal(canAutoIntroduce(account, route, ''), true);
});
test('existing accounts, admins and unknown creation dates are not interrupted', () => {
    for (const profile of [{ ...account, createdAt: '2026-11-01T00:00:00Z' }, { ...account, role: 'ADMIN' }, { ...account, createdAt: undefined }, { ...account, createdAt: 'invalid' }]) assert.equal(canAutoIntroduce(profile, '/dashboard', ''), false);
});
test('skip and completion survive refresh and different devices via account preferences', () => {
    for (const status of ['skipped', 'completed']) {
        const reloaded = JSON.parse(JSON.stringify({ ...account, preferences: { websiteIntroductionV1: { status, version: 1 } } }));
        assert.equal(canAutoIntroduce(reloaded, '/dashboard', ''), false);
        assert.ok(getGuidedWebsiteSteps(reloaded).length >= 5, 'manual replay remains available');
    }
    assert.equal(canAutoIntroduce({ ...account, id: 'different-user' }, '/dashboard', ''), true);
});
test('selling, payment, auth, verification, bidding and message journeys are not interrupted', () => {
    for (const path of ['/sell', '/pricing', '/auth/login', '/dashboard/dealer/add-listing', '/dashboard/dealer/onboarding', '/dashboard/service/capabilities', '/auctions/123', '/buy-cars/audi', '/messages']) assert.equal(canAutoIntroduce(account, path, ''), false);
    for (const query of ['?session_id=checkout', '?payment=success', '?code=auth', '?cancelled=true']) assert.equal(canAutoIntroduce(account, '/dashboard', query), false);
});
test('guided pages match account roles without treating a stale dealer profile as permission', () => {
    const buyer = getGuidedWebsiteSteps(account);
    const dealer = getGuidedWebsiteSteps({ ...account, role: 'DEALER', dealerProfile: {} });
    const contractor = getGuidedWebsiteSteps({ ...account, role: 'CONTRACTOR' });
    assert.ok(dealer.some(step => step.href === '/dashboard/dealer/team'));
    assert.ok(dealer.some(step => step.title === 'My dealership services'));
    assert.ok(contractor.some(step => step.title === 'Service setup and approval'));
    assert.ok(!buyer.some(step => step.href?.startsWith('/dashboard/dealer')));
    assert.deepEqual(getGuidedWebsiteSteps({ ...account, dealerProfile: {} }), buyer);
    for (const role of ['FINANCE_PARTNER', 'INSURANCE_PARTNER']) {
        const tour = getGuidedWebsiteSteps({ ...account, role });
        assert.ok(tour.some(step => step.href === (role === 'FINANCE_PARTNER' ? '/dashboard/finance' : '/dashboard/insurance')));
        assert.ok(!tour.some(step => step.id === 'settings-payouts'));
    }
    assert.match(JSON.stringify(dealer), /not charged again/);
    assert.match(JSON.stringify(dealer), /does not approve/);
    assert.match(JSON.stringify(buyer), /admin approval/);
    assert.match(JSON.stringify(dealer), /vehicle funds are paid directly to the seller/i);
});
test('every guided destination exists, stays internal and avoids checkout, auth and dynamic customer records', () => {
    for (const role of ['BUYER', 'SELLER', 'DEALER', 'CONTRACTOR', 'FINANCE_PARTNER', 'INSURANCE_PARTNER']) {
        const steps = getGuidedWebsiteSteps({ ...account, role });
        assert.equal(new Set(steps.map(step => step.id)).size, steps.length);
        assert.equal(steps[0].href, undefined, 'welcome waits for explicit Start tour');
        for (const step of steps.filter(step => step.href)) {
            assert.match(step.href, /^\/(?!\/)/);
            assert.doesNotMatch(step.href, /checkout|payment|onboarding|auth|\bid=/);
            const path = step.href.split('?')[0];
            assert.ok(existsSync(new URL(`../src/app${path}/page.tsx`, import.meta.url)), `${role}: ${step.href}`);
            assert.ok(step.target?.selector, `${step.id} needs a visible highlight target`);
        }
    }
});
test('settings destination exists and dashboards no longer render duplicated service controls', () => {
    assert.ok(existsSync(new URL('../src/app/profile/page.tsx', import.meta.url)));
    for (const role of ['dealer', 'partner']) {
        const page = readFileSync(new URL(`../src/app/dashboard/${role}/page.tsx`, import.meta.url), 'utf8');
        assert.doesNotMatch(page, /DealerServicePreferences/);
        assert.match(page, /<DealerServicesNotice/);
    }
});
