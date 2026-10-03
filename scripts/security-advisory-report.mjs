#!/usr/bin/env node
/**
 * Read-only triage of npm's JSON audit output. Never prints token/config data.
 * Security remediation lives OUTSIDE the ten-block valuation revert bundle.
 */
import fs from 'node:fs';
import path from 'node:path';

const [inputFile, project] = process.argv.slice(2);
if (!inputFile || !project) {
  console.error('Usage: node scripts/security-advisory-report.mjs <npm-audit-json> <project>');
  process.exit(2);
}
let raw;
try { raw = JSON.parse(fs.readFileSync(inputFile, 'utf8')); }
catch { console.error('AUDIT_UNVERIFIED: npm audit did not return valid JSON'); process.exit(2); }
const counts = raw.metadata?.vulnerabilities;
if (!counts || !Number.isInteger(counts.critical) || !Number.isInteger(counts.high)
  || !raw.vulnerabilities || typeof raw.vulnerabilities !== 'object') {
  console.error('AUDIT_UNVERIFIED: npm audit returned no usable vulnerability inventory');
  process.exit(2);
}
const keep = new Set(['critical', 'high']);
const findings = Object.entries(raw.vulnerabilities)
  .filter(([, entry]) => keep.has(entry.severity))
  .map(([name, entry]) => {
    const advisories = (entry.via ?? []).filter(x => typeof x === 'object').map(x => ({
      id: String(x.source ?? ''),
      title: String(x.title ?? '').slice(0, 130),
      url: /^https:\/\/(?:github\.com\/advisories|npmjs\.com\/advisories|security\.snyk\.io)\//.test(x.url ?? '')
        ? x.url : undefined,
      range: String(x.range ?? '').slice(0, 90),
    }));
    const fix = entry.fixAvailable;
    return {
      package: name,
      severity: entry.severity,
      direct: Boolean(entry.isDirect),
      installedRange: String(entry.range ?? '').slice(0, 100),
      fix: fix === false ? 'NO_KNOWN_FIX'
        : fix === true ? 'AVAILABLE_NO_MAJOR_INDICATED'
        : fix && typeof fix === 'object'
          ? { name: String(fix.name ?? name), target: String(fix.version ?? ''),
              semverMajor: Boolean(fix.isSemVerMajor) } : 'NEEDS_REVIEW',
      advisory: advisories,
      viaPackages: (entry.via ?? []).filter(x => typeof x === 'string').slice(0, 12),
    };
  }).sort((a,b) => {
    const sev = {critical: 0,high:1};
    return sev[a.severity]-sev[b.severity] || Number(b.direct)-Number(a.direct)
      || a.package.localeCompare(b.package);
  });
const report = {project, date: new Date().toISOString(), productionDependenciesOnly:true,
  counts:{critical:counts.critical,high:counts.high,moderate:counts.moderate,low:counts.low,total:counts.total},
  highOrCriticalPackages:findings,
  state:counts.critical+counts.high>0?'RELEASE_BLOCKED_PENDING_REMEDIATION':'SCAN_CLEAN_AS_OF_SCAN',
  note:'npm audit reports advisory reachability, not proof of exploitability; release requires separate manual verification.'};
console.log('SECURITY_AUDIT_DETAIL '+JSON.stringify(report));
if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = ['### '+project+' — read-only production dependency audit',
    'Critical: '+counts.critical+', high: '+counts.high+', moderate: '+counts.moderate,
    'State: **'+report.state+'**',
    '',
    '| Package | Severity | Direct | Fix guidance |',
    '|---|---|---|---|',
    ...findings.map(f => '| '+f.package+' | '+f.severity+' | '+f.direct
      +' | '+(typeof f.fix==='string'?f.fix:
        f.fix.target+(f.fix.semverMajor?' (major upgrade, test manually)':''))
      +' |'),
    '',
    'Full sanitized advisory references are printed as SECURITY_AUDIT_DETAIL JSON in the CI job log.',
    'Do not treat a passing inventory job as approval to deploy.', ''];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n'));
}
if (counts.critical + counts.high > 0) {
  console.log('::warning::Critical/high dependencies remain an independent production release blocker for '+project);
}
