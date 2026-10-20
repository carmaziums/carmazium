// Read-only Fly.io reliability evidence. Never print the API token, raw logs,
// machine configuration, request payloads, cookies or customer information.
// GitHub Actions logs are visible on this public repository.
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const APP = 'carmazium-hjoh9w';
const TOKEN = process.env.FLY_API_TOKEN;
if (!TOKEN) {
  console.error('Fly diagnostics unavailable: FLY_API_TOKEN is not configured.');
  process.exitCode = 1;
} else {
  const report = [];
  const say = (line = '') => report.push(line);
  const start = Date.now();
  // Always inspect the latest 24h rather than the original October 11 incident.
  // The window is fixed once per diagnostic run for reproducibility.
  const incidentEnd = Date.now();
  const incidentStart = incidentEnd - 24 * 60 * 60 * 1000;

  async function flyGet(path) {
    try {
      const response = await fetch('https://api.machines.dev' + path, {
        headers: { Authorization: 'Bearer ' + TOKEN },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return { ok: false, status: response.status };
      return { ok: true, data: await response.json() };
    } catch {
      return { ok: false, status: 'network failure' };
    }
  }

  function isoTime(raw) {
    const millis = typeof raw === 'number'
      ? (raw < 1e11 ? raw * 1000 : raw)
      : Date.parse(String(raw));
    return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
  }

  function safeWord(value) {
    const word = String(value ?? 'unknown');
    return /^[a-zA-Z0-9_:-]{1,48}$/.test(word) ? word : 'other';
  }

  async function probe(path) {
    const times = [];
    const statuses = [];
    for (let i = 0; i < 3; i += 1) {
      const started = Date.now();
      try {
        const response = await fetch('https://' + APP + '.fly.dev' + path, {
          cache: 'no-store',
          signal: AbortSignal.timeout(7000),
        });
        statuses.push(String(response.status));
      } catch {
        statuses.push('network_error');
      }
      times.push(Date.now() - started);
    }
    return { statuses, times };
  }

  say('## CarMazium Fly.io connection diagnostics');
  say('**Application:** `' + APP + '` (London primary region).');
  say('**Collected:** ' + new Date().toISOString());
  say('**Safety:** only read-only HTTP GET requests and bounded log inspection; no changes to Fly Machines, bids, payments or databases.');
  say('');

  const machineResponse = await flyGet('/v1/apps/' + APP + '/machines?include_deleted=false');
  if (!machineResponse.ok || !Array.isArray(machineResponse.data)) {
    say('**Fly Machines API:** unavailable (' + safeWord(machineResponse.status) + '). Verify that the existing GitHub secret has Fly application read permission.');
  } else {
    const machines = machineResponse.data.slice(0, 20);
    const states = {};
    const regions = {};
    for (const machine of machines) {
      const state = safeWord(machine.state);
      const region = safeWord(machine.region);
      states[state] = (states[state] ?? 0) + 1;
      regions[region] = (regions[region] ?? 0) + 1;
    }
    say('**Current Machines:** ' + machines.length + '; states: ' + JSON.stringify(states) + '; regions: ' + JSON.stringify(regions) + '.');
    if (machineResponse.data.length > 20) say('More than 20 machines detected; events sampled for first 20.');

    const eventTotals = {};
    let incidentEvents = 0;
    let checkedMachines = 0;
    let eventsError = 0;
    const incidentDetails = [];
    const recentEvents = [];

    for (const machine of machines) {
      if (!/^[a-z0-9]{8,32}$/i.test(String(machine.id))) continue;
      const result = await flyGet('/v1/apps/' + APP + '/machines/' + machine.id + '/events?limit=50');
      if (!result.ok || !Array.isArray(result.data)) {
        eventsError += 1;
        continue;
      }
      checkedMachines += 1;
      for (const event of result.data) {
        const type = safeWord(event.type);
        const status = safeWord(event.status);
        const time = isoTime(event.timestamp);
        const key = type + ':' + status;
        eventTotals[key] = (eventTotals[key] ?? 0) + 1;
        if (time) {
          recentEvents.push({ time, type, status });
          if (Date.parse(time) >= incidentStart && Date.parse(time) <= incidentEnd) {
            incidentEvents += 1;
            incidentDetails.push(time + ' — ' + type + ' / ' + status);
          }
        }
      }
    }

    say('**Machine event access:** ' + checkedMachines + ' machines readable, ' + eventsError + ' failures.');
    say('**Event type/status counts (up to 50 latest events per machine):**');
    for (const [key, count] of Object.entries(eventTotals).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      say('- ' + key + ': ' + count);
    }
    say('**Machine events in latest 24-hour window (' + new Date(incidentStart).toISOString() + ' to ' + new Date(incidentEnd).toISOString() + '):** ' + incidentEvents);
    for (const line of incidentDetails.sort().slice(-15)) say('- ' + line);
    if (!incidentDetails.length) {
      say('No recent Machine lifecycle events found in the sampled history for this rolling 24-hour window; this does not rule out Fly Proxy, TLS or network errors.');
    }

    // Current health-check statuses only. Check outputs and full machine config
    // can include user data or secrets and are never copied to Actions output.
    const health = {};
    for (const machine of machines) {
      if (!Array.isArray(machine.checks)) continue;
      for (const check of machine.checks) {
        const name = safeWord(check.name);
        const status = safeWord(check.status);
        const key = name + ':' + status;
        health[key] = (health[key] ?? 0) + 1;
      }
    }
    say('**Current machine health checks:** ' + JSON.stringify(health));
  }

  say('');
  say('### External API probes (three read-only requests each)');
  for (const path of ['/health/live', '/health/ready']) {
    const result = await probe(path);
    say('- ' + path + ': statuses ' + result.statuses.join(', ') +
      '; latency ' + result.times.join(', ') + ' ms.');
  }

  // Read a bounded in-memory Fly log buffer only. It may not cover the entire
  // outage. Never print raw log lines, because they may contain personal data.
  const logPatterns = {
    timeout: /ETIMEDOUT|ESOCKETTIMEDOUT|timed out|timeout/i,
    reset: /ECONNRESET|UND_ERR_SOCKET|socket hang up|connection reset/i,
    oom: /out of memory|oom.killed|oom killer|fatal process out of memory/i,
    shutdown: /SIGTERM|shutting down|graceful shutdown|received signal/i,
    database: /P1001|P2024|database.*unavailable|connection pool.*timeout/i,
    proxy: /proxy error|could not find a good candidate|connection refused|no instances/i,
  };
  const logs = spawnSync('flyctl', ['logs', '--app', APP, '--no-tail', '--json'], {
    encoding: 'utf8',
    timeout: 25000,
    maxBuffer: 6 * 1024 * 1024,
    env: process.env,
  });
  say('');
  say('### Recent Fly log buffer — redacted pattern counts');
  if (logs.status !== 0 || logs.error) {
    say('Fly log buffer unavailable (CLI status ' + (logs.status ?? 'unknown') + '). No raw stderr printed.');
  } else {
    const lines = logs.stdout.split(/\r?\n/).filter(Boolean);
    say('Sampled lines: ' + lines.length + ' (this buffer may not contain historical failures).');
    for (const [category, pattern] of Object.entries(logPatterns)) {
      say('- ' + category + ': ' + lines.filter(line => pattern.test(line)).length);
    }
  }
  say('');
  say('**Diagnostic elapsed:** ' + (Date.now() - start) + ' ms. All results are a snapshot, not proof of an outage cause.');

  const output = report.join('\n') + '\n';
  console.log(output);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, output);
}