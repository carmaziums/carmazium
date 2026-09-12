import { ForbiddenException } from '@nestjs/common';
import {
    CapabilityStatus,
    ServiceJobStatus,
    ServicePaymentStatus,
    ServiceType,
    UserRole,
} from '@prisma/client';
import { ServicesService } from './services.service';

describe('ServicesService TradeXchange hardening regressions', () => {
    let prisma: any;
    let notifications: any;
    let email: any;
    let payments: any;
    let config: any;
    let stripe: any;
    let service: ServicesService;

    const openDeliveryJob = () => ({
        id: 'job-1',
        customerId: 'customer-1',
        contractorId: null,
        serviceType: ServiceType.DELIVERY,
        status: ServiceJobStatus.OPEN,
        title: 'Move vehicle',
        pickupPostcode: 'B1 1AA',
        pickupAddress: '1 Pickup Road',
        deliveryPostcode: 'B2 2BB',
        deliveryAddress: '2 Delivery Road',
        servicePostcode: null,
        serviceAddress: null,
        customer: {
            id: 'customer-1',
            firstName: 'Customer',
            lastName: 'One',
            email: 'customer@example.com',
            phone: '07000000000',
        },
        contractor: null,
        quotes: [],
        vehicles: [],
        payment: null,
    });

    beforeEach(() => {
        stripe = {
            refunds: { create: jest.fn() },
            transfers: { create: jest.fn() },
            checkout: { sessions: { create: jest.fn() } },
        };

        prisma = {
            serviceJob: {
                findUnique: jest.fn(),
                update: jest.fn().mockResolvedValue({}),
            },
            servicePayment: {
                findUnique: jest.fn(),
                update: jest.fn().mockResolvedValue({}),
            },
            contractorCapability: {
                findUnique: jest.fn(),
            },
            contractorProfile: {
                findUnique: jest.fn(),
            },
            user: {
                findMany: jest.fn().mockResolvedValue([]),
            },
            $transaction: jest.fn().mockResolvedValue([]),
        };

        notifications = {
            create: jest.fn().mockResolvedValue({}),
        };
        email = {
            sendBrandedEmail: jest.fn().mockResolvedValue({}),
        };
        payments = {
            getStripeClient: jest.fn().mockResolvedValue(stripe),
            issueSellerPayout: jest.fn(),
        };
        config = {
            get: jest.fn((key: string) => {
                if (key === 'FRONTEND_URL') return 'https://carmazium.com';
                if (key === 'SERVICE_PLATFORM_FEE_RATE') return '0.09';
                return undefined;
            }),
        };

        service = new ServicesService(prisma, notifications, email, payments, config);
    });

    describe('direct OPEN-job access', () => {
        it('rejects a contractor whose matching capability is not APPROVED', async () => {
            prisma.serviceJob.findUnique.mockResolvedValue(openDeliveryJob());
            prisma.contractorCapability.findUnique.mockResolvedValue({ status: CapabilityStatus.PENDING });

            await expect(service.getJob({
                userId: 'provider-user',
                role: UserRole.CONTRACTOR,
                contractorProfileId: 'contractor-1',
            }, 'job-1')).rejects.toBeInstanceOf(ForbiddenException);

            expect(prisma.contractorCapability.findUnique).toHaveBeenCalledWith({
                where: {
                    contractorId_serviceType: {
                        contractorId: 'contractor-1',
                        serviceType: ServiceType.DELIVERY,
                    },
                },
                select: { status: true },
            });
        });

        it('allows direct OPEN-job access only with an APPROVED capability for that service type', async () => {
            prisma.serviceJob.findUnique.mockResolvedValue(openDeliveryJob());
            prisma.contractorCapability.findUnique.mockResolvedValue({ status: CapabilityStatus.APPROVED });

            const result = await service.getJob({
                userId: 'provider-user',
                role: UserRole.CONTRACTOR,
                contractorProfileId: 'contractor-1',
            }, 'job-1');

            expect(result.viewerRole).toBe('bidder');
            expect(result.customer).toEqual({ id: 'customer-1', firstName: 'Customer' });
        });
    });

    describe('markPaid state transition', () => {
        it.each([
            [ServicePaymentStatus.PENDING, ServiceJobStatus.OPEN],
            [ServicePaymentStatus.REFUNDED, ServiceJobStatus.ACCEPTED],
        ])('does not transition payment=%s with job=%s', async (paymentStatus, jobStatus) => {
            prisma.servicePayment.findUnique.mockResolvedValue({
                id: 'payment-1',
                jobId: 'job-1',
                status: paymentStatus,
                job: { status: jobStatus },
            });

            await service.markPaid('job-1', 'payment-1', 'pi_1');

            expect(prisma.$transaction).not.toHaveBeenCalled();
            expect(prisma.servicePayment.update).not.toHaveBeenCalled();
            expect(prisma.serviceJob.update).not.toHaveBeenCalled();
        });

        it('transitions only a PENDING payment whose job is ACCEPTED', async () => {
            prisma.servicePayment.findUnique.mockResolvedValue({
                id: 'payment-1',
                jobId: 'job-1',
                status: ServicePaymentStatus.PENDING,
                grossPence: 10000,
                contractorPence: 9100,
                job: { status: ServiceJobStatus.ACCEPTED },
            });
            prisma.serviceJob.findUnique.mockResolvedValue(null);

            await service.markPaid('job-1', 'payment-1', 'pi_1');

            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
            expect(prisma.servicePayment.update).toHaveBeenCalledWith({
                where: { id: 'payment-1' },
                data: expect.objectContaining({
                    status: ServicePaymentStatus.PAID,
                    stripePaymentIntentId: 'pi_1',
                }),
            });
            expect(prisma.serviceJob.update).toHaveBeenCalledWith({
                where: { id: 'job-1' },
                data: { status: ServiceJobStatus.PAID },
            });
        });
    });

    it('uses a deterministic Stripe idempotency key for service-job refunds', async () => {
        prisma.serviceJob.findUnique.mockResolvedValue({
            id: 'job-1',
            title: 'Move vehicle',
            status: ServiceJobStatus.DISPUTED,
            customerId: 'customer-1',
            contractorId: null,
            payment: {
                id: 'payment-1',
                status: ServicePaymentStatus.PAID,
                stripePaymentIntentId: 'pi_1',
            },
        });
        stripe.refunds.create.mockResolvedValue({ id: 're_1' });

        await service.adminResolveDispute('admin-1', 'job-1', { outcome: 'REFUND' } as any);

        expect(stripe.refunds.create).toHaveBeenCalledWith(
            { payment_intent: 'pi_1' },
            { idempotencyKey: 'service-job-refund-payment-1' },
        );
    });

    it('uses a deterministic Stripe transfer idempotency key for provider payout', async () => {
        prisma.serviceJob.findUnique.mockResolvedValue({
            id: 'job-1',
            title: 'Move vehicle',
            customerId: 'customer-1',
            confirmedAt: null,
            payment: {
                id: 'payment-1',
                status: ServicePaymentStatus.PAID,
                contractorPence: 9100,
            },
            contractor: {
                user: {
                    id: 'provider-user',
                    firstName: 'Provider',
                    email: 'provider@example.com',
                    stripeConnectAccountId: 'acct_1',
                },
            },
            customer: {
                id: 'customer-1',
                firstName: 'Customer',
                email: 'customer@example.com',
            },
        });
        stripe.transfers.create.mockResolvedValue({ id: 'tr_1' });

        const result = await (service as any).release('job-1', 'regression test');

        expect(stripe.transfers.create).toHaveBeenCalledWith(
            {
                amount: 9100,
                currency: 'gbp',
                destination: 'acct_1',
            },
            { idempotencyKey: 'service-job-release-payment-1' },
        );
        expect(payments.issueSellerPayout).not.toHaveBeenCalled();
        expect(result).toEqual({ success: true, transferId: 'tr_1' });
    });
});
