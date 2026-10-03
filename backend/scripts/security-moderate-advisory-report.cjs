#!/usr/bin/env node
/** Read-only npm production dependency advisory inventory. No dependency changes.
 * npm audit --package-lock-only --omit=dev --json > tempfile
 * node backend/scripts/security-moderate-advisory-report.cjs tempfile [stage]
 */
'use strict';
const fs=require('node:fs');
const input=process.argv[2],stage=process.argv[3]||'before';
if(!input||!['before','after-simulation'].includes(stage))process.exit(2);
const a=JSON.parse(fs.readFileSync(input,'utf8')),v=a.metadata?.vulnerabilities;
if(!v||!Number.isInteger(v.critical)||!Number.isInteger(v.high)
  ||!Number.isInteger(v.moderate)||!a.vulnerabilities)
  throw Error('FAIL_CLOSED: incomplete/unavailable npm audit response');
const relevant=Object.entries(a.vulnerabilities)
 .filter(([,x])=>['critical','high','moderate'].includes(x.severity))
 .map(([name,x])=>({
    package:name,
    severity:x.severity,
    direct:!!x.isDirect,
    vulnerableRange:String(x.range||''),
    fix:x.fixAvailable===false?'NO_KNOWN_FIX':x.fixAvailable===true?'COMPATIBLE_CANDIDATE':
      x.fixAvailable&&typeof x.fixAvailable==='object'?{
        target:String(x.fixAvailable.version||''),
        through:String(x.fixAvailable.name||name),
        major:!!x.fixAvailable.isSemVerMajor
      }:'REVIEW',
    advisories:(x.via||[]).filter(y=>typeof y==='object').map(y=>({
       id:y.source,
       title:String(y.title||'').slice(0,140),
       url:/^https:\/\/github.com\/advisories\/GHSA-[\w-]+$/.test(y.url||'')?y.url:null,
       affected:String(y.range||'')
    })),
    via:(x.via||[]).filter(y=>typeof y==='string')
 }))
 .sort((x,y)=>({critical:0,high:1,moderate:2}[x.severity]-
   {critical:0,high:1,moderate:2}[y.severity]||x.package.localeCompare(y.package)));
const report={stage,date:new Date().toISOString(),counts:v,
   productionScope:true,note:'Advisory dependency reachability, not proven exploitability. No automated risk acceptance.',
   findings:relevant};
console.log('BACKEND_MODERATE_AUDIT_DETAIL '+JSON.stringify(report));
const summary=process.env.GITHUB_STEP_SUMMARY;
if(summary){
 const lines=['### Backend moderate-risk advisory review ('+stage+')',
   'Critical: '+v.critical+' · High: '+v.high+' · Moderate: '+v.moderate+' · Low: '+v.low,
   '| Package | Severity | Direct | Suggested fix | Advisory |',
   '|---|---|---|---|---|',
   ...relevant.map(x=>'| '+x.package+' | '+x.severity+' | '+x.direct+' | '+
      (typeof x.fix==='string'?x.fix:
      x.fix.through+'@'+x.fix.target+(x.fix.major?' [major — manual review]':''))+
      ' | '+x.advisories.map(a=>a.url?('['+a.id+']('+a.url+')'):String(a.id)).join(', ')+' |'),
   'A green inventory job is **not** a security-clearance or release approval.'];
 fs.appendFileSync(summary,lines.join('\n')+'\n');
}
if(v.critical||v.high) console.log('::warning::Backend remains security-blocked: critical/high findings');
