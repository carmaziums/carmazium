import { readFileSync } from 'node:fs';
const apply = process.env.APPLY_MISSING_DVLA === 'true';
const token = process.env.FLY_API_TOKEN;
if (!token) throw new Error('Existing Fly access unavailable');
const source = readFileSync(new URL('./restore-official-dvla-fields.cjs', import.meta.url), 'utf8');
const endpoint = 'https://api.machines.dev/v1/apps/carmazium-hjoh9w/machines';
async function api(path, body) {
  const response = await fetch(endpoint + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(55000),
  });
  if (!response.ok) throw new Error(`Fly repair request HTTP ${response.status}`);
  return response.json();
}
const machines = await api('?include_deleted=false');
const machine = machines.find(m => m.state === 'started');
if (!machine || !/^[a-z0-9]+$/.test(machine.id)) throw new Error('No running production machine');
const cutoff = new Date().toISOString();
let cursor = null;
const totals = {};
for (let batch = 1; batch <= 100; batch++) {
  const input = { apply, cutoff, cursor };
  const command = source + '\nrunBatch(' + JSON.stringify(input) + ').then(r => console.log("RESTORE_RESULT:" + JSON.stringify(r))).catch(() => { console.log("RESTORE_FAILED"); process.exitCode=1; });';
  const result = await api(`/${machine.id}/exec`, { command: ['node', '-e', command], timeout: 50 });
  if (result.exit_code !== 0) throw new Error('Repair stopped; remote raw output suppressed');
  const line = result.stdout?.split('\n').find(s => s.startsWith('RESTORE_RESULT:'));
  if (!line) throw new Error('Repair result missing; no automatic mutation retry');
  const report = JSON.parse(line.slice('RESTORE_RESULT:'.length));
  // Cursor stays in memory. Public logs contain only counts, never draft IDs or registrations.
  const summary = { batch, mode: apply ? 'apply' : 'dry-run' };
  for (const key of ['visited','lookedUp','changed','verified','noNewData','invalidRegistration','identityMismatch','lookupFailure','concurrentEdit','verificationConflict']) {
    if (!Number.isInteger(report[key]) || report[key] < 0) throw new Error('Invalid repair counters');
    summary[key] = report[key]; totals[key] = (totals[key] || 0) + report[key];
  }
  for (const category of ['fieldCounts','statusCounts']) {
    totals[category] ||= {};
    for (const [key, value] of Object.entries(report[category] || {})) {
      if (!/^[A-Za-z]+$/.test(key) || !Number.isInteger(value)) continue;
      totals[category][key] = (totals[category][key] || 0) + value;
    }
  }
  console.log(JSON.stringify(summary));
  if (report.verificationConflict) throw new Error('A saved record changed during verification; review before continuing');
  if (report.done) { console.log('RESTORE_TOTALS:' + JSON.stringify(totals)); break; }
  if (!report.cursor || report.cursor === cursor) throw new Error('Repair cursor stalled');
  cursor = report.cursor;
  if (totals.visited >= 1000) throw new Error('Repair safety limit reached');
  if (batch === 100) throw new Error('Repair batch limit reached');
}
