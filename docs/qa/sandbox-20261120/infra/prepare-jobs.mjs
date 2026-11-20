import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),f=JSON.parse(readFileSync(resolve(root,'private/fixtures.json'),'utf8'));const base='http://127.0.0.1:8080',cookies={},results=[];
async function api(role,path,method='GET',body,expected=200){const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(cookies[role]?{cookie:cookies[role]}:{})},...(body?{body:JSON.stringify(body)}:{})});let json=await r.json();if(r.headers.get('set-cookie'))cookies[role]=r.headers.get('set-cookie').split(';')[0];if(r.status!==expected)throw Error(role+' '+method+' '+path+' '+r.status+' '+JSON.stringify(json));return json.data??json;}
for(const role of Object.keys(f.users)){await api(role,'/auth/login','POST',{email:f.users[role].email,password:f.password});results.push(role+' login passed')}
await api('buyer','/services/settings');results.push('settings passed');
await api('none','/payments/webhook','POST',{},400);results.push('unsigned webhook rejected');
const items=[];
for(const [name,fields] of [['delivery',{serviceType:'DELIVERY',pickupPostcode:'B1 1AA',deliveryPostcode:'B2 2BB'}],['cosmetic',{serviceType:'INSPECTION',inspectionScope:'COSMETIC',servicePostcode:'B1 1AA'}],['combined',{serviceType:'INSPECTION',inspectionScope:'BOTH',servicePostcode:'B1 1AA'}],['recovery',{serviceType:'DELIVERY',isRecovery:true,pickupPostcode:'B1 1AA',deliveryPostcode:'B2 2BB'}]]){
const job=await api('buyer','/services/jobs','POST',{...fields,title:'Synthetic QA '+name+' 20261120',description:'Isolated sandbox test; no real vehicle or work.',vehicles:[{make:'Synthetic',model:'QA',year:2020,notes:'No real vehicle'}]},201);results.push(name+' creation passed');
await api('outsider','/services/jobs/'+job.id,'GET',undefined,403);results.push(name+' private access blocked');
const quote=await api('provider','/services/jobs/'+job.id+'/quote','PUT',{amountPence:10000,message:'Synthetic test quote'});
const checkout=await api('buyer','/services/jobs/'+job.id+'/quotes/'+quote.id+'/accept','POST',{},201);
const repeat=await api('buyer','/services/jobs/'+job.id+'/quotes/'+quote.id+'/accept','POST',{},201);if(checkout.checkoutUrl!==repeat.checkoutUrl)throw Error('Duplicate checkout');
await api('provider','/services/jobs/'+job.id+'/start','POST',{},400);results.push(name+' unpaid start blocked; checkout reused');
items.push({name,jobId:job.id,quoteId:quote.id,...checkout});
}
writeFileSync(resolve(root,'private/checkout-fixtures.json'),JSON.stringify({items,cookies,results},null,2));console.log(JSON.stringify({results,items:items.map(({checkoutUrl,...x})=>x)},null,2));