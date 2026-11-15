import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/welcomeTour.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { canAutoIntroduce, getWelcomeSteps } = exports;
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
        assert.ok(getWelcomeSteps(reloaded).length >= 5, 'manual replay remains available');
    }
    assert.equal(canAutoIntroduce({ ...account, id: 'different-user' }, '/dashboard', ''), true);
});
test('selling, payment, auth, verification, bidding and message journeys are not interrupted', () => {
    for (const path of ['/sell', '/pricing', '/auth/login', '/dashboard/dealer/add-listing', '/dashboard/dealer/onboarding', '/dashboard/service/capabilities', '/auctions/123', '/buy-cars/audi', '/messages']) assert.equal(canAutoIntroduce(account, path, ''), false);
    for (const query of ['?session_id=checkout', '?payment=success', '?code=auth', '?cancelled=true']) assert.equal(canAutoIntroduce(account, '/dashboard', query), false);
});
test('content follows account roles and retains seller, payment and service safeguards', () => {
    const buyer = getWelcomeSteps(account);
    const dealer = getWelcomeSteps({ ...account, dealerProfile: {} });
    const staff = getWelcomeSteps({ ...account, dealerStaffMemberships: [{}] });
    const provider = getWelcomeSteps({ ...account, role: 'CONTRACTOR' });
    assert.equal(buyer.length, 5);
    assert.equal(dealer.length, 6);
    assert.deepEqual(staff, dealer);
    assert.ok(dealer.some(step => step.title === 'Your dealership services'));
    assert.ok(provider.some(step => step.title === 'Provide services through TradeXchange'));
    for (const role of ['FINANCE_PARTNER', 'INSURANCE_PARTNER']) assert.ok(getWelcomeSteps({ ...account, role }).some(step => step.title === 'Your partnership dashboard'));
    assert.match(JSON.stringify(dealer), /paid once/);
    assert.match(JSON.stringify(dealer), /does not approve/);
    assert.match(JSON.stringify(buyer), /admin approval/);
    assert.match(JSON.stringify(buyer), /Vehicle funds are paid directly to the seller/);
});
test('settings destination exists and dashboards no longer render duplicated service controls', () => {
    assert.ok(existsSync(new URL('../src/app/profile/page.tsx', import.meta.url)));
    for (const role of ['dealer', 'partner']) {
        const page = readFileSync(new URL(`../src/app/dashboard/${role}/page.tsx`, import.meta.url), 'utf8');
        assert.doesNotMatch(page, /DealerServicePreferences/);
        assert.match(page, /<DealerServicesNotice/);
    }
});
