import { ServiceJobStatus, ServicePaymentStatus } from '@prisma/client';
import { ACCEPTED_PAYMENT_TIMEOUT_MINUTES, ServicesLifecycleService } from './services-lifecycle.service';

describe('ServicesLifecycleService TradeXchange unpaid acceptance timeout', () => {
    let prisma: any;
    let services: any;
    let payments: any;
    let notifications: any;
    let stripe: any;
    let lifecycle: ServicesLifecycleService;

    const candidate = () => ({
        id: 'payment-1',
        jobId: 'job-1',
        customerId: 'customer-1',
        contractorId: 'contractor-1',
        status: ServicePaymentStatus.PENDING,
        stripeCheckoutSessionId: 'cs_1',
        job: {
            id: 'job-1',
            title: 'Move BMW',
            status: ServiceJobStatus.ACCEPTED,
            acceptedAt: new Date(Date.now() - (ACCEPTED_PAYMENT_TIMEOUT_MINUTES + 5) * 60_000),
            expiresAt: new Date(Date.now() + 2 * 3_600_000),
            contractorId: 'contractor-1',
        },
    });

    beforeEach(() => {
        stripe = {
            checkout: {
                sessions: {
                    retrieve: jest.fn(),
                    expire: jest.fn().mockResolvedValue({ status: 'expired' }),
                },
            },
        };
        services = {
            markPaid: jest.fn().mockResolvedValue(undefined),
            expireOpenJobs: jest.fn().mockResolvedValue(0),
            autoConfirmCompleted: jest.fn().mockResolvedValue(0),
        };
        payments = { getStripeClient: jest.fn().mockResolvedValue(stripe) };
        notifications = { create: jest.fn().mockResolvedValue({}) };
        prisma = {
            servicePayment: {
                findMany: jest.fn(),
                delete: jest.fn().mockResolvedValue({}),
            },
            serviceJob: { update: jest.fn().mockResolvedValue({}) },
            serviceQuote: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            contractorProfile: {
                findUnique: jest.fn().mockResolvedValue({ userId: 'provider-user' }),
            },
            $transaction: jest.fn().mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops)),
        };
        lifecycle = new ServicesLifecycleService(services, prisma, payments, notifications);
    });

    it('expires an unpaid open Stripe session and safely reopens the job', async () => {
        prisma.servicePayment.findMany.mockResolvedValue([candidate()]);
        stripe.checkout.sessions.retrieve.mockResolvedValue({
            id: 'cs_1',
            status: 'open',
            payment_status: 'unpaid',
            payment_intent: null,
        });

        const reopened = await lifecycle.expireUnpaidAcceptedJobs();

        expect(reopened).toBe(1);
        expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_1');
        expect(prisma.serviceJob.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'job-1' },
            data: expect.objectContaining({
                status: ServiceJobStatus.OPEN,
                acceptedQuoteId: null,
                contractorId: null,
                acceptedAt: null,
            }),
        }));
        expect(prisma.serviceQuote.updateMany).toHaveBeenCalledTimes(2);
        expect(prisma.servicePayment.delete).toHaveBeenCalledWith({ where: { id: 'payment-1' } });
        expect(notifications.create).toHaveBeenCalledTimes(2);
    });

    it('finishes the paid transition instead of reopening when Stripe already received payment', async () => {
        prisma.servicePayment.findMany.mockResolvedValue([candidate()]);
        stripe.checkout.sessions.retrieve.mockResolvedValue({
            id: 'cs_1',
            status: 'complete',
            payment_status: 'paid',
            payment_intent: 'pi_1',
        });

        const reopened = await lifecycle.expireUnpaidAcceptedJobs();

        expect(reopened).toBe(0);
        expect(services.markPaid).toHaveBeenCalledWith('job-1', 'payment-1', 'pi_1');
        expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.servicePayment.delete).not.toHaveBeenCalled();
    });

    it('leaves the job locked when Stripe state cannot be confirmed', async () => {
        prisma.servicePayment.findMany.mockResolvedValue([candidate()]);
        stripe.checkout.sessions.retrieve.mockRejectedValue(new Error('temporary Stripe error'));

        const reopened = await lifecycle.expireUnpaidAcceptedJobs();

        expect(reopened).toBe(0);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.servicePayment.delete).not.toHaveBeenCalled();
    });
});
