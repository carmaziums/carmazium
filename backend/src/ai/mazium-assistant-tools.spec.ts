import { boundedConversation, redactMaziumText, runMaziumTool } from './mazium-assistant-tools';
import { AiService } from './ai.service';

describe('MaziuM authenticated tools', () => {
 const setup = (role = 'BUYER') => {
  const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue({ role, deletedAt: null, stripeConnectOnboardingComplete: false }) }, dealerProfile: { findUnique: jest.fn().mockResolvedValue(null) }, dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) }, listing: { findMany: jest.fn().mockResolvedValue([]) }, auction: { findMany: jest.fn().mockResolvedValue([]) }, warrantyOrder: { findMany: jest.fn().mockResolvedValue([]) }, serviceJob: { findMany: jest.fn().mockResolvedValue([]) } };
  return prisma;
 };
 it.each(['read_my_warranty_orders', 'read_my_service_jobs'])('enforces authentication and rejects injected selectors for %s', async name => {
  const db=setup();
  expect(await runMaziumTool(db,undefined,name,{})).toMatchObject({error:'SIGN_IN_REQUIRED'});
  expect(await runMaziumTool(db,'alice',name,{userId:'bob'})).toMatchObject({error:'INVALID_ARGUMENTS'});
  expect(await runMaziumTool(db,'alice',name,{email:'bob@example.com'})).toMatchObject({error:'INVALID_ARGUMENTS'});
  expect(db.user.findUnique).not.toHaveBeenCalled();
  db.user.findUnique.mockResolvedValue({role:'BUYER',deletedAt:new Date()});
  expect(await runMaziumTool(db,'alice',name,{})).toMatchObject({error:'ACCOUNT_UNAVAILABLE'});
  expect(db.warrantyOrder.findMany).not.toHaveBeenCalled();expect(db.serviceJob.findMany).not.toHaveBeenCalled();
 });
 it('limits warranty evidence to personal order status and excludes identity, policy and payment secrets', async () => {
  const db=setup('DEALER');db.dealerStaff.findFirst.mockResolvedValue({role:'ADMIN',dealerProfile:{id:'d',userId:'owner',isVerified:true}});
  db.warrantyOrder.findMany.mockResolvedValue([{id:'w',status:'PAID',paidAt:new Date(),issuedAt:null}]);
  const r:any=await runMaziumTool(db,'staff','read_my_warranty_orders',{});
  expect(db.warrantyOrder.findMany.mock.calls[0][0]).toEqual({where:{userId:'staff'},orderBy:{updatedAt:'desc'},take:10,select:{id:true,status:true,totalPence:true,currency:true,paidAt:true,issuedAt:true,coverStart:true,coverEnd:true,expiresAt:true,updatedAt:true}});
  expect(r.orders[0]).toMatchObject({status:'PAID',issuedAt:null});
  expect(r.limitation).toContain('PAID is not policy issuance');expect(r.scope).toContain('Guest orders');
 });
 it('only reads jobs booked by the actor, with no addresses, other customers or free text', async () => {
  const db=setup('DEALER');db.dealerStaff.findFirst.mockResolvedValue({role:'ADMIN',dealerProfile:{id:'d',userId:'owner',isVerified:true}});
  db.serviceJob.findMany.mockResolvedValue([{id:'j',status:'COMPLETED',confirmedAt:null,payment:{status:'PAID',releasedAt:null}}]);
  const r:any=await runMaziumTool(db,'staff','read_my_service_jobs',{});
  const query=db.serviceJob.findMany.mock.calls[0][0];
  expect(query).toMatchObject({where:{customerId:'staff'},orderBy:{updatedAt:'desc'},take:10});
  expect(Object.keys(query.select).sort()).toEqual(['id','serviceType','isRecovery','status','requestedFor','acceptedAt','startedAt','completedAt','confirmedAt','cancelledAt','updatedAt','payment'].sort());
  expect(query.select.payment.select).toEqual({status:true,grossPence:true,paidAt:true,releasedAt:true,refundedAt:true});
  expect(r.jobs[0]).toMatchObject({status:'COMPLETED',confirmedAt:null,payment:{status:'PAID',releasedAt:null}});
  expect(r.scope).toContain('Not assigned provider');expect(r.limitation).toContain('does not verify bank settlement');
 });
 it('never runs anonymous private lookups', async () => {
  const db = setup();
  expect(await runMaziumTool(db, undefined, 'read_my_listings', {})).toMatchObject({ error: 'SIGN_IN_REQUIRED', checked: false });
  expect(db.user.findUnique).not.toHaveBeenCalled();
 });
 it('rejects injected customer identifiers instead of executing an IDOR lookup', async () => {
  const db = setup();
  expect(await runMaziumTool(db, 'alice', 'read_my_listings', {userId:'bob'})).toMatchObject({error:'INVALID_ARGUMENTS'});
  expect(db.listing.findMany).not.toHaveBeenCalled();
 });
 it('has no arbitrary SQL or mutation capability', async () => {
  expect(await runMaziumTool(setup(), 'alice', 'release_bonus', {})).toMatchObject({error:'UNSUPPORTED_TOOL'});
 });
 it('excludes deleted accounts', async () => {
  const db=setup();db.user.findUnique.mockResolvedValue({role:'BUYER',deletedAt:new Date()});
  expect(await runMaziumTool(db,'alice','read_my_account',{})).toMatchObject({error:'ACCOUNT_UNAVAILABLE'});
 });
 it('private accounts cannot acquire bidding permission through text', async () => {
  expect(await runMaziumTool(setup(),'alice','read_my_account',{})).toMatchObject({role:'BUYER',canPlaceBid:false});
 });
 it('verified finance managers can view trade but cannot place bids', async () => {
  const db=setup('DEALER');db.dealerStaff.findFirst.mockResolvedValue({role:'FINANCE_MANAGER',dealerProfile:{id:'d',userId:'owner',isVerified:true}});
  expect(await runMaziumTool(db,'staff','read_my_account',{})).toMatchObject({dealerStaffRole:'FINANCE_MANAGER',canViewTrade:true,canPlaceBid:false});
 });
 it('unverified dealership owners cannot place bids', async () => {
  const db=setup('DEALER');db.dealerProfile.findUnique.mockResolvedValue({id:'d',userId:'owner',isVerified:false});
  expect(await runMaziumTool(db,'owner','read_my_account',{})).toMatchObject({canPlaceBid:false});
 });
 it('always scopes listing queries to the owner and excludes deleted rows', async () => {
  const db=setup();await runMaziumTool(db,'alice','read_my_listings',{});
  expect(db.listing.findMany.mock.calls[0][0]).toMatchObject({where:{sellerId:'alice',deletedAt:null},take:10});
  expect(JSON.stringify(db.listing.findMany.mock.calls[0][0].select)).not.toMatch(/description|images|phone|bank/);
 });
 it('dealer staff inventory resolves to the actual business owner', async () => {
  const db=setup('DEALER');db.dealerStaff.findFirst.mockResolvedValue({role:'SALES_AGENT',dealerProfile:{id:'d',userId:'owner',isVerified:true}});
  await runMaziumTool(db,'staff','read_my_listings',{});
  expect(db.listing.findMany.mock.calls[0][0].where.sellerId).toBe('owner');
 });
 it('does not expose the dealership owner personal bonus records to staff', async () => {
  const db=setup('DEALER');db.dealerStaff.findFirst.mockResolvedValue({role:'ADMIN',dealerProfile:{id:'d',userId:'owner',isVerified:true}});
  await runMaziumTool(db,'staff','read_my_seller_bonuses',{});
  expect(db.auction.findMany.mock.calls[0][0].where.listing.sellerId).toBe('staff');
 });
 it.each([
  [false,null,null,'NOT_APPROVED'],
  [true,null,null,'APPROVED_PAYOUT_PENDING'],
  [true,'claim:seller-bonus:123',null,'APPROVED_PAYOUT_PENDING'],
  [true,'tr_abc',null,'STRIPE_TRANSFER_RECORDED'],
  [true,null,new Date(),'MANUAL_PAYMENT_RECORDED'],
 ])('separates approval, claim and transfer evidence', async (approved,transfer,manual,expected) => {
  const db=setup();db.auction.findMany.mockResolvedValue([{sellerBonusReleased:approved,stripePayoutTransferId:transfer,manualPayoutConfirmedAt:manual}]);
  const r:any=await runMaziumTool(db,'alice','read_my_seller_bonuses',{});
  expect(r.auctions[0]).toMatchObject({payoutState:expected,bankSettlementVerified:false});
  expect(r.auctions[0].stripePayoutTransferId).toBeUndefined();
 });
 it('reads archived seller auction history without exposing private handover or buyer details', async () => {
  const db=setup();db.auction.findMany.mockResolvedValue([{id:'auction',status:'ENDED',listing:{id:'listing',make:'Toyota',model:'Yaris',year:2015,deletedAt:new Date()}}]);
  const result:any=await runMaziumTool(db,'alice','read_my_auctions',{});
  const query=db.auction.findMany.mock.calls[0][0];
  expect(query.where).toEqual({deletedAt:null,listing:{sellerId:'alice'}});
  expect(query.take).toBe(11);
  expect(JSON.stringify(query.select)).not.toMatch(/buyer|handover|address|phone|email|bank|reserve|image/i);
  expect(result).toMatchObject({hasMore:false,auctions:[{status:'ENDED',listingArchived:true}]});
  expect(result.auctions[0].listing.deletedAt).toBeUndefined();
 });
 it('reports the bounded history window without implying no older records exist', async () => {
  const db=setup();db.auction.findMany.mockResolvedValue(Array.from({length:11},(_,i)=>({id:String(i),listing:{deletedAt:null}})));
  const result:any=await runMaziumTool(db,'alice','read_my_auctions',{});
  expect(result.hasMore).toBe(true);expect(result.auctions).toHaveLength(10);
 });
 it.each(['read_my_auctions','read_my_seller_bonuses'])('requires authentication and rejects foreign identifiers for %s', async name => {
  const db=setup();
  expect(await runMaziumTool(db,undefined,name,{})).toMatchObject({error:'SIGN_IN_REQUIRED'});
  expect(await runMaziumTool(db,'alice',name,{sellerId:'bob'})).toMatchObject({error:'INVALID_ARGUMENTS'});
  expect(db.auction.findMany).not.toHaveBeenCalled();
 });
 it('resolves staff auction history to permitted dealership inventory', async () => {
  const db=setup('DEALER');db.dealerStaff.findFirst.mockResolvedValue({role:'SALES_AGENT',dealerProfile:{id:'d',userId:'owner',isVerified:true}});
  await runMaziumTool(db,'staff','read_my_auctions',{});
  expect(db.auction.findMany.mock.calls[0][0].where.listing.sellerId).toBe('owner');
 });
 it('keeps personal bonus history after a listing is archived', async () => {
  const db=setup();await runMaziumTool(db,'alice','read_my_seller_bonuses',{});
  expect(db.auction.findMany.mock.calls[0][0].where).toEqual({deletedAt:null,listing:{sellerId:'alice'}});
 });
 it('retrieves selected facts without regex vocabulary matching', async () => {
  const r:any=await runMaziumTool(setup(),undefined,'read_platform_knowledge',{topics:['sale-handover-reward','vehicle-finance']});
  expect(r.map(x=>x.topic)).toEqual(['sale-handover-reward','vehicle-finance']);
 });
 it('bounds history and preserves sequence and latest question', () => {
  const messages=Array.from({length:60},(_,i)=>({role:'user' as const,content:`Turn ${i}`}));
  const selected=boundedConversation(messages);
  expect(selected).toHaveLength(40);expect(selected[0].content).toBe('Turn 20');expect(selected[39].content).toBe('Turn 59');
  expect(boundedConversation(messages.map(m=>({...m,content:'x'.repeat(4000)}))).map(m=>m.content).join('').length).toBe(24000);
 });
 it('redacts credentials and contact details before external processing', () => {
  expect(redactMaziumText('a@example.com 07700123456 my password is secret123')).not.toMatch(/example.com|07700123456|secret123/);
 });
});

