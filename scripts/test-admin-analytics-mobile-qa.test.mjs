import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const analytics = readFileSync(new URL('../src/app/dashboard/admin/analytics/page.tsx', import.meta.url), 'utf8');
const range = readFileSync(new URL('../src/components/dealer/DateRangeFilter.tsx', import.meta.url), 'utf8');
const history = readFileSync(new URL('../src/components/admin/ValuationQuoteHistoryPanel.tsx', import.meta.url), 'utf8');

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

test('valuation, auction and historical quote timestamps are UK-time independent of the browser', () => {
  assert.match(analytics, /createdAt\)\.toLocaleString\("en-GB", \{ timeZone: "Europe\/London" \}\)/);
  assert.match(analytics, /T12:00:00Z/);
  assert.match(analytics, /createdAt\)\.toLocaleTimeString\("en-GB", \{ hour: "2-digit", minute: "2-digit", timeZone: "Europe\/London" \}\)/);
  assert.match(history, /row\.createdAt\)\.toLocaleDateString\("en-GB", \{ timeZone: "Europe\/London" \}\)/);
});

test('quote history retries an unavailable panel without showing rows from another filter', () => {
  assert.match(history, /loadedKey === resultKey && \(/);
  assert.match(history, /setRetryCount\(count => count \+ 1\)/);
  assert.match(history, /Showing the last successful results for this search/);
  assert.match(history, /Retry quote history/);
});

test('displayed traffic reporting dates remain explicit when a request fails', () => {
  assert.match(analytics, /const \[trafficPeriod, setTrafficPeriod\]/);
  assert.match(analytics, /setTrafficPeriod\(\{ from: fromDate!, to: toDate! \}\)/);
  assert.match(analytics, /Displayed traffic: \{trafficPeriod\.from\} to \{trafficPeriod\.to\}/);
  assert.match(analytics, /Last successful snapshot; the requested date range could not be loaded/);
});

test('UK traffic presets are independent of localized date-string ordering', () => {
  assert.match(analytics, /\.formatToParts\(d\)/);
  assert.match(analytics, /value\("year"\).*value\("month"\).*value\("day"\)/);
  assert.doesNotMatch(analytics, /new Intl\.DateTimeFormat\("en-CA"[\s\S]*?\}\.format\(d\)/);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date("2026-10-20T23:30:00Z"));
  const get = (type) => parts.find(part => part.type === type).value;
  assert.equal(`${get("year")}-${get("month")}-${get("day")}`, "2026-10-21");
  assert.match(analytics, /start date must be on or before the end date/i);
});

test('custom date labels show UK calendar dates regardless of admin timezone', () => {
  assert.match(range, /customStart \+ "T12:00:00Z"/);
  assert.match(range, /customEnd \+ "T12:00:00Z"/);
  assert.match(range, /timeZone: "Europe\/London"/);
  const day = new Date("2026-10-25T12:00:00Z");
  const format = (zone) => new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, day: "numeric", month: "short", year: "numeric",
  }).format(day);
  assert.equal(format("Europe/London"), "25 Oct 2026");
  assert.equal(format("America/Los_Angeles"), "25 Oct 2026");
});
