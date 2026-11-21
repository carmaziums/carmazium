import {readFileSync,writeFileSync} from 'node:fs';import {createRequire} from 'node:module';import {resolve} from 'node:path';const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'source/backend/package.json')),qa=JSON.parse(readFileSync(resolve(root,'private/qa-env.json'),'utf8')),fixtures=JSON.parse(readFileSync(resolve(root,'private/fixtures.json'),'utf8')),f=JSON.parse(readFileSync(resolve(root,'private/checkout-fixtures.json'),'utf8'));
process.env.DATABASE_URL='postgresql://postgres:'+qa.password+'@127.0.0.1:5544/carmazium_sandbox_utf8';process.env.NOTIFICATION_EMAILS_ENABLED='false';const key=readFileSync(resolve(root,'private/stripe.key'),'utf8').trim();if(!key.startsWith('sk_test_'))throw Error('Test key only');
const {PrismaClient}=require('@prisma/client'),db=new PrismaClient();const config={get:k=>({STRIPE_SECRET_KEY:key,FRONTEND_URL:'http://127.0.0.1:8080'})[k]};const email={sendBrandedEmail:async()=>({sent:false,reason:'isolated QA'})};const gateway={sendNotification:()=>{},isUserConnected:()=>false};const {NotificationsService}=require('./dist/notifications/notifications.service.js');const notify=new NotificationsService(db,{get:()=>gateway},email);const {PaymentsService}=require('./dist/payments/payments.service.js');const payments=new PaymentsService(db,config,{},notify,email,{});const {ServicesService}=require('./dist/services/services.service.js');const services=new ServicesService(db,notify,email,payments,config);const {ServiceOperationsService}=require('./dist/services/service-operations.service.js');const ops=new ServiceOperationsService(db,services,notify);

const nativeId=f.nativeJob.id;
const nativeBefore=await db.servicePayment.findUniqueOrThrow({where:{jobId:nativeId}});
if(nativeBefore.status!=='RELEASED'||nativeBefore.grossPence!==10000||nativeBefore.platformFeePence!==900||nativeBefore.contractorPence!==8765||nativeBefore.processingFeePence!==335)throw Error('Unexpected native settlement');
const nativeRefund=await ops.adminResolveDispute(fixtures.users.admin.id,nativeId,{outcome:'REFUND',note:'Synthetic sandbox cleanup after native report-problem flow'});
const nativeRepeat=await ops.adminResolveDispute(fixtures.users.admin.id,nativeId,{outcome:'REFUND',note:'Synthetic sandbox idempotency check'});
async function api(role,path,body,expected=201){const r=await fetch('http://127.0.0.1:8080'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',cookie:f.cookies[role]},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();if(r.status!==expected)throw Error(path+' '+r.status+' '+JSON.stringify(j));return j.data??j;}
const cosmeticId=f.items[1].jobId;
await api('provider','/services/jobs/'+cosmeticId+'/start',{});
await api('provider','/services/jobs/'+cosmeticId+'/complete',{inspectionOutcome:'PASS',inspectionSummary:'Synthetic cosmetic inspection; no real work or vehicle.'});
await api('buyer','/services/jobs/'+cosmeticId+'/confirm',{});
const cosmeticReleased=await db.servicePayment.findUniqueOrThrow({where:{jobId:cosmeticId}});
if(cosmeticReleased.status!=='RELEASED'||cosmeticReleased.processingFeePence<=0||cosmeticReleased.contractorPence!==10000-900-cosmeticReleased.processingFeePence)throw Error('Cosmetic fee mismatch');
await api('buyer','/services/jobs/'+cosmeticId+'/dispute',{reason:'Synthetic cosmetic test refund and reversal cleanup'});
const cosmeticRefund=await ops.adminResolveDispute(fixtures.users.admin.id,cosmeticId,{outcome:'REFUND',note:'Synthetic sandbox cosmetic refund after settlement'});
const nativeAfter=await db.servicePayment.findUniqueOrThrow({where:{jobId:nativeId}});
const cosmeticAfter=await db.servicePayment.findUniqueOrThrow({where:{jobId:cosmeticId}});
const result={nativeBefore,nativeRefund,nativeRepeat,nativeAfter,cosmeticReleased,cosmeticRefund,cosmeticAfter};
writeFileSync(resolve(root,'inspection-settlement-refund-result.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));await db.$disconnect();