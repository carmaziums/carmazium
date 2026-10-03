#!/usr/bin/env node
/**
 * Read-only independent image CVE inventory from a real Docker image scan.
 * Only synthetic CI-built images; never logs secrets, scans live deployments,
 * updates an application, or claims a clean npm audit certifies the OS.
 *
 * Usage: node scripts/security/parse-backend-trivy-image.cjs /tmp/image-scan.json
 */
'use strict';
const fs=require('node:fs');
const [file]=process.argv.slice(2);
if(!file){console.error('Usage: parse-backend-trivy-image.cjs <trivy-json>');process.exit(2);}
let data;
try{data=JSON.parse(fs.readFileSync(file,'utf8'));}
catch{console.error('SCAN_UNVERIFIED: no parseable Trivy JSON');process.exit(2);}
if(!Number.isInteger(data.SchemaVersion)||!Array.isArray(data.Results)){
  console.error('SCAN_UNVERIFIED: Trivy schema/Results missing');process.exit(2);
}
const groups={os:[],library:[],other:[]};
const totals={os:{critical:0,high:0,medium:0,low:0},
  library:{critical:0,high:0,medium:0,low:0},
  other:{critical:0,high:0,medium:0,low:0}};
const summary=[];
for(const result of data.Results){
  const category=result.Class==='os-pkgs'?'os':
    result.Class==='lang-pkgs'?'library':'other';
  const vulns=result.Vulnerabilities||[];
  for(const v of vulns){
    const severity=String(v.Severity||'').toLowerCase();
    if(Object.hasOwn(totals[category],severity))totals[category][severity]+=1;
    const pkg=String(v.PkgName||'').slice(0,80);
    const version=String(v.InstalledVersion||'').slice(0,50);
    const fixed=String(v.FixedVersion||'').slice(0,50);
    const entry={
      target:String(result.Target||'').slice(0,110),
      pkg,version,fixed,severity,id:String(v.VulnerabilityID||'').slice(0,45),
      link:/^https:\/\//.test(v.PrimaryURL||'')?String(v.PrimaryURL).slice(0,200):undefined
    };
    if(severity==='critical'||severity==='high')groups[category].push(entry);
  }
  summary.push({target:String(result.Target||'').slice(0,110),
    class:result.Class,type:result.Type,count:vulns.length});
}
const osCovered=data.Results.some(x=>x.Class==='os-pkgs');
const libCovered=data.Results.some(x=>x.Class==='lang-pkgs');
if(!osCovered||!libCovered){
  console.error('SCAN_INCOMPLETE: expected both OS and language-package scan results');
  console.error(JSON.stringify({osCovered,libCovered,summary}));
  process.exit(2);
}
const report={
  scanner:'Trivy',scope:'candidate Docker image, no production deploy',
  date:new Date().toISOString(),osCovered,libCovered,totals,
  highCriticalEvidence:{
    os:groups.os.slice(0,30),library:groups.library.slice(0,30),
    other:groups.other.slice(0,20)
  },targets:summary,
  releaseGate:totals.os.high+totals.os.critical+totals.library.high+
    totals.library.critical+totals.other.high+totals.other.critical>0
    ?'REVIEW_BLOCKED_BY_HIGH_CRITICAL_IMAGE_FINDINGS'
    :'IMAGE_CVE_INVENTORY_NO_REPORTED_HIGH_CRITICAL',
  limitations:'Scanner feed is dated; reachability and exploitability require human review. This image is not the deployed Fly revision.'
};
console.log('BACKEND_ASSEMBLED_IMAGE_CVE_REPORT '+JSON.stringify(report));
for(const [area,s] of Object.entries(totals)){
  console.log('IMAGE_PACKAGE_'+area.toUpperCase()+' '+JSON.stringify(s));
}
if(process.env.GITHUB_STEP_SUMMARY){
  const rows=['### Proposed backend Docker image — OS and library CVE inventory',
    '| Layer | Critical | High | Medium | Low |',
    '|---|---:|---:|---:|---:|',
    ...Object.entries(totals).map(([key,v])=>
      '| '+key+' | '+v.critical+' | '+v.high+' | '+v.medium+' | '+v.low+' |'),
    '', '**Release gate:** '+report.releaseGate,
    '', 'This is an assembled-image vulnerability inventory, not proof of vulnerability reachability or production deployment.',
    'Scan results change with advisory feeds; always rescan the final intended deployment image.',
    '', '| Class | Package | ID | Fixed release |',
    '|---|---|---|---|',
    ...['os','library','other'].flatMap(k=>groups[k].slice(0,15)
      .map(x=>'| '+k+' | '+x.pkg+' ('+x.version+') | '+x.id+
        ' | '+(x.fixed||'No published fix listed')+' |')),''];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,rows.join('\n'));
}
if(report.releaseGate!=='IMAGE_CVE_INVENTORY_NO_REPORTED_HIGH_CRITICAL'){
  console.log('::warning::Real candidate image has high/critical findings requiring separate remediation before approval');
}