describe('MaziuM reasoning tool loop', () => {
 it('uses Responses with encrypted reasoning continuity, real tool dispatch and no provider storage', async () => {
  const db:any={user:{findUnique:jest.fn().mockResolvedValue({role:'BUYER',deletedAt:null,stripeConnectOnboardingComplete:false})},listing:{findMany:jest.fn().mockResolvedValue([{make:'Toyota',status:'PENDING_REVIEW'}])}};
  const service=new AiService({get:(key:string)=>key==='OPENAI_API_KEY'?'test-key':undefined} as any,db);
  const reasoning={id:'r',type:'reasoning',summary:[],encrypted_content:'opaque'};
  const responses=jest.fn().mockResolvedValueOnce({output:[reasoning,{type:'function_call',call_id:'c',name:'read_my_listings',arguments:'{}'}]})
   .mockResolvedValueOnce({output:[],output_text:JSON.stringify({text:'Your Toyota is Pending Review; payment alone does not make it public.'})});
  (service as any).openai={responses:{create:responses},moderations:{create:jest.fn().mockResolvedValue({results:[{flagged:false}]})}};
  const r=await service.chatCompletion([{role:'user',content:'Why is my Toyota missing?'}],{userId:'alice',page:'/dashboard/user'});
  expect(r.text).toContain('Pending Review');expect(db.listing.findMany.mock.calls[0][0].where.sellerId).toBe('alice');
  expect(responses.mock.calls[0][0]).toMatchObject({model:'gpt-6.2-sol',store:false,reasoning:{effort:'low'}});
  expect(responses.mock.calls[1][0].input).toContainEqual(reasoning);
  expect(responses.mock.calls[1][0].input.some((m:any)=>m.type==='function_call_output'&&m.output.includes('PENDING_REVIEW'))).toBe(true);
 });
 it('turns failed lookups into explicit failure evidence, never an empty successful record', async () => {
  const service=new AiService({get:(k:string)=>k==='OPENAI_API_KEY'?'test-key':undefined} as any,{user:{findUnique:jest.fn().mockRejectedValue(new Error('private SQL'))}} as any);
  const responses=jest.fn().mockResolvedValue({output:[],output_text:JSON.stringify({text:'I cannot verify your account right now.'})});
  (service as any).openai={responses:{create:responses},moderations:{create:jest.fn().mockResolvedValue({results:[{flagged:false}]})}};
  await service.chatCompletion([{role:'user',content:'Can I bid?'}],{userId:'alice'});
  const input=JSON.stringify(responses.mock.calls[0][0].input);
  expect(input).toContain('LOOKUP_UNAVAILABLE');expect(input).not.toContain('private SQL');
 });
});


