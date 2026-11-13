import { createHash, randomUUID } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WarrantiesService } from './warranties.service';
import { CreateWarrantyQuoteDto } from './warranty.dto';

const token = 'a'.repeat(64);
const fixture = () => ({ requestId: randomUUID(), accessToken: token,
    customer: { title: 'Mx', firstName: 'Warranty', lastName: 'Test', email: 'warranty@example.invalid', phone: '07700900000', addressLine1: '1 Test Road', town: 'Birmingham', postcode: 'B1 1AA' },
    vehicle: { vrm: 'QA12ABC', make: 'Test', model: 'Test', mileage: 50000, engineCc: 1200, fuelType: 'PETROL', firstRegistrationDate: '2019-09-30', retailValuePence: 599500, origin: 'UK', serviceHistory: 'FULL', purchaseDate: '2026-01-01', requestedStartDate: new Date().toISOString().slice(0, 10), knownFaults: 'NONE', detailsConfirmed: true },
    selection: { vehicleCategory: 'CAR', months: 12, repairLimit: 2000, labourRate: 75, extras: [] }, consent: true,
} as CreateWarrantyQuoteDto);

describe('Warranty form and payment boundaries', () => {
    let service: WarrantiesService, db: any, stripe: any, row: any;
    beforeEach(() => {
        row = { id: 'order', status: 'CHECKOUT_PENDING', userId: 'buyer', accessTokenHash: createHash('sha256').update(token).digest('hex'), totalPence: 36000, currency: 'gbp', stripeAccountId: 'acct_qa', stripeCheckoutSessionId: 'cs_qa', stripePaymentIntentId: null, paidAt: null, customer: fixture().customer, vehicle: fixture().vehicle, selection: fixture().selection, price: {}, tariffVersion: 'qa' };
        db = { warrantyOrder: {
            findUnique: jest.fn(async () => ({ ...row })), findUniqueOrThrow: jest.fn(async () => ({ ...row })),
            update: jest.fn(async ({ data }) => { Object.assign(row, data); return { ...row } }),
            updateMany: jest.fn(async ({ where, data }) => { if (where.status && row.status !== where.status) return { count: 0 }; if (where.paidAt === null && row.paidAt) return { count: 0 }; Object.assign(row, data); return { count: 1 } }),
            create: jest.fn(async ({ data }) => ({ ...data, status: 'QUOTED' })),
        }, $queryRaw: jest.fn(), user: { findMany: jest.fn(async () => [{ id: 'admin', email: 'admin@example.invalid' }]) }, warrantyOrderMessage: { createMany: jest.fn() } };
        db.$transaction = jest.fn(fn => fn(db));
        stripe = { checkout: { sessions: { retrieve: jest.fn(), create: jest.fn() } }, paymentIntents: { retrieve: jest.fn(async () => ({ status: 'succeeded', amount_received: 36000, currency: 'gbp', latest_charge: { amount_refunded: 0, disputed: false } })) }, accounts: { retrieve: jest.fn(async () => ({ id: 'acct_qa' })) }, refunds: { create: jest.fn(), retrieve: jest.fn(), list: jest.fn(async () => ({ data: [] })) } };
        service = new WarrantiesService(db, { getStripeClient: async () => stripe, isStripeInTestMode: () => true } as any, {} as any, {} as any, { get: () => 'https://example.invalid' } as any);
    });
    const paid = () => ({ id: 'cs_qa', metadata: { type: 'WARRANTY_ORDER', orderId: 'order', accountId: 'acct_qa' }, client_reference_id: 'order', amount_total: 36000, currency: 'gbp', mode: 'payment', livemode: false, status: 'complete', payment_status: 'paid', payment_intent: 'pi_qa' });

    it('validates a complete form and rejects missing nested details, unsupported cover and false consent', async () => {
        expect(await validate(plainToInstance(CreateWarrantyQuoteDto, fixture(), { enableImplicitConversion: true }))).toHaveLength(0);
        for (const change of [{ customer: undefined }, { vehicle: undefined }, { selection: undefined }, { consent: 'false' }, { consent: false }, { vehicle: { ...fixture().vehicle, detailsConfirmed: 'false' } }, { selection: { ...fixture().selection, repairLimit: 5000 } }, { selection: { ...fixture().selection, labourRate: 125 } }]) {
            expect((await validate(plainToInstance(CreateWarrantyQuoteDto, { ...fixture(), ...change }, { enableImplicitConversion: true }))).length).toBeGreaterThan(0);
        }
    });
    it('uses the server tariff and stores only the token hash', async () => {
        const result = await service.quote(fixture(), 'buyer');
        expect(result.totalPence).toBe(36000);
        const saved = db.warrantyOrder.create.mock.calls[0][0].data;
        expect(saved.accessTokenHash).not.toBe(token); expect(saved).not.toHaveProperty('accessToken');
    });
    it('does not grant access to another buyer or a guessed token', async () => {
        await expect(service.order('order', 'b'.repeat(64), 'other')).rejects.toThrow('not found');
        await expect(service.checkout('order', undefined, 'other')).rejects.toThrow('not found');
    });
    it('does not treat an unpaid/delayed checkout as paid', async () => {
        await service.reconcileSession({ ...paid(), payment_status: 'unpaid' });
        expect(row.status).toBe('CHECKOUT_PENDING'); expect(db.warrantyOrderMessage.createMany).not.toHaveBeenCalled();
    });
    it.each([{ amount_total: 1 }, { currency: 'usd' }, { id: 'cs_other' }, { client_reference_id: 'other' }, { livemode: true }, { mode: 'subscription' }, { metadata: { type: 'WARRANTY_ORDER', orderId: 'order', accountId: 'acct_other' } }])('rejects mismatched payment evidence %j', async change => {
        await expect(service.reconcileSession({ ...paid(), ...change })).rejects.toThrow(/match/);
        expect(row.status).toBe('CHECKOUT_PENDING');
    });
    it('records settled money once and queues customer/admin emails, without issuing cover', async () => {
        await service.reconcileSession(paid()); await service.reconcileSession(paid());
        expect(row.status).toBe('PAID_AWAITING_ISSUE'); expect(row.issuedAt).toBeUndefined();
        expect(db.warrantyOrderMessage.createMany).toHaveBeenCalledTimes(1);
        expect(db.warrantyOrderMessage.createMany.mock.calls[0][0].data.map(x => x.kind)).toEqual(['PAID_CUSTOMER', 'PAID_ADMIN']);
    });
    it.each(['ISSUED', 'REFUNDED', 'PAYMENT_REVIEW'])('never demotes %s on late payment/expiry', async status => {
        row.status = status; row.paidAt = new Date();
        await service.reconcileSession(paid()); await service.reconcileSession({ ...paid(), status: 'expired', payment_status: 'unpaid' });
        expect(row.status).toBe(status);
    });
    it('reuses a still-open checkout instead of creating another charge', async () => {
        stripe.checkout.sessions.retrieve.mockResolvedValue({ ...paid(), status: 'open', payment_status: 'unpaid', url: 'https://checkout.stripe.com/qa' });
        await expect(service.checkout('order', token)).resolves.toEqual({ url: 'https://checkout.stripe.com/qa' });
        expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
    it('blocks issuance before payment', async () => {
        await expect(service.issue('order', { warrantyReference: 'QA-ONLY', coverStart: '2026-11-14', coverEnd: '2027-11-13', supplierPaidAndIssued: true }, 'admin')).rejects.toThrow('Only a paid');
    });
    it('checks Stripe for refunds/disputes before recording actual issuance', async () => {
        Object.assign(row, { status: 'PAID_AWAITING_ISSUE', paidAt: new Date(), stripePaymentIntentId: 'pi_qa' });
        stripe.paymentIntents.retrieve.mockResolvedValue({ status: 'succeeded', amount_received: 36000, currency: 'gbp', latest_charge: { amount_refunded: 0, disputed: true } });
        await expect(service.issue('order', { warrantyReference: 'QA-ONLY', coverStart: '2026-11-14', coverEnd: '2027-11-13', supplierPaidAndIssued: true }, 'admin')).rejects.toThrow('status changed');
        expect(row.status).toBe('PAYMENT_REVIEW'); expect(row.issuedAt).toBeUndefined();
    });
    it('blocks issuance while a refund is pending without claiming the refund completed', async () => {
        Object.assign(row, { status: 'PAID_AWAITING_ISSUE', paidAt: new Date(), stripePaymentIntentId: 'pi_qa' });
        stripe.refunds.list.mockResolvedValue({ data: [{ status: 'pending', amount: 36000 }] });
        await expect(service.issue('order', { warrantyReference: 'QA-ONLY', coverStart: '2026-11-14', coverEnd: '2027-11-13', supplierPaidAndIssued: true }, 'admin')).rejects.toThrow('status changed');
        expect(row.status).toBe('REFUND_PENDING');
    });
    it('records supplier reference and dates after confirmed paid issuance', async () => {
        Object.assign(row, { status: 'PAID_AWAITING_ISSUE', paidAt: new Date(), stripePaymentIntentId: 'pi_qa' });
        await service.issue('order', { warrantyReference: 'QA-ONLY', coverStart: '2026-11-14', coverEnd: '2027-11-13', supplierPaidAndIssued: true }, 'admin');
        expect(row.status).toBe('ISSUED'); expect(row.issuedBy).toBe('admin'); expect(row.warrantyReference).toBe('QA-ONLY');
    });
    it('never sends an issued order through the unissued-order refund button', async () => {
        Object.assign(row, { status: 'ISSUED', paidAt: new Date(), issuedAt: new Date(), stripePaymentIntentId: 'pi_qa' });
        await expect(service.refund('order', 'Synthetic cancellation', 'admin')).rejects.toThrow('Only a paid');
        expect(stripe.refunds.create).not.toHaveBeenCalled();
    });
    it('keeps uncertain refund requests pending and uses a stable retry key', async () => {
        Object.assign(row, { status: 'PAID_AWAITING_ISSUE', paidAt: new Date(), stripePaymentIntentId: 'pi_qa' });
        stripe.refunds.create.mockRejectedValue(new Error('Network timeout'));
        await expect(service.refund('order', 'Synthetic cancellation', 'admin')).rejects.toThrow('Network timeout');
        expect(row.status).toBe('REFUND_PENDING');
        await expect(service.refund('order', 'Another retry reason', 'admin')).rejects.toThrow();
        expect(stripe.refunds.create.mock.calls.map(c => c[1].idempotencyKey)).toEqual(['warranty-refund-order', 'warranty-refund-order']);
    });
    it('does not create another refund when an external Stripe refund is pending', async () => {
        Object.assign(row, { status: 'REFUND_PENDING', paidAt: new Date(), stripePaymentIntentId: 'pi_qa', refundRequestedBy: null });
        await expect(service.refund('order', 'Review external refund', 'admin')).rejects.toThrow('started directly in Stripe');
        expect(stripe.refunds.create).not.toHaveBeenCalled();
    });
});
