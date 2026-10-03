import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/app/dashboard/admin/listings/page.tsx', import.meta.url), 'utf8');

test('stale rejected API results cannot re-enter the pending-review UI', () => {
    assert.match(source, /setPendingListings\(\(data \|\| \[\]\)\.filter\(\(listing: any\) => listing\.status === 'PENDING_REVIEW'\)\)/);
});

test('mobile admin review uses stacked, fully visible action buttons', () => {
    const marker = 'className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3"';
    const start = source.indexOf(marker);
    assert.ok(start >= 0, 'actions use a single mobile column and three columns on wider screens');
    const end = source.indexOf('</div>', start);
    assert.ok(end > start, 'action group closes');
    const group = source.slice(start, end);
    assert.equal((group.match(/<button\b/g) || []).length, 3, 'Approve, Edit, and Reject all remain in the responsive group');
    assert.equal((group.match(/min-w-0 w-full min-h-11/g) || []).length, 3, 'each action fits its mobile column');
    for (const label of ['Approve — Go Live', 'Edit Details', 'Reject']) {
        assert.ok(group.includes(label), label + ' remains accessible');
    }
});

test('admin inventory offers distinct responsive status views rather than mixing every lifecycle by default', () => {
    const statuses = [
        'ACTIVE', 'PENDING_REVIEW', 'DRAFT', 'OFFER_ACCEPTED',
        'SOLD', 'REJECTED', 'WITHDRAWN', 'DELETED', 'ALL',
    ];
    for (const status of statuses) {
        assert.ok(source.includes(`{ value: '${status}'`), `${status} has a dedicated view`);
    }
    assert.match(source, /useState<AdminListingStatus>\('ACTIVE'\)/, 'default is active vehicles');
    assert.match(source, /STATUS_TABS\.map/, 'tabs render from known statuses');
    assert.match(source, /Filter by listing status" className="flex flex-wrap gap-2"/, 'mobile status buttons wrap');
    assert.match(source, /setStatusFilter\(value\)/, 'tabs change the selected status');
    assert.match(source, /setPage\(1\)/, 'switching filters resets pagination');
    assert.match(source, /ownerFilter === 'ADMIN' \? 'ADMIN' : undefined, statusFilter/, 'status reaches server-side pagination');
});
