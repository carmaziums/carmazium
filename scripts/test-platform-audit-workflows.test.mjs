import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
const read = p => fs.readFileSync(new URL('../'+p, import.meta.url), 'utf8');
function load(path, deps={}) {
  const exports={};
  const code=ts.transpileModule(read(path), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code + (deps['@internal'] ? `;exports.${deps['@internal']} = ${deps['@internal']};` : ""),{exports,URLSearchParams,console,Error,require:name=>{
    if(name in deps) return deps[name];
    if(name==='react/jsx-runtime') return jsx;
    if(name.startsWith('@/lib/')) return load('src/lib/'+name.slice(6)+'.ts',deps);
    if(name.startsWith('./')) return load('src/lib/'+name.slice(2)+'.ts',deps);
    throw Error('Unmocked '+name);
  }});return exports;
}
const {collectHistory}=load('src/lib/completeHistory.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
test('history retains old actionable records beyond 50 and 200 entries',async()=>{
  const rows=Array.from({length:251},(_,i)=>({id:String(i),buyerFeePaid:i!==250}));
  const calls=[];
  const result=await collectHistory(async(page,limit)=>{calls.push(page);return {data:rows.slice((page-1)*limit,page*limit),total:rows.length};});
  assert.equal(result.length,251);assert.equal(result[250].buyerFeePaid,false);assert.deepEqual(calls,[1,2,3,4,5,6]);
});
test('history fails visibly for missing pages, repeated pages, changed totals and rejected requests',async()=>{
  await assert.rejects(collectHistory(async()=>({data:[],total:1})),/Incomplete/);
  await assert.rejects(collectHistory(async()=>({data:[{id:'one'}],total:2})),/Incomplete/);
  await assert.rejects(collectHistory(async page=>({data:[{id:String(page)}],total:page===1?2:3})),/changed/);
  await assert.rejects(collectHistory(async()=>{throw Error('offline')}),/offline/);
});
test('winner detail fetches the specific authorized record without scanning a truncated list',async()=>{
  const urls=[];const api=load('src/lib/auctionApi.ts',{'./apiClient':{apiClient:async url=>{urls.push(url);return {data:{id:'old-win'}}}}});
  assert.equal((await api.getWonAuctionById('old-win')).id,'old-win');assert.deepEqual(urls,['/auctions/my/won/old-win']);
});
test('insurance filtering preserves server pagination and rejects missing totals',async()=>{
  const urls=[];let valid=true;
  const api=load('src/lib/partnerApi.ts',{'./apiClient':{apiClient:async url=>{urls.push(url);return valid?{data:[{id:'q'}],pagination:{total:51,page:2,limit:15}}:{data:[]}}}});
  assert.deepEqual(plain(await api.getInsuranceQuotes(2,15,'PENDING')),{data:[{id:'q'}],total:51,page:2,limit:15});
  assert.equal(urls[0],'/insurance/partner?page=2&limit=15&status=PENDING');valid=false;await assert.rejects(api.getInsuranceQuotes(),/complete quote list/);
});
test('hour ordering preserves counts, missing hours and the original input',()=>{
  const {chronologicalHours}=load('src/lib/analyticsHours.ts');const input=[{hour:'10',sessions:9},{hour:2,sessions:4},{hour:23,sessions:8},{hour:1,sessions:2}];
  const result=chronologicalHours(input);assert.deepEqual(plain(result.map(r=>[r.hour,r.sessions])),[[1,2],[2,4],['10',9],[23,8]]);assert.equal(input[0].hour,'10');assert.equal(result.length,4);
});
test('manufacturer aliases combine choices and stock models in both directions',()=>{
 const aliases=load('src/lib/makeAliases.ts');const options=load('src/lib/vehicleSearchOptions.ts');
 const stock=[{make:'MERCEDES',model:'Rare model',vehicleType:'CAR'},{make:'Dodge USA',model:'Rare truck',vehicleType:'CAR'}];
 assert.ok(aliases.sameMake('Mercedes','Mercedes-Benz'));assert.ok(aliases.sameMake('DODGE USA','Dodge'));assert.ok(!aliases.sameMake('MG','AMG'));
 assert.equal(options.searchMakes(stock).filter(x=>/mercedes/i.test(x)).length,1);
 assert.ok(options.searchModels(stock,'Mercedes-Benz').includes('Rare model'));assert.ok(options.searchModels(stock,'Mercedes').includes('A-Class'));assert.ok(options.searchModels(stock,'Dodge').includes('Rare truck'));
});
test('parenthesized DVLA Dodge make merges choices and preserves vehicle models',()=>{
 const aliases=load('src/lib/makeAliases.ts');const options=load('src/lib/vehicleSearchOptions.ts');
 const stock=[{make:'DODGE (USA)',model:'Nitro',vehicleType:'CAR'},{make:'Dodge',model:'Journey',vehicleType:'CAR'}];
 assert.equal(aliases.canonicalMake(' DODGE (USA) '),'Dodge');
 assert.deepEqual(plain(options.searchMakes(stock).filter(x=>/dodge/i.test(x))),['Dodge']);
 assert.ok(options.searchModels(stock,'Dodge').includes('Nitro'));
 assert.ok(options.searchModels(stock,'DODGE (USA)').includes('Journey'));
 assert.equal(aliases.canonicalMake('Dodge Trucks'),'Dodge Trucks');
 assert.equal(aliases.canonicalMake('Dodge (Canada)'),'Dodge (Canada)');
 assert.equal(read('src/lib/makeAliases.ts'),read('carmazium app/carmazium app/src/data/makeAliases.ts'));
});
// Execute real component event handlers with a small hook scheduler; API mutations are in-memory spies.
function harness(path,deps={}) {
 const slots=[],effects=[];let cursor=0,tree,component;
 const changed=(a,b)=>!a||!b||a.length!==b.length||a.some((x,i)=>x!==b[i]);
 const react={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},
  useRef(value){const i=cursor++;return slots[i]??=( {current:value} )},
  useCallback(fn,dependencies){const i=cursor++;if(changed(slots[i]?.deps,dependencies))slots[i]={deps:dependencies,fn};return slots[i].fn},
  useEffect(fn,dependencies){const i=cursor++;if(changed(slots[i]?.deps,dependencies)){slots[i]?.cleanup?.();slots[i]={deps:dependencies};effects.push(()=>{slots[i].cleanup=fn()})}},
 };
 component=load(path,{react,'lucide-react':new Proxy({},{get:(_,key)=>key}),'@/components/dashboard/DashboardSidebar':{DashboardSidebar:'sidebar'},'@/components/ui/AccessibleModal':{AccessibleModal:'modal'},...deps})[deps['@component'] || 'default'];
 const render=()=>{cursor=0;tree=component(deps['@props']);const pending=effects.splice(0);pending.forEach(fn=>fn());return tree};
 const walk=(node,out=[])=>{if(node&&typeof node==='object'){if(Array.isArray(node))node.forEach(n=>walk(n,out));else{out.push(node);walk(node.props?.children,out)}}return out};
 const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):node===null||node===undefined||typeof node==='boolean'?'':String(node);
 return {render,settle:async()=>{await new Promise(resolve=>setImmediate(resolve));return render()},find:(type,label)=>walk(tree).find(n=>n.type===type&&(!label||text(n).includes(label))),text:()=>text(tree)};
}
const request={id:'request',auctionId:'auction',status:'PENDING_COUNTERPARTY',requestedByRole:'BUYER',reason:'OTHER',createdAt:'2026-11-15',listing:{title:'Test car',vrm:'QA12ABC'},evidence:[]};
function cancellationHarness(){const calls=[];const h=harness('src/app/dashboard/admin/cancellations/page.tsx',{'@/lib/saleCancellationApi':{getAdminPendingSaleCancellations:async()=>[request],adminReviewSaleCancellation:async(...args)=>{calls.push(args)},SALE_CANCELLATION_REASON_LABELS:{OTHER:'Other'}}});return {h,calls};}
test('back and Escape abandon a cancellation; an explicit refund choice requires a note',async()=>{
 const {h,calls}=cancellationHarness();h.render();await h.settle();
 h.find('button','Approve & reverse sale').props.onClick();h.render();h.find('button','Go back').props.onClick();h.render();assert.equal(calls.length,0);assert.equal(h.find('modal'),undefined);
 h.find('button','Approve & reverse sale').props.onClick();h.render();h.find('modal').props.onClose();h.render();assert.equal(calls.length,0);
 h.find('button','Approve & reverse sale').props.onClick();h.render();h.find('button','Approve and refund').props.onClick();h.render();assert.equal(calls.length,0);assert.match(h.text(),/Enter an admin note/);
 h.find('textarea').props.onChange({target:{value:'Reviewed the evidence'}});h.render();const submit=h.find('button','Approve and refund').props.onClick;submit();submit();await h.settle();assert.equal(calls.length,1);assert.deepEqual(calls[0],['request','APPROVE','Reviewed the evidence',true]);
});
test('approval without refund is an explicit choice with refund=false',async()=>{
 const {h,calls}=cancellationHarness();h.render();await h.settle();h.find('button','Approve & reverse sale').props.onClick();h.render();h.find('textarea').props.onChange({target:{value:'Reviewed'}});h.render();h.find('button','Approve without refunding').props.onClick();await h.settle();assert.deepEqual(calls[0],['request','APPROVE','Reviewed',false]);
});
test('partial dealer checks retain successful actions but never claim all clear',async()=>{
 let failing=true;
 const h=harness('src/components/dealer/DealerAttentionPanel.tsx',{
  '@component':'DealerAttentionPanel',
  'next/link':{default:'a'},
  '@/context/DealerAccessContext':{useDealerAccess:()=>({loading:false,hasPermission:()=>true})},
  '@/context/ChatContext':{useChat:()=>({unreadCount:0,unreadStatus:'ready',refreshUnreadCount:async()=>{}})},
  '@/lib/listingApi':{getPendingOffersCount:async()=>{if(failing)throw Error('offline');return 0}},
  '@/lib/auctionApi':{getMyAuctions:async()=>[],getAllWonAuctions:async()=>[]},
  '@/lib/dealerAttention':load('src/lib/dealerAttention.ts'),
 });
 h.render();await h.settle();assert.match(h.text(),/Some checks failed/);assert.doesNotMatch(h.text(),/all caught up/);
 failing=false;h.find('button','Retry checks').props.onClick();h.render();await h.settle();assert.match(h.text(),/all caught up/);assert.doesNotMatch(h.text(),/Some checks failed/);
});
test('user attention warns when only one source fails and can recover',async()=>{
 let failing=true;
 const h=harness('src/components/dashboard/UserAttentionPanel.tsx',{
  '@component':'UserAttentionPanel','@props':{data:{seller:{incomingOffers:2},buyer:{counteredOffersPending:0},unreadMessages:0},loading:false},
  'next/link':{default:'a'},
  '@/lib/auctionApi':{getMyAuctions:async()=>[]},
  '@/lib/deliveryApi':{getReceivedDeliveryRequests:async()=>{if(failing)throw Error('offline');return []}},
  '@/lib/userAttention':load('src/lib/userAttention.ts'),
 });
 h.render();await h.settle();assert.match(h.text(),/Some checks failed/);assert.match(h.text(),/2/);assert.doesNotMatch(h.text(),/all caught up/);
 failing=false;h.find('button','Retry checks').props.onClick();h.render();await h.settle();assert.doesNotMatch(h.text(),/Some checks failed/);
});
test('warranty filters ignore late responses and remove stale actionable rows while refreshing',async()=>{
 const pending=[];
 const h=harness('src/app/dashboard/admin/warranty-orders/page.tsx',{
  '@component':'AdminOrders','@internal':'AdminOrders',
  'next/link':{default:'a'},'@/components/auth/RequireAuth':{RequireAuth:'auth'},
  '@/lib/apiClient':{apiClient:url=>new Promise((resolve,reject)=>pending.push({url,resolve,reject}))},
  '@/components/warranties/types':{money:value=>'£'+value/100,warrantyInput:'input',warrantyPanel:'panel'},
 });
 const row=vrm=>({id:vrm,vehicle:{vrm},customer:{firstName:'Test',lastName:'Customer'},status:'ISSUED',statusLabel:'Issued',totalPence:36000,createdAt:'2026-11-15'});
 h.render();assert.match(pending[0].url,/page=1&limit=25.*sort=oldest/);
 h.find('select').props.onChange({target:{value:'ISSUED'}});h.render();assert.equal(pending.length,2);
 pending[1].resolve({data:{data:[row('NEW123')],total:1}});await h.settle();assert.match(h.text(),/NEW123/);
 pending[0].resolve({data:{data:[row('STALE123')],total:1}});await h.settle();assert.doesNotMatch(h.text(),/STALE123/);assert.match(h.text(),/NEW123/);
 h.find('button','Refresh').props.onClick();h.render();assert.doesNotMatch(h.text(),/NEW123/);assert.match(h.text(),/Loading orders/);
 pending[2].reject(Error('Offline'));await h.settle();assert.match(h.text(),/Offline/);assert.doesNotMatch(h.text(),/No orders match/);
});
