// Stage reviewed compiled source in /tmp on the existing app, reuse its API key
// in process memory, and run synthetic conversations. No DB client or customer messages.
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'), files={};
function add(relative){if(files[relative])return;const source=fs.readFileSync(path.join(root,'backend',relative),'utf8');files[relative]=source;for(const m of source.matchAll(/require\(["'](\.[^"']+)["']\)/g)){let p=path.posix.normalize(path.posix.join(path.posix.dirname(relative),m[1]));if(!p.endsWith('.js'))p+='.js';add(p);}}
add('dist/ai/ai.service.js');
files['run.cjs']=fs.readFileSync(path.join(root,'backend/evaluations/run-model-eval.cjs'),'utf8');
files['mazium-cases.json']=fs.readFileSync(path.join(root,'backend/evaluations/mazium-cases.json'),'utf8');
const payload=gzipSync(Buffer.from(JSON.stringify(files))).toString('base64');
const remote=`const fs=require('fs'),p=require('path');const d=fs.mkdtempSync('/tmp/mazium-eval-');const f=JSON.parse(require('zlib').gunzipSync(Buffer.from('${payload}','base64')));for(const [n,c] of Object.entries(f)){fs.mkdirSync(p.dirname(p.join(d,n)),{recursive:true});fs.writeFileSync(p.join(d,n),c)}fs.symlinkSync('/app/node_modules',p.join(d,'node_modules'));require(p.join(d,'run.cjs'));`;
// Base64 contains no shell metacharacters; quote command as a single literal argument.
const command='node -e '+"'"+remote.replaceAll("'","'\\''")+"'";
const result=spawnSync('flyctl',['ssh','console','--app','carmazium-hjoh9w','--command',command],{encoding:'utf8',timeout:900000,maxBuffer:8*1024*1024});
const output=(result.stdout||'')+'\n'+(result.stderr||'');
const lines=output.split('\n').filter(x=>x.startsWith('MAZIUM_EVAL ')||x.startsWith('MAZIUM_SUMMARY '));
fs.writeFileSync('/tmp/mazium-model-evaluation.jsonl',lines.join('\n')+'\n');
for(const line of lines)console.log(line);
if(!lines.some(x=>x.startsWith('MAZIUM_SUMMARY '))){console.error('No evaluation summary returned. '+(result.error?.code||'REMOTE_EXECUTION_UNAVAILABLE'));process.exit(1);}
process.exit(result.status===0?0:1);