describe('MaziuM complete answer repair', () => {
 it('repairs a permission hallucination while retaining finance and warranty questions', async () => {
  const service=new AiService({get:(k:string)=>k==='OPENAI_API_KEY'?'test-key':undefined} as any,{} as any);
  const responses=jest.fn().mockResolvedValueOnce({output:[],output_text:JSON.stringify({text:'Private buyers can bid at auction.'})})
   .mockResolvedValueOnce({output:[],output_text:JSON.stringify({text:'Private buyers cannot bid at auction. Use Retail at /search. Finance is subject to provider approval, and warranty payment is separate from policy issuance.'})});
  (service as any).openai={responses:{create:responses},moderations:{create:jest.fn().mockResolvedValue({results:[{flagged:false}]})}};
  const r=await service.chatCompletion([{role:'user',content:'I am private and want an auction car, finance and warranty.'}]);
  expect(responses).toHaveBeenCalledTimes(2);expect(r.text).toMatch(/Finance/);expect(r.text).toMatch(/warranty/);expect(r.requiresHumanReview).toBeUndefined();
  expect(JSON.stringify(responses.mock.calls[1][0].input)).toContain('EVERY part');
 });
 it('withholds a repeated false permission and flags human review', async () => {
  const service=new AiService({get:(k:string)=>k==='OPENAI_API_KEY'?'test-key':undefined} as any,{} as any);
  const responses=jest.fn().mockResolvedValue({output:[],output_text:JSON.stringify({text:'Private buyers can bid at auction.'})});
  (service as any).openai={responses:{create:responses},moderations:{create:jest.fn().mockResolvedValue({results:[{flagged:false}]})}};
  const r=await service.chatCompletion([{role:'user',content:'Can private buyers bid?'}]);
  expect(responses).toHaveBeenCalledTimes(2);expect(r.requiresHumanReview).toBe(true);expect(r.text).not.toContain('Private buyers can bid');
 });
});
