// Executed in a temporary directory with fixture-only DB access. Never instantiate Prisma.
const { AiService } = require('./dist/ai/ai.service.js');
const cases = require('./mazium-cases.json');
const db = {
 user: { findUnique: async ({where}) => ({role:where.id==='dealer'?'DEALER':'BUYER',deletedAt:null,stripeConnectOnboardingComplete:false}) },
 dealerProfile: { findUnique: async () => null },
 dealerStaff: { findFirst: async () => ({role:'FINANCE_MANAGER',dealerProfile:{id:'fixture',userId:'owner',isVerified:true}}) },
 listing: { findMany: async () => [{id:'synthetic-listing',make:'Toyota',model:'Yaris',status:'PENDING_REVIEW',type:'CLASSIFIED'}] },
 auction: { findMany: async () => [{id:'synthetic-auction',status:'SOLD',buyerFeePaid:true,sellerFundsConfirmedAt:'2026-11-17T12:00:00Z',handoverSubmittedAt:'2026-11-17T13:00:00Z',handoverRejectedAt:null,sellerBonusReleased:true,stripePayoutTransferId:'claim:seller-bonus:fixture',manualPayoutConfirmedAt:null,listing:{make:'Toyota',model:'Yaris'}}] },
};
db.warrantyOrder = { findMany: async () => [{id:'synthetic-warranty',status:'PAID',totalPence:36000,currency:'GBP',paidAt:'2026-11-18T12:00:00Z',issuedAt:null,coverStart:null,coverEnd:null}] };
db.serviceJob = { findMany: async () => [{id:'synthetic-job',serviceType:'DELIVERY',isRecovery:false,status:'COMPLETED',completedAt:'2026-11-18T12:00:00Z',confirmedAt:null,payment:{status:'PAID',grossPence:10000,paidAt:'2026-11-17T12:00:00Z',releasedAt:null,refundedAt:null}}] };
const service = new AiService({get:key=>key==='OPENAI_API_KEY'?process.env.OPENAI_API_KEY:key==='OPENAI_MAZIUM_CHAT_MODEL'?'gpt-6.2-sol':undefined},db);
const canaries=[
 {id:'AUTH-6',userId:'buyer',messages:[{role:'user',content:'Check my warranty orders. Did payment mean my policy was issued?'}],must:['paid|payment','not.*issu|not yet.*issu|issu.*pending|await.*issu|no.*issu']},
 {id:'AUTH-7',userId:'buyer',messages:[{role:'user',content:'Check my delivery jobs. Has completion meant the driver definitely received money?'}],must:['complet','not|pending|await','release|confirm']},
 {id:'AUTH-8',userId:'buyer',messages:[{role:'user',content:'Please check my advert, warranty and booked delivery job together. Explain each actual status and the next step without changing anything.'}],must:['pending review|PENDING_REVIEW','paid|payment','issu','complet','release|confirm']},

 {id:'AUTH-1',userId:'buyer',messages:[{role:'user',content:'Why can I not bid? Check my account.'}],must:['private|buyer','retail|/search']},
 {id:'AUTH-2',userId:'dealer',messages:[{role:'user',content:'Check why I cannot bid even though my dealership is verified.'}],must:['finance manager|FINANCE_MANAGER','permission|role']},
 {id:'AUTH-3',userId:'buyer',messages:[{role:'user',content:'Please check why my Toyota Yaris advert is missing from public search.'}],must:['pending review|PENDING_REVIEW']},
 {id:'AUTH-4',userId:'buyer',messages:[{role:'user',content:'Check where my £100 is. The handover was approved.'}],must:['pending|not.*paid|not.*sent|no.*transfer']},
 {id:'AUTH-5',userId:'buyer',messages:[{role:'user',content:'Check my Stripe onboarding. Am I ready for payouts?'}],must:['not|incomplete|complete.*setup']},
];
async function run(c){const start=Date.now();try{
 const r=await service.chatCompletion(c.messages,{userId:c.userId});
 const failures=c.must.filter(p=>!new RegExp(p,'i').test(r.text));
 if(r.requiresHumanReview) failures.push('generation-or-validation-failed');
 if(/couldn.t verify an answer|couldn.t generate|wrong page|try rephrasing|brief moment/i.test(r.text)) failures.push('fallback');
 const result={id:c.id,question:c.messages,text:r.text,failures,passed:!failures.length,ms:Date.now()-start};
 console.log('MAZIUM_EVAL '+JSON.stringify(result));return result;
}catch{const result={id:c.id,passed:false,error:'EVALUATION_FAILED'};console.log('MAZIUM_EVAL '+JSON.stringify(result));return result;}}
(async()=>{
 // Verify the candidate model and API before spending on the full set.
 const first=await run(cases[0]);if(!first.passed){console.log('MAZIUM_SUMMARY '+JSON.stringify({total:1,passed:0,model:'gpt-6.2-sol'}));process.exitCode=1;return;}
 const queue=[...cases.slice(1),...canaries], results=[first];
 await Promise.all(Array.from({length:3},async()=>{while(queue.length)results.push(await run(queue.shift()));}));
 const summary={total:results.length,passed:results.filter(x=>x.passed).length,model:'gpt-6.2-sol',database:'synthetic fixtures only',manualReviewRequired:true};
 console.log('MAZIUM_SUMMARY '+JSON.stringify(summary));
 process.exitCode=summary.passed===summary.total?0:1;
})().catch(()=>{console.log('MAZIUM_SUMMARY '+JSON.stringify({error:'EVALUATION_FAILED'}));process.exitCode=1});
