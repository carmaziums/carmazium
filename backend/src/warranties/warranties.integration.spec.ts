import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WarrantiesService } from './warranties.service';
import { CreateWarrantyQuoteDto } from './warranty.dto';

const integration = process.env.WARRANTY_POSTGRES_TEST === '1' ? describe : describe.skip;
integration('Warranty orders: real PostgreSQL, synthetic Stripe only', () => {
    let db: PrismaService, service: WarrantiesService, stripe: any, buyer: any, admin: any;
    const token = 'c'.repeat(64), sessions = new Map<string, any>(), intents = new Map<string, any>(), refunds = new Map<string, any>();
    const email = { sendBrandedEmail: jest.fn(async () => true) }, notifications = { create: jest.fn(async () => ({})) };
    beforeAll(async () => {
        if (!process.env.DATABASE_URL?.includes('@127.0.0.1:5432/carmazium_damage_qa')) throw new Error('Disposable CI Postgres only.');
        db = new PrismaService();
        buyer = await db.user.create({ data: { email: `warranty-buyer-${randomUUID()}@example.invalid`, passwordHash: 'synthetic', role: 'BUYER' } });
        admin = await db.user.create({ data: { email: `warranty-admin-${randomUUID()}@example.invalid`, passwordHash: 'synthetic', role: 'ADMIN' } });
        stripe = {
            accounts: { retrieve: jest.fn(async () => ({ id: 'acct_warranty_qa' })) },
            checkout: { sessions: {
                create: jest.fn(async (args: any, options: any) => {
                    if (!sessions.has(options.idempotencyKey)) sessions.set(options.idempotencyKey, { ...args, id: `cs_${randomUUID()}`, url: 'https://checkout.stripe.com/synthetic', amount_total: args.line_items[0].price_data.unit_amount, currency: 'gbp', livemode: false, status: 'open', payment_status: 'unpaid', payment_intent: `pi_${randomUUID()}` });
                    return sessions.get(options.idempotencyKey);
                }),
                retrieve: jest.fn(async (id: string) => [...sessions.values()].find(s => s.id === id)),
            } },
            paymentIntents: { retrieve: jest.fn(async (id: string) => intents.get(id)) },
            refunds: {
                list: jest.fn(async ({ payment_intent }: any) => ({ data: intents.get(payment_intent)?.latest_charge.amount_refunded ? [{ status: 'succeeded', amount: intents.get(payment_intent).latest_charge.amount_refunded }] : [] })),
                create: jest.fn(async (args: any, options: any) => {
                    if (!refunds.has(options.idempotencyKey)) {
                        refunds.set(options.idempotencyKey, { id: `re_${randomUUID()}`, status: 'succeeded' });
                        intents.get(args.payment_intent).latest_charge.amount_refunded = args.amount;
                    }
                    return refunds.get(options.idempotencyKey);
                }),
                retrieve: jest.fn(async (id: string) => [...refunds.values()].find(r => r.id === id)),
            },
        };
        service = new WarrantiesService(db, { getStripeClient: async () => stripe, isStripeInTestMode: () => true } as any, email as any, notifications as any, { get: () => 'https://example.invalid' } as any);
    });
    afterAll(async () => { if (db) await db.$disconnect(); });
    const details = () => ({ requestId: randomUUID(), accessToken: token,
        customer: { title: 'Mx', firstName: 'Synthetic', lastName: 'Warranty QA', email: buyer.email, phone: '07700900000', addressLine1: '1 Test Road', town: 'Birmingham', postcode: 'B1 1AA' },
        vehicle: { vrm: 'QA12ABC', make: 'Synthetic', model: 'Test', mileage: 50000, engineCc: 1200, fuelType: 'PETROL', firstRegistrationDate: '2019-09-30', retailValuePence: 599500, origin: 'UK', serviceHistory: 'FULL', purchaseDate: '2026-01-01', requestedStartDate: new Date().toISOString().slice(0, 10), knownFaults: 'NONE', detailsConfirmed: true },
        selection: { vehicleCategory: 'SUV', months: 12, repairLimit: 2000, labourRate: 100, extras: ['AIRBAGS', 'DRIVER_ASSISTANCE', 'EMISSIONS', 'MULTIMEDIA'] }, consent: true,
    } as CreateWarrantyQuoteDto);
    async function paidOrder() {
        const dto = details(), order = await service.quote(dto, buyer.id);
        await service.checkout(order.id, token, buyer.id);
        const session = sessions.get(`warranty-checkout-${order.id}`);
        Object.assign(session, { status: 'complete', payment_status: 'paid' });
        intents.set(session.payment_intent, { status: 'succeeded', amount_received: order.totalPence, currency: 'gbp', latest_charge: { amount_refunded: 0, disputed: false } });
        await service.reconcileSession(session);
        return { order, session };
    }
    it('retries a quote safely and rejects reuse with changed customer details', async () => {
        const dto = details();
        const [a, b] = await Promise.all([service.quote(dto, buyer.id), service.quote(dto, buyer.id)]);
        expect(a.id).toBe(b.id); expect(a.totalPence).toBe(80750);
        await expect(service.quote({ ...dto, customer: { ...dto.customer, lastName: 'Changed' } }, buyer.id)).rejects.toThrow('form changed');
        await expect(service.order(a.id, 'd'.repeat(64), 'outsider')).rejects.toThrow('not found');
    });
    it('concurrent checkout clicks create one Stripe session and duplicate webhooks create one paid transition', async () => {
        const order = await service.quote(details(), buyer.id);
        await Promise.all([service.checkout(order.id, token), service.checkout(order.id, token)]);
        const session = sessions.get(`warranty-checkout-${order.id}`);
        const pending = await db.warrantyOrder.findUniqueOrThrow({ where: { id: order.id } });
        expect(pending.stripeCheckoutSessionId).toBe(session.id);
        await service.reconcileSession(session);
        expect((await db.warrantyOrder.findUniqueOrThrow({ where: { id: order.id } })).paidAt).toBeNull();
        Object.assign(session, { status: 'complete', payment_status: 'paid' });
        await Promise.all([service.reconcileSession(session), service.reconcileSession(session)]);
        expect((await db.warrantyOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID_AWAITING_ISSUE');
        expect(await db.warrantyOrderMessage.count({ where: { orderId: order.id, kind: 'PAID_CUSTOMER' } })).toBe(1);
    });
    it('keeps paid orders paid after a stale failure and records manual issuance once', async () => {
        const { order, session } = await paidOrder();
        await service.handleStripeEvent('checkout.session.async_payment_failed', session);
        expect((await service.order(order.id, token)).status).toBe('PAID_AWAITING_ISSUE');
        await service.issue(order.id, { warrantyReference: `QA-${randomUUID()}`, coverStart: '2026-11-14', coverEnd: '2027-11-13', supplierPaidAndIssued: true }, admin.id);
        await service.reconcileSession(session);
        expect((await service.order(order.id, token)).status).toBe('ISSUED');
        await expect(service.issue(order.id, { warrantyReference: 'DUPLICATE', coverStart: '2026-11-14', coverEnd: '2027-11-13', supplierPaidAndIssued: true }, admin.id)).rejects.toThrow('Only a paid');
    });
    it('refunds an unissued order exactly once and never reopens it on a late success', async () => {
        const { order, session } = await paidOrder();
        await Promise.allSettled([service.refund(order.id, 'Supplier cannot arrange selected cover', admin.id), service.refund(order.id, 'Supplier cannot arrange selected cover', admin.id)]);
        await service.reconcileSession(session);
        expect((await service.order(order.id, token)).status).toBe('REFUNDED');
        expect([...refunds.keys()].filter(k => k === `warranty-refund-${order.id}`)).toHaveLength(1);
        await expect(service.issue(order.id, { warrantyReference: 'NO-COVER', coverStart: '2026-11-14', coverEnd: '2027-11-13', supplierPaidAndIssued: true }, admin.id)).rejects.toThrow();
    });
    it('keeps an email failure in the durable queue and sends it on retry', async () => {
        const { order } = await paidOrder();
        email.sendBrandedEmail.mockResolvedValue(false);
        await service.sendMessages();
        const message = await db.warrantyOrderMessage.findFirstOrThrow({ where: { orderId: order.id, kind: 'PAID_CUSTOMER' } });
        expect(message.sentAt).toBeNull();
        email.sendBrandedEmail.mockResolvedValue(true);
        await db.warrantyOrderMessage.updateMany({ where: { orderId: order.id }, data: { nextAttemptAt: new Date(0) } });
        await service.sendMessages();
        expect((await db.warrantyOrderMessage.findUniqueOrThrow({ where: { id: message.id } })).sentAt).not.toBeNull();
    });
});
