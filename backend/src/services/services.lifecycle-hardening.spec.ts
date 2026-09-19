import { BadRequestException, ConflictException } from '@nestjs/common';
import { ServiceJobStatus, ServicePaymentStatus } from '@prisma/client';
import { ServicesService } from './services.service';

describe('TradeXchange paid-job lifecycle hardening', () => {
    let prisma: any;
    let stripe: any;
    let service: ServicesService;

    beforeEach(() => {
        stripe = {
            transfers: { create: jest.fn() },
            refunds: { create: jest.fn() },
            checkout: { sessions: { retrieve: jest.fn(), create: jest.fn() } },
        };
        prisma = {
            serviceJob: {
                findUnique: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                updateMany: jest.fn(),
            },
            servicePayment: {
                findUnique: jest.fn(),
                updateMany: jest.fn(),
                update: jest.fn(),
            },
            user: { findMany: jest.fn().mockResolvedValue([]) },
            contractorProfile: { findUnique: jest.fn() },
        };
        prisma.$transaction = jest.fn(async (work: any) =>
            typeof work === 'function' ? work(prisma) : Promise.all(work),
        );

        service = new ServicesService(
            prisma,
            { create: jest.fn().mockResolvedValue({}) } as any,
            { sendBrandedEmail: jest.fn().mockResolvedValue({}) } as any,
            { getStripeClient: jest.fn().mockResolvedValue(stripe) } as any,
            { get: jest.fn().mockReturnValue('https://www.carmazium.com') } as any,
        );
    });

    const customer = {
        id: 'customer-1',
        email: 'customer@example.com',
        firstName: 'Customer',
    };

    it('rejects PAID -> COMPLETED when the provider has not started the job', async () => {
        jest.spyOn(service as any, 'assignedJob').mockResolvedValue({
            id: 'job-1',
            contractorId: 'provider-1',
            customerId: customer.id,
            customer,
            title: 'Move BMW',
            status: ServiceJobStatus.PAID,
            startedAt: null,
            completedAt: null,
            confirmedAt: null,
        });

        await expect(service.completeJob('provider-1', 'job-1'))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.serviceJob.updateMany).not.toHaveBeenCalled();
    });

    it('starts only a clean PAID job and uses an atomic state claim', async () => {
        jest.spyOn(service as any, 'assignedJob').mockResolvedValue({
            id: 'job-1',
            contractorId: 'provider-1',
            customerId: customer.id,
            customer,
            title: 'Move BMW',
            status: ServiceJobStatus.PAID,
            startedAt: null,
            completedAt: null,
            confirmedAt: null,
        });
        prisma.serviceJob.updateMany.mockResolvedValue({ count: 1 });

        await expect(service.startJob('provider-1', 'job-1')).resolves.toEqual({ success: true });

        expect(prisma.serviceJob.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
                contractorId: 'provider-1',
                status: ServiceJobStatus.PAID,
                startedAt: null,
                completedAt: null,
                confirmedAt: null,
            },
            data: {
                status: ServiceJobStatus.IN_PROGRESS,
                startedAt: expect.any(Date),
            },
        });
    });

    it('fails closed if a concurrent start already claimed the PAID job', async () => {
        jest.spyOn(service as any, 'assignedJob').mockResolvedValue({
            id: 'job-1',
            contractorId: 'provider-1',
            customerId: customer.id,
            customer,
            title: 'Move BMW',
            status: ServiceJobStatus.PAID,
            startedAt: null,
            completedAt: null,
            confirmedAt: null,
        });
        prisma.serviceJob.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.startJob('provider-1', 'job-1'))
            .rejects.toBeInstanceOf(ConflictException);
    });

    it('completes only an IN_PROGRESS job with a genuine start timestamp', async () => {
        const startedAt = new Date(Date.now() - 60_000);
        jest.spyOn(service as any, 'assignedJob').mockResolvedValue({
            id: 'job-1',
            contractorId: 'provider-1',
            customerId: customer.id,
            customer,
            title: 'Move BMW',
            status: ServiceJobStatus.IN_PROGRESS,
            startedAt,
            completedAt: null,
            confirmedAt: null,
        });
        prisma.serviceJob.updateMany.mockResolvedValue({ count: 1 });

        await expect(service.completeJob('provider-1', 'job-1')).resolves.toEqual({ success: true });

        expect(prisma.serviceJob.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
                contractorId: 'provider-1',
                status: ServiceJobStatus.IN_PROGRESS,
                startedAt,
                completedAt: null,
                confirmedAt: null,
            },
            data: {
                status: ServiceJobStatus.COMPLETED,
                completedAt: expect.any(Date),
            },
        });
    });

    it('rejects malformed IN_PROGRESS jobs that have no start timestamp', async () => {
        jest.spyOn(service as any, 'assignedJob').mockResolvedValue({
            id: 'job-1',
            contractorId: 'provider-1',
            customerId: customer.id,
            customer,
            title: 'Move BMW',
            status: ServiceJobStatus.IN_PROGRESS,
            startedAt: null,
            completedAt: null,
            confirmedAt: null,
        });

        await expect(service.completeJob('provider-1', 'job-1'))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.serviceJob.updateMany).not.toHaveBeenCalled();
    });

    it('auto-release scans only genuinely started, completed, unconfirmed jobs', async () => {
        prisma.serviceJob.findMany.mockResolvedValue([]);

        await expect(service.autoConfirmCompleted()).resolves.toBe(0);

        expect(prisma.serviceJob.findMany).toHaveBeenCalledWith({
            where: {
                status: ServiceJobStatus.COMPLETED,
                startedAt: { not: null },
                completedAt: { lt: expect.any(Date) },
                confirmedAt: null,
            },
            select: { id: true },
        });
    });

    it('blocks customer confirmation when a COMPLETED row lacks a valid lifecycle', async () => {
        jest.spyOn(service as any, 'ownJob').mockResolvedValue({
            id: 'job-1',
            customerId: customer.id,
            status: ServiceJobStatus.COMPLETED,
            startedAt: null,
            completedAt: new Date(),
        });
        const release = jest.spyOn(service as any, 'release');

        await expect(service.confirmCompletion(customer.id, 'job-1'))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(release).not.toHaveBeenCalled();
    });

    it('blocks payout before Stripe if a COMPLETED row has invalid lifecycle timestamps', async () => {
        prisma.serviceJob.findUnique.mockResolvedValue({
            id: 'job-1',
            title: 'Move BMW',
            customerId: customer.id,
            contractorId: 'provider-1',
            status: ServiceJobStatus.COMPLETED,
            startedAt: null,
            completedAt: new Date(),
            confirmedAt: null,
            payment: {
                id: 'pay-1',
                status: ServicePaymentStatus.PAID,
                contractorPence: 9_100,
                stripeTransferId: null,
            },
            contractor: {
                user: {
                    id: 'provider-owner',
                    email: 'provider@example.com',
                    firstName: 'Provider',
                    stripeConnectAccountId: 'acct_provider',
                },
            },
            customer,
        });

        await expect((service as any).release('job-1', 'customer confirmed'))
            .rejects.toBeInstanceOf(ConflictException);
        expect(stripe.transfers.create).not.toHaveBeenCalled();
        expect(prisma.servicePayment.updateMany).not.toHaveBeenCalled();
    });
});
