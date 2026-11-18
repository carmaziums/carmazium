// Real model evaluation, NOT a mocked intelligence test. No customer data or writes.
// Run: node scripts/evaluate-mazium-live.mjs [base URL] [output path] [limit]
import fs from 'node:fs/promises';
const cases = JSON.parse(await fs.readFile(new URL('../backend/evaluations/mazium-cases.json', import.meta.url), 'utf8'));
const base = process.argv[2] || 'https://carmazium-hjoh9w.fly.dev';
const output = process.argv[3] || '/tmp/mazium-live-evaluation.json';
const selected = cases.slice(0, Number(process.argv[4]) || cases.length);
const results = [];
for (const c of selected) {
 const started = Date.now();
 let text = '', error = null;
 try {
  const r = await fetch(`${base}/ai/chat`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:c.messages,aiConsentAcknowledged:true}),signal:AbortSignal.timeout(160000)});
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  text = (await r.json())?.data?.text || '';
 } catch(e) {error=e.message;}
 const failures = c.must.filter(rule=>!new RegExp(rule,'i').test(text));
 if (/brief moment|couldn.t verify an answer|couldn.t generate|having trouble|try rephrasing|wrong page/i.test(text)) failures.push('unavailable/fallback');
 if (!text) failures.push('empty');
 const result={...c,text,error,failures,passed:!error&&!failures.length,ms:Date.now()-started};
 results.push(result);
 await fs.writeFile(output,JSON.stringify({checkedAt:new Date().toISOString(),base,total:results.length,passed:results.filter(r=>r.passed).length,manualReviewRequired:true,results},null,2));
 console.log(`${c.id} ${result.passed?'PASS':'FAIL'} ${result.ms}ms ${failures.join(', ')}`);
 // Respect production rate limit; these queries do not create support messages.
 await new Promise(r=>setTimeout(r, Math.max(0,3200-(Date.now()-started))));
}
console.log(JSON.stringify({total:results.length,passed:results.filter(r=>r.passed).length,output,manualReviewRequired:true}));
process.exitCode=results.every(r=>r.passed)?0:1;
