import { readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync(new URL('../../../src/lib/guidedWebsiteTour.ts', import.meta.url), 'utf8');
const output = '// Generated from src/lib/guidedWebsiteTour.ts by scripts/sync-guided-tour.mjs.\n'
  + source.replace('import type { TourProfile } from "./welcomeTour"',
    'type TourProfile = { id: string; role: string; dealerProfile?: unknown; contractorProfile?: unknown; dealerStaffMemberships?: unknown[] };');
const destination = new URL('../src/lib/guidedTourContent.ts', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== output) throw Error('Native tour differs from website; run sync-guided-tour.mjs');
} else writeFileSync(destination, output);
