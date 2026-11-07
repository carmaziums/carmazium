import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';
import { ServicesLifecycleService } from './services-lifecycle.service';
import { TradeTeamService } from './trade-team.service';

const integration = process.env.TRADE_POSTGRES_TEST === '1' ? describe : describe.skip;
integration('TradeXchange: real PostgreSQL transactions, synthetic Stripe only', () => {
  let db: PrismaService, service: ServicesService, stripe: any, payments: any;
  let customer: any, providerUser: any, provider: any, outsider: any;
  const notify = { create: jest.fn().mockResolvedValue({}) };
  const email = { sendBrandedEmail: jest.fn().mockResolvedValue({}) };
  const config = { get: (key: string) => key === 'FRONTEND_URL' ? 'https://synthetic.invalid' : undefined };
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('@127.0.0.1:5432/carmazium_damage_qa')) throw new Error('Disposable CI Postgres only.');
    db = new PrismaService();
    const baseline = readFileSync(resolve(__dirname, '../../prisma/manual-migrations/20260919_tradexchange_admin_disputes_reviews_ops.sql'), 'utf8');
    await db.$executeRawUnsafe(baseline.slice(0, baseline.indexOf('create index')));
    const migration = readFileSync(resolve(__dirname, '../../prisma/manual-migrations/20261107_tradexchange_audit_settlement_and_job_changes.sql'), 'utf8');
    for (const statement of migration.split(';').filter(s => s.trim())) await db.$executeRawUnsafe(statement);
    const id = randomUUID();
    customer = await db.user.create({ data: { email: `trade-c-${id}@invalid.example`, passwordHash: 'synthetic', role: 'BUYER' } });
    providerUser = await db.user.create({ data: { email: `trade-p-${id}@invalid.example`, passwordHash: 'synthetic', role: 'DEALER', stripeConnectAccountId: 'acct_synthetic' } });
    outsider = await db.user.create({ data: { email: `trade-o-${id}@invalid.example`, passwordHash: 'synthetic', role: 'BUYER' } });
    provider = await db.contractorProfile.create({ data: { userId: providerUser.id, businessName: 'Synthetic Trade QA', serviceTypes: ['DELIVERY','INSPECTION'], certifications: [] } });
    for (const serviceType of ['DELIVERY', 'INSPECTION'] as const) await db.contractorCapability.create({ data: { contractorId: provider.id, serviceType, status: 'APPROVED', verificationStatus: 'VERIFIED', verificationExpiresAt: new Date(Date.now()+86400000), jobNationwide: true } });
  }, 30000);
  afterAll(async () => { if (db) await db.$disconnect(); });
  beforeEach(() => {
    jest.clearAllMocks();
    stripe = {
      checkout: { sessions: { retrieve: jest.fn(), expire: jest.fn().mockResolvedValue({ status: 'expired' }), create: jest.fn().mockResolvedValue({ id: `cs_${randomUUID()}`, url: 'https://synthetic.invalid/checkout' }) } },
      paymentIntents: { retrieve: jest.fn().mockResolvedValue({ latest_charge: 'ch_synthetic' }) },
      transfers: { create: jest.fn().mockImplementation(async (args: any) => ({ id: `tr_${randomUUID()}`, ...args })), retrieve: jest.fn(), createReversal: jest.fn().mockResolvedValue({ id: 'trr_synthetic' }) },
      refunds: { create: jest.fn().mockImplementation(async (args: any) => ({ id: `re_${randomUUID()}`, status: 'succeeded', ...args })), retrieve: jest.fn() },
      disputes: { retrieve: jest.fn() },
    };
    payments = { getStripeClient: async () => stripe, refreshConnectAccountReadiness: jest.fn().mockResolvedValue({ ready: true, accountId: 'acct_synthetic' }) };
    service = new ServicesService(db, notify as any, email as any, payments as any, config as any);
  });
  async function job(status: any = 'COMPLETED') {
    const j = await db.serviceJob.create({ data: { customerId: customer.id, contractorId: provider.id, serviceType: 'DELIVERY', title: 'Synthetic audit job', status, pickupPostcode: 'B1 1AA', deliveryPostcode: 'B2 2BB', workPostcodeArea: 'B', expiresAt: new Date(Date.now()+86400000), startedAt: ['IN_PROGRESS','COMPLETED','RELEASED'].includes(status) ? new Date(Date.now()-120000) : null, completedAt: ['COMPLETED','RELEASED'].includes(status) ? new Date(Date.now()-60000) : null } });
    const p = await db.servicePayment.create({ data: { jobId: j.id, customerId: customer.id, contractorId: provider.id, grossPence: 10000, platformFeeRate: .09, platformFeePence: 900, contractorPence: 9100, status: status === 'ACCEPTED' ? 'PENDING' : status === 'RELEASED' ? 'RELEASED' : 'PAID', stripePaymentIntentId: `pi_${randomUUID()}`, stripeCheckoutSessionId: `cs_${randomUUID()}`, stripeTransferId: status === 'RELEASED' ? `tr_${randomUUID()}` : null } });
    return { j, p };
  }
  const current = (id: string) => db.serviceJob.findUniqueOrThrow({ where: { id }, include: { payment: true } });
  function gate() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }

  it('a dispute blocks customer and automatic payout', async () => {
    const { j } = await job(); await service.openDispute(customer.id, j.id, 'Work incomplete');
    await expect(service.confirmCompletion(customer.id, j.id)).rejects.toThrow();
    await expect((service as any).release(j.id, 'automatic completion')).rejects.toThrow();
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });
  it('a stale release read cannot overtake a committed dispute', async () => {
    const { j } = await job(); const entered = gate(), resume = gate();
    const original = db.serviceJob.findUnique.bind(db.serviceJob);
    const spy = jest.spyOn(db.serviceJob as any, 'findUnique').mockImplementationOnce(async (args: any) => { const snapshot = await original(args); entered.resolve(); await resume.promise; return snapshot; });
    const release = (service as any).release(j.id, 'auto').then(() => null, (e: any) => e);
    await entered.promise; await service.openDispute(customer.id, j.id, 'Not done'); resume.resolve();
    expect(await release).toBeInstanceOf(Error); spy.mockRestore();
    expect((await current(j.id)).status).toBe('DISPUTED'); expect(stripe.transfers.create).not.toHaveBeenCalled();
  });
  it('a payout claim blocks a concurrent dispute and refund', async () => {
    const { j } = await job(); const entered = gate(), resume = gate();
    stripe.transfers.create.mockImplementation(async (args: any) => { entered.resolve(); await resume.promise; return { id: `tr_${randomUUID()}`, ...args }; });
    const release = service.confirmCompletion(customer.id, j.id); await entered.promise;
    await expect(service.openDispute(customer.id, j.id, 'Too late')).rejects.toThrow('Settlement');
    await expect(service.adminResolveDispute(customer.id, j.id, { outcome: 'REFUND' })).rejects.toThrow();
    resume.resolve(); await release; expect(stripe.transfers.create).toHaveBeenCalledTimes(1); expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
  it('Stripe timeout retains the claim and blocks the opposite action', async () => {
    const { j, p } = await job('DISPUTED'); stripe.transfers.create.mockRejectedValue(new Error('response lost'));
    await expect(service.adminResolveDispute(customer.id, j.id, { outcome: 'RELEASE' })).rejects.toThrow('response lost');
    expect((await current(j.id)).payment?.stripeTransferId).toBe(`claim:release:${p.id}`);
    await expect(service.adminResolveDispute(customer.id, j.id, { outcome: 'REFUND' })).rejects.toThrow('unresolved');
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
  it('does not blind-retry past Stripe idempotency retention', async () => {
    const { j, p } = await job(); await db.servicePayment.update({ where: { id: p.id }, data: { stripeTransferId: `claim:release:${p.id}`, settlementStartedAt: new Date(Date.now()-25*3600000) } });
    await expect(service.confirmCompletion(customer.id, j.id)).rejects.toThrow('retry window'); expect(stripe.transfers.create).not.toHaveBeenCalled();
  });
  it.each(['pending', 'failed', 'canceled'])('a %s refund never reports money returned', async status => {
    const { j, p } = await job('DISPUTED'); stripe.refunds.create.mockImplementation(async (args: any) => ({ id: `re_${randomUUID()}`, status, ...args }));
    await expect(service.adminResolveDispute(customer.id, j.id, { outcome: 'REFUND' })).rejects.toThrow('Funds remain locked');
    const after = await current(j.id); expect(after.status).toBe('DISPUTED'); expect(after.payment?.status).toBe('PAID'); expect(after.payment?.stripeTransferId).toBe(`claim:refund:${p.id}`);
    await expect(service.adminResolveDispute(customer.id, j.id, { outcome: 'RELEASE' })).rejects.toThrow(); expect(stripe.transfers.create).not.toHaveBeenCalled();
  });
  it('£20 refund on £100 settles £72.80 provider and £7.20 platform', async () => {
    const { j } = await job('DISPUTED'); await service.adminResolveDispute(customer.id, j.id, { outcome: 'PARTIAL_REFUND', refundAmountPence: 2000 });
    expect((await current(j.id)).payment).toMatchObject({ status: 'RELEASED', refundAmountPence: 2000, contractorPence: 7280, platformFeePence: 720 });
    expect(stripe.refunds.create.mock.calls[0][0].amount).toBe(2000); expect(stripe.transfers.create.mock.calls[0][0].amount).toBe(7280);
  });
  it('post-payout refund reverses provider funds first and never transfers again', async () => {
    const { j } = await job('RELEASED'); await service.openDispute(customer.id, j.id, 'Reported later'); await service.adminResolveDispute(customer.id, j.id, { outcome: 'REFUND' });
    expect(stripe.transfers.createReversal.mock.calls[0][1].amount).toBe(9100); expect(stripe.refunds.create.mock.calls[0][0].amount).toBe(10000); expect(stripe.transfers.create).not.toHaveBeenCalled(); expect((await current(j.id)).status).toBe('CANCELLED');
  });
  it('an unresolved refund amount cannot change', async () => {
    const { j } = await job('DISPUTED'); stripe.refunds.create.mockRejectedValue(new Error('lost'));
    await expect(service.adminResolveDispute(customer.id, j.id, { outcome: 'PARTIAL_REFUND', refundAmountPence: 2000 })).rejects.toThrow();
    await expect(service.adminResolveDispute(customer.id, j.id, { outcome: 'REFUND' })).rejects.toThrow('cannot change amount'); expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
  });
  it.each(['PAID','IN_PROGRESS','COMPLETED','RELEASED'])('provider can report inability to complete in %s', async status => {
    const { j } = await job(status); await service.requestJobChange(providerUser.id, provider.id, j.id, { kind: 'CANNOT_ATTEND', reason: 'Vehicle breakdown' });
    expect((await current(j.id)).status).toBe('DISPUTED'); expect(stripe.transfers.create).not.toHaveBeenCalled();
  });
  it('only the other party can agree a reschedule; outsiders cannot act', async () => {
    const { j } = await job('PAID'); const when = new Date(Date.now()+86400000).toISOString();
    await expect(service.requestJobChange(outsider.id, null, j.id, { kind: 'CANCEL', reason: 'Forged' })).rejects.toThrow();
    await service.requestJobChange(customer.id, null, j.id, { kind: 'RESCHEDULE', reason: 'Need tomorrow', requestedFor: when });
    await expect(service.acceptReschedule(customer.id, null, j.id)).rejects.toThrow('other party'); await expect(service.acceptReschedule(outsider.id, null, j.id)).rejects.toThrow();
    await service.acceptReschedule(providerUser.id, provider.id, j.id); expect((await current(j.id)).status).toBe('PAID'); expect((await current(j.id)).requestedFor?.toISOString()).toBe(when);
  });
  it('complete but unpaid Checkout stays reserved', async () => {
    const { j, p } = await job('ACCEPTED'); await db.serviceJob.update({ where: { id: j.id }, data: { acceptedAt: new Date(Date.now()-2*3600000) } });
    stripe.checkout.sessions.retrieve.mockResolvedValue({ status: 'complete', payment_status: 'unpaid' }); await new ServicesLifecycleService(service, db, payments, notify as any).expireUnpaidAcceptedJobs();
    expect((await current(j.id)).status).toBe('ACCEPTED'); expect((await current(j.id)).payment?.id).toBe(p.id);
  });
  it('expired verification preserves assigned-work access but blocks new quotes', async () => {
    await db.contractorCapability.updateMany({ where: { contractorId: provider.id }, data: { status: 'PENDING', verificationStatus: 'REVERIFICATION_REQUIRED' } });
    expect((await new TradeTeamService(db, notify as any).tryResolveActor(providerUser.id))?.contractorProfileId).toBe(provider.id);
    const { j } = await job('OPEN'); await db.servicePayment.deleteMany({ where: { jobId: j.id } });
    await expect(service.upsertQuote(provider.id, ['DELIVERY'], providerUser.id, j.id, { amountPence: 10000 })).rejects.toThrow();
    await db.contractorCapability.updateMany({ where: { contractorId: provider.id }, data: { status: 'APPROVED', verificationStatus: 'VERIFIED' } });
  });
  it('quote price change during acceptance rolls back the reservation', async () => {
    const { j } = await job('OPEN'); await db.servicePayment.deleteMany({ where: { jobId: j.id } });
    const quote = await db.serviceQuote.create({ data: { jobId: j.id, contractorId: provider.id, submittedById: providerUser.id, amountPence: 10000 } });
    payments.refreshConnectAccountReadiness.mockImplementationOnce(async () => { await service.upsertQuote(provider.id, ['DELIVERY'], providerUser.id, j.id, { amountPence: 12000 }); return { ready: true, accountId: 'acct_synthetic' }; });
    await expect(service.acceptQuote(customer.id, j.id, quote.id)).rejects.toThrow('quote changed'); expect((await current(j.id)).status).toBe('OPEN'); expect((await current(j.id)).payment).toBeNull();
  });
  it('inspection and delivery coexist for one auction; a duplicate inspection is rejected', async () => {
    const listing = await db.listing.create({ data: { sellerId: customer.id, title: 'Synthetic', price: 1000, slug: `trade-${randomUUID()}`, status: 'DRAFT', images: [], videoUrls: [] } });
    const auction = await db.auction.create({ data: { listingId: listing.id, startTime: new Date(), endTime: new Date(), reservePrice: 1000, startingBid: 100, minIncrement: 10 } });
    const data = { customerId: customer.id, title: 'Synthetic linked job', sourceAuctionId: auction.id, expiresAt: new Date(Date.now()+86400000) };
    await db.serviceJob.create({ data: { ...data, serviceType: 'DELIVERY' } }); await db.serviceJob.create({ data: { ...data, serviceType: 'INSPECTION' } });
    await expect(db.serviceJob.create({ data: { ...data, serviceType: 'INSPECTION' } })).rejects.toThrow();
  });
  it('a refund webhook finalizes pending funds once, with no second refund', async () => {
    const { j, p } = await job('DISPUTED'); const id = `re_${randomUUID()}`;
    stripe.refunds.create.mockImplementation(async (args: any) => ({ id, status: 'pending', ...args }));
    await expect(service.adminResolveDispute(customer.id, j.id, { outcome: 'REFUND' })).rejects.toThrow();
    stripe.refunds.retrieve.mockResolvedValue({ id, status: 'succeeded', amount: 10000, payment_intent: p.stripePaymentIntentId });
    const event = { id, metadata: { serviceJobId: j.id, servicePaymentId: p.id } };
    await service.reconcileSettlementEvent('refund.updated', event); await service.reconcileSettlementEvent('refund.updated', event);
    expect((await current(j.id)).payment?.status).toBe('REFUNDED'); expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
  });
  it('canonical bank disputes freeze settlement and repeated notifications cannot release funds', async () => {
    const { j, p } = await job(); stripe.disputes.retrieve.mockResolvedValue({ id: 'dp_synthetic', payment_intent: p.stripePaymentIntentId, status: 'needs_response' });
    await service.reconcileSettlementEvent('charge.dispute.created', { id: 'dp_synthetic' });
    await service.reconcileSettlementEvent('charge.dispute.updated', { id: 'dp_synthetic' });
    await expect(service.adminResolveDispute(customer.id, j.id, { outcome: 'RELEASE' })).rejects.toThrow('bank dispute');
    expect((await current(j.id)).status).toBe('DISPUTED'); expect(stripe.transfers.create).not.toHaveBeenCalled();
  });
  it('an unrelated refund cannot finalize this payment', async () => {
    const { j, p } = await job('DISPUTED'); stripe.refunds.create.mockRejectedValue(new Error('timeout'));
    await expect(service.adminResolveDispute(customer.id, j.id, { outcome: 'REFUND' })).rejects.toThrow();
    stripe.refunds.retrieve.mockResolvedValue({ id: 're_wrong', status: 'succeeded', amount: 10000, payment_intent: 'pi_other' });
    await service.reconcileSettlementEvent('refund.updated', { id: 're_wrong', metadata: { serviceJobId: j.id, servicePaymentId: p.id } });
    expect((await current(j.id)).payment?.status).toBe('PAID'); expect((await current(j.id)).payment?.stripeRefundId).toBeNull();
  });
  it('withdrawal during acceptance cannot leave an accepted withdrawn quote', async () => {
    const { j } = await job('OPEN'); await db.servicePayment.deleteMany({ where: { jobId: j.id } });
    const quote = await db.serviceQuote.create({ data: { jobId: j.id, contractorId: provider.id, submittedById: providerUser.id, amountPence: 10000 } });
    payments.refreshConnectAccountReadiness.mockImplementationOnce(async () => { await service.withdrawQuote(provider.id, j.id); return { ready: true, accountId: 'acct_synthetic' }; });
    await expect(service.acceptQuote(customer.id, j.id, quote.id)).rejects.toThrow('quote changed'); expect((await current(j.id)).status).toBe('OPEN'); expect((await current(j.id)).payment).toBeNull();
  });

});
