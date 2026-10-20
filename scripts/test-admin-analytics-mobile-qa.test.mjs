import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const analytics = readFileSync(new URL('../src/app/dashboard/admin/analytics/page.tsx', import.meta.url), 'utf8');
const range = readFileSync(new URL('../src/components/dealer/DateRangeFilter.tsx', import.meta.url), 'utf8');

test('traffic daily chart retains London-date labels and accessible mobile scrolling', () => {
  assert.match(analytics, /aria-label="Traffic by day, horizontally scrollable chart"/);
  assert.match(analytics, /tabIndex=\{0\} className="w-full max-w-full overflow-x-auto/);
  assert.match(analytics, /d\.date\.slice\(5\)/);
  assert.doesNotMatch(analytics, /origin-center hidden xl:block/);
  assert.match(analytics, /traffic\.trafficByDay\.length \* 25/);
});

test('zero traffic or revenue is drawn as a zero-height bar', () => {
  assert.match(analytics, /d\.sessions > 0 \? Math\.max\(pct, 2\) : 0/);
  assert.match(analytics, /val > 0 \? Math\.max\(pct, 2\) : 0/);
});

test('analytics status and auction period are accessible and retryable', () => {
  assert.match(analytics, /role="status" aria-label=\{valuationError/);
  assert.match(analytics, /aria-pressed=\{firstOfferDays === days\}/);
  assert.match(analytics, /Retry auction analytics/);
  assert.match(analytics, /timeZone: "Europe\/London"/);
});

test('shared date filter fits small screens and keeps labelled inputs', () => {
  assert.match(range, /flex flex-wrap items-center/);
  assert.match(range, /aria-pressed=\{activeRange === key\}/);
  assert.match(range, /w-\[min\(420px,90vw\)\]/);
  assert.match(range, /grid-cols-1 sm:grid-cols-\[1fr_auto_1fr\]/);
  assert.match(range, /aria-label="Start date"/);
  assert.match(range, /aria-label="End date"/);
});
