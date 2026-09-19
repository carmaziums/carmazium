import { BadRequestException, ConflictException } from '@nestjs/common';
import { ServiceJobStatus, ServicePaymentStatus } from '@prisma/client';
import { ServicesService } from './services.service';

describe('TradeXchange payment hardening', () => {
    let prisma: any;
    let stripe: any;
    let payments: any;
    let notifications: any;
    let email: any;
    let config: any;
    let service: ServicesService;

    beforeEach(() => {
        stripe = {
            checkout: {
                sessions: {
                    retrieve: jest.fn(),
                    create: jest.fn(),
                },
            },
            transfers: { create: jest.fn() },
            refunds: { create: jest.fn() },
        };
        payments = { getStripeClient: jest.fn().mockResolvedValue(stripe) };
        notifications = { create: jest.fn().mockResolvedValue({}) };
        email = { sendBrandedEmail: jest.fn().mockResolvedValue({ id: 'email' }) };
        config = {
            get: jest.fn((key: string) => {
                if (key === 'FRONTEND_URL') return 'https://www.carmazium.com';
                if (key === 'SERVICE_PLATFORM_FEE_RATE') return '0.40';
                return undefined;
            }),
        };
        prisma = {
            servicePayment: {
                findUnique: jest.fn(),
                update: jest.fn().mockResolvedValue({}),
                updateMany: jest.fn(),
            },
            serviceJob: {
                findUnique: jest.fn(),
                update: jest.fn().mockResolvedValue({}),
                updateMany: jest.fn(),
            },
            user: { findMany: jest.fn().mockResolvedValue([]) },
            contractorProfile: { findUnique: jest.fn() },
        };
        prisma.$transaction = jest.fn(async (work: any) =>
            typeof work === 'function' ? work(prisma) : Promise.all(work),
        );
        service = new ServicesService(prisma, notifications, email, payments, config);
    });

    it('uses the fixed 9% / 91% split even if an environment override is present', () => {
        expect((service as any).split(17_000)).toEqual({
            rate: 0.09,
            platformFeePence: 1_530,
            contractorPence: 15_470,
        });
    });

    it('reuses an existing open Checkout session instead of creating another', async () => {
        prisma.servicePayment.findUnique.mockResolvedValue({ stripeCheckoutSessionId: 'cs_open' });
        stripe.checkout.sessions.retrieve.mockResolvedValue({
            id: 'cs_open',
            status: 'open',
            payment_status: 'unpaid',
            url: 'https://checkout.stripe.test/cs_open',
        });

        const url = await (service as any).freshCheckout('job-1', 'pay-1', 17_000, 'Move BMW', 'customer-1');

        expect(url).toBe('https://checkout.stripe.test/cs_open');
        expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
        expect(prisma.servicePayment.update).not.toHaveBeenCalled();
    });

    it('fails closed when Stripe cannot verify an existing Checkout session', async () => {
        prisma.servicePayment.findUnique.mockResolvedValue({ stripeCheckoutSessionId: 'cs_unknown' });
        stripe.checkout.sessions.retrieve.mockRejectedValue(new Error('temporary Stripe timeout'));

        await expect(
            (service as any).freshCheckout('job-1', 'pay-1', 17_000, 'Move BMW', 'customer-1'),
        ).rejects.toThrow(BadRequestException);

        expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
        expect(prisma.servicePayment.update).not.toHaveBeenCalled();
    });

    it('creates a replacement Checkout session only after Stripe confirms the previous one is expired', async () => {
        prisma.servicePayment.findUnique.mockResolvedValue({ stripeCheckoutSessionId: 'cs_expired' });
        stripe.checkout.sessions.retrieve.mockResolvedValue({
            id: 'cs_expired',
            status: 'expired',
            payment_status: 'unpaid',
            url: null,
        });
        stripe.checkout.sessions.create.mockResolvedValue({
            id: 'cs_new',
            url: 'https://checkout.stripe.test/cs_new',
        });

        const url = await (service as any).freshCheckout('job-1', 'pay-1', 17_000, 'Move BMW', 'customer-1');

        expect(url).toBe('https://checkout.stripe.test/cs_new');
        expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
        expect(stripe.checkout.sessions.create.mock.calls[0][1]).toEqual({
            idempotencyKey: 'service-job-checkout-pay-1-cs_expired',
        });
        expect(prisma.servicePayment.update).toHaveBeenCalledWith({
            where: { id: 'pay-1' },
            data: { stripeCheckoutSessionId: 'cs_new', status: ServicePaymentStatus.PENDING },
        });
    });

    it('treats a previously completed paid Checkout session as paid rather than creating a replacement', async () => {
        prisma.servicePayment.findUnique.mockResolvedValue({ stripeCheckoutSessionId: 'cs_paid' });
        stripe.checkout.sessions.retrieve.mockResolvedValue({
            id: 'cs_paid',
            status: 'complete',
            payment_status: 'paid',
            payment_intent: 'pi_paid',
            url: null,
        });
        const markPaid = jest.spyOn(service, 'markPaid').mockResolvedValue(undefined);

        const url = await (service as any).freshCheckout('job-1', 'pay-1', 17_000, 'Move BMW', 'customer-1');

        expect(markPaid).toHaveBeenCalledWith('job-1', 'pay-1', 'pi_paid');
        expect(url).toBe('https://www.carmazium.com/services/jobs/job-1?paid=1');
        expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('ignores a repeated paid webhook transition', async () => {
        prisma.servicePayment.findUnique.mockResolvedValue({
            id: 'pay-1',
            jobId: 'job-1',
            status: ServicePaymentStatus.PAID,
            job: { status: ServiceJobStatus.PAID },
        });

        await service.markPaid('job-1', 'pay-1', 'pi_repeat');

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.serviceJob.update).not.toHaveBeenCalled();
    });

    it('allows only one concurrent release to claim the same held payment', async () => {
        const job = releasableJob(ServiceJobStatus.COMPLETED);
        prisma.serviceJob.findUnique.mockResolvedValue(job);

        let claim: string | null = null;
        prisma.servicePayment.updateMany.mockImplementation(async ({ data, where }: any) => {
            if (typeof data.stripeTransferId === 'string' && data.stripeTransferId.startsWith('claim:release:')) {
                if (claim) return { count: 0 };
                claim = data.stripeTransferId;
                return { count: 1 };
            }
            if (data.status === ServicePaymentStatus.RELEASED && where.stripeTransferId === claim) {
                return { count: 1 };
            }
            return { count: 0 };
        });
        prisma.serviceJob.updateMany.mockResolvedValue({ count: 1 });

        let finishTransfer!: (value: { id: string }) => void;
        stripe.transfers.create.mockImplementation(() => new Promise((resolve) => { finishTransfer = resolve; }));

        const first = (service as any).release('job-1', 'customer confirmed');
        await Promise.resolve();
        await Promise.resolve();
        const second = (service as any).release('job-1', 'customer confirmed');

        await expect(second).rejects.toThrow(ConflictException);
        expect(stripe.transfers.create).toHaveBeenCalledTimes(1);

        finishTransfer({ id: 'tr_once' });
        await expect(first).resolves.toEqual({ success: true, transferId: 'tr_once' });
    });

    it('prevents a refund from starting after a provider release has claimed the payment', async () => {
        const job = releasableJob(ServiceJobStatus.DISPUTED);
        prisma.serviceJob.findUnique.mockResolvedValue(job);

        let claim: string | null = null;
        prisma.servicePayment.updateMany.mockImplementation(async ({ data, where }: any) => {
            if (typeof data.stripeTransferId === 'string' && data.stripeTransferId.startsWith('claim:')) {
                if (claim) return { count: 0 };
                claim = data.stripeTransferId;
                return { count: 1 };
            }
            if (data.status === ServicePaymentStatus.RELEASED && where.stripeTransferId === claim) {
                return { count: 1 };
            }
            return { count: 0 };
        });
        prisma.serviceJob.updateMany.mockResolvedValue({ count: 1 });

        let finishTransfer!: (value: { id: string }) => void;
        stripe.transfers.create.mockImplementation(() => new Promise((resolve) => { finishTransfer = resolve; }));

        const release = (service as any).release('job-1', 'admin resolution');
        await Promise.resolve();
        await Promise.resolve();

        await expect(
            service.adminResolveDispute('admin-1', 'job-1', { outcome: 'REFUND', note: 'Customer refund' } as any),
        ).rejects.toThrow(ConflictException);
        expect(stripe.refunds.create).not.toHaveBeenCalled();

        finishTransfer({ id: 'tr_release' });
        await expect(release).resolves.toEqual({ success: true, transferId: 'tr_release' });
    });

    function releasableJob(status: ServiceJobStatus) {
        const startedAt = new Date(Date.now() - 2 * 60_000);
        const completedAt = new Date(Date.now() - 60_000);
        return {
            id: 'job-1',
            title: 'Move BMW',
            customerId: 'customer-1',
            contractorId: 'contractor-1',
            status,
            startedAt,
            completedAt,
            confirmedAt: null,
            payment: {
                id: 'pay-1',
                jobId: 'job-1',
                status: ServicePaymentStatus.PAID,
                contractorPence: 15_470,
                stripePaymentIntentId: 'pi_1',
                stripeTransferId: null,
            },
            contractor: {
                id: 'contractor-1',
                user: {
                    id: 'provider-owner-1',
                    email: 'provider@example.com',
                    firstName: 'Provider',
                    stripeConnectAccountId: 'acct_business',
                },
            },
            customer: {
                id: 'customer-1',
                email: 'customer@example.com',
                firstName: 'Customer',
            },
        };
    }
});
