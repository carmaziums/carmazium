// Changes to a workflow invalidate its reviewed knowledge snapshot. Never
// automatically publish model-written policy; review facts before --update.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const catalogue=fs.readFileSync(path.join(root,'backend/src/ai/mazium-platform-knowledge.ts'),'utf8');
const sources=[...new Set([...catalogue.matchAll(/sources: \[([^\]]+)\]/g)].flatMap(m=>[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1])))].sort();
const hashes=Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')]));
const target=path.join(root,'backend/evaluations/mazium-knowledge-sources.json');
if(process.argv.includes('--update')) fs.writeFileSync(target,JSON.stringify({reviewedAt:'2026-11-18',sources:hashes},null,2)+'\n');
else {
 const baseline=JSON.parse(fs.readFileSync(target,'utf8')).sources;
 const stale=sources.filter(p=>baseline[p]!==hashes[p]);
 if(stale.length) {console.error('Review MaziuM facts for changed source files before updating the manifest:\n'+stale.join('\n'));process.exit(1);}
 console.log(`Verified knowledge source fingerprints: ${sources.length}`);
}
