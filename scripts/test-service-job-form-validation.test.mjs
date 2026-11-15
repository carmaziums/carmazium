import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const exports={};
new Function('exports',ts.transpileModule(readFileSync(new URL('../src/lib/serviceJobFormValidation.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports);
test('job vehicle needs registration or both make and model, whitespace is empty',()=>{
 for(const value of [{},{registration:' '},{make:'Toyota'},{model:'Yaris'},{make:' ',model:'Yaris'}]) assert.equal(exports.jobVehicleIdentified(value),false);
 for(const value of [{registration:'AB12CDE'},{make:'Toyota',model:'Yaris'}]) assert.equal(exports.jobVehicleIdentified(value),true);
});
test('explicit scheduling cannot silently become ASAP or accept past and invalid dates',()=>{
 const now=Date.parse('2026-11-15T10:00:00Z');
 assert.equal(exports.jobDateIssue('',false,now),null);
 for(const value of ['','bad','2026-11-15T09:00:00Z','2026-11-15T10:00:00Z']) assert.equal(exports.jobDateIssue(value,true,now).field,'job-date');
 assert.equal(exports.jobDateIssue('2026-11-15T11:00:00Z',true,now),null);
});

const notificationExports={};
new Function('exports',ts.transpileModule(readFileSync(new URL('../src/lib/notificationEmailPreference.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(notificationExports);
test('notification email defaults on and changes preserve other channel and event preferences',()=>{
 assert.equal(notificationExports.notificationEmailsEnabled(null),true);
 assert.equal(notificationExports.notificationEmailsEnabled({notifications:{email:false}}),false);
 const before={theme:'dark',notifications:{push:false,muteAll:true,outbid:false,email:true}};
 assert.deepEqual(notificationExports.notificationEmailPatch(before,false),{notifications:{push:false,muteAll:true,outbid:false,email:false}});
 assert.equal(before.notifications.email,true);
});
