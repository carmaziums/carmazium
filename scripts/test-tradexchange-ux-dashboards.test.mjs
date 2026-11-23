import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const f='src/lib/serviceRequestViews.ts',native='carmazium app/carmazium app/src/';
const exports={};runInNewContext(ts.transpileModule(read(f),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test('customer status filters retain all existing statuses and classify action needed correctly',()=>{
 assert.equal(read(f),read(native+'lib/serviceRequestViews.ts'));
 const rows=['OPEN','ACCEPTED','PAID','IN_PROGRESS','COMPLETED','RELEASED','CANCELLED','EXPIRED','DISPUTED'].map(status=>({status}));
 const match=(filter)=>rows.filter(x=>exports.requestMatches(x,filter)).map(x=>x.status);
 assert.equal(match('all').length,9);
 assert.deepEqual(match('quotes'),['OPEN']);assert.deepEqual(match('action'),['ACCEPTED','COMPLETED','DISPUTED']);
 assert.deepEqual(match('progress'),['PAID','IN_PROGRESS']);assert.deepEqual(match('past'),['RELEASED','CANCELLED','EXPIRED']);
 assert.equal(exports.requestMatches({status:'OPEN',_count:{quotes:2}},'action'),true);
 assert.equal(exports.requestNextStep({status:'OPEN',_count:{quotes:0}}),'Waiting for quotes');
 assert.equal(exports.requestNextStep({status:'OPEN',_count:{quotes:1}}),'Review quotes');
});
test('request workspace uses existing customer-scoped API and direct service links, not provider jobs',()=>{
 const w=read('src/app/services/jobs/page.tsx'),n=read(native+'screens/main/CustomerServiceJobsScreen.tsx');
 assert.match(w,/MyJobsList key=\{user.id\}/);assert.match(w,/getMyJobsPage/);assert.match(n,/getMyServiceJobsPage/);assert.match(n,/CustomerRequests key=\{userId\}/);
 for(const s of [w,n]){assert.match(s,/requestMatches/);assert.match(s,/Request transport/);assert.match(s,/Request inspection/);assert.match(s,/Load older requests/);assert.match(s,/matching request/);}
 assert.doesNotMatch(w,/dashboard\/service\/jobs/);assert.doesNotMatch(n,/navigate\('ProviderJobs'/);
 assert.match(read('src/app/services/jobs/layout.tsx'),/index: false/);
});
test('dealer and personal cards use the same customer workspace while provider destination remains distinct',()=>{
 const web=JSON.parse(read('src/data/dashboardCards.json')),app=JSON.parse(read(native+'data/dashboardCards.json'));
 assert.deepEqual(web,app);
 for(const [group,id] of [['personal','user-service-jobs'],['dealer','dealer-customer-requests']]){
 const c=web[group].find(x=>x.id===id);assert.equal(c.href,'/services/jobs');assert.equal(c.stackScreen,'CustomerServiceJobs');
 }
 assert.equal(web.dealer.find(x=>x.id==='dealer-partner').href,'/dashboard/partner');
});
test('legacy message pages preserve room links but do not render duplicate inboxes',()=>{
 for(const role of ['buyer','seller']){const s=read('src/app/dashboard/'+role+'/messages/page.tsx');assert.match(s,/redirect\("\/dashboard\/user\?tab=messages"/);assert.match(s,/encodeURIComponent\(room\)/);assert.doesNotMatch(s,/ChatWindow|ChatRoomList/);}
 for(const role of ['user','dealer']){const s=read('src/app/dashboard/'+role+(role==='user'?'/page.tsx':'/messages/page.tsx'));assert.match(s,/lg:h-full/);assert.ok(s.includes('backHref="/dashboard/'+role+'"'));assert.match(s,/lg:hidden/);}
 const shared=read('src/components/chat/RoleMessagesInbox.tsx');assert.match(shared,/lg:h-full lg:border-0 lg:rounded-none lg:shadow-none/);assert.match(shared,/autoSelectedRef.current === targetRoomId/);
 const admin=read('src/app/dashboard/admin/messages/page.tsx');assert.match(admin,/Back to admin dashboard/);assert.match(admin,/AdminSupportPanel/);assert.match(admin,/profile\?\.role !== "ADMIN"/);
});
