import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
    CapabilityStatus,
    ServiceJobStatus,
    ServicePaymentStatus,
    ServiceQuoteStatus,
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

    const openDeliveryJob = (): any => ({
        id: 'job-1',
        customerId: 'customer-1',
        contractorId: null,
        acceptedQuoteId: null,
        serviceType: ServiceType.DELIVERY,
        status: ServiceJobStatus.OPEN,
        title: 'Move vehicle',
        expiresAt: new Date(Date.now() + 3_600_000),
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

    const acceptedPendingJob = (): any => ({
        ...openDeliveryJob(),
        contractorId: 'contractor-1',
        acceptedQuoteId: 'quote-1',
        status: ServiceJobStatus.ACCEPTED,
        contractor: {
            id: 'contractor-1',
            businessName: 'Provider Ltd',
            phone: '07111111111',
            rating: 4.8,
            totalReviews: 12,
            serviceArea: 'West Midlands',
            user: {
                firstName: 'Pat',
                lastName: 'Provider',
                email: 'provider@example.com',
                phone: '07222222222',
            },
        },
        quotes: [{
            id: 'quote-1',
            jobId: 'job-1',
            contractorId: 'contractor-1',
            status: ServiceQuoteStatus.ACCEPTED,
            amountPence: 10000,
            contractor: {
                id: 'contractor-1',
                businessName: 'Provider Ltd',
                rating: 4.8,
                totalReviews: 12,
                serviceArea: 'West Midlands',
                user: { firstName: 'Pat' },
            },
        }],
        payment: {
            id: 'payment-1',
            status: ServicePaymentStatus.PENDING,
            grossPence: 10000,
            contractorPence: 9100,
        },
    });

    beforeEach(() => {
        stripe = {
            refunds: { create: jest.fn() },
            transfers: { create: jest.fn() },
            checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
        };

        prisma = {
            serviceJob: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn().mockResolvedValue(0),
                create: jest.fn(),
                update: jest.fn().mockResolvedValue({}),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            serviceQuote: {
                findMany: jest.fn().mockResolvedValue([]),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            servicePayment: {
                findUnique: jest.fn(),
                create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
                update: jest.fn().mockResolvedValue({}),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            contractorCapability: {
                count: jest.fn().mockResolvedValue(1),
                findUnique: jest.fn().mockResolvedValue({
                    status: CapabilityStatus.APPROVED,
                    verificationStatus: 'VERIFIED',
                    verificationExpiresAt: new Date(Date.now() + 86_400_000),
                    jobNationwide: true,
                    jobPostcodeAreas: [],
                }),
                findFirst: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                update: jest.fn(),
            },
            listing: {
                findMany: jest.fn().mockResolvedValue([]),
            },
            contractorProfile: {
                findUnique: jest.fn().mockResolvedValue({
                    user: { stripeConnectAccountId: 'acct_1' },
                }),
            },
            user: {
                findMany: jest.fn().mockResolvedValue([]),
            },
            $transaction: jest.fn(async (work: any) => typeof work === 'function' ? work(prisma) : Promise.all(work)),
            $queryRaw: jest.fn().mockResolvedValue([]),
            $executeRaw: jest.fn().mockResolvedValue(1),
        };

        notifications = {
            create: jest.fn().mockResolvedValue({}),
        };
        email = {
            sendBrandedEmail: jest.fn().mockResolvedValue({}),
        };
        payments = {
            getStripeClient: jest.fn().mockResolvedValue(stripe),
            refreshConnectAccountReadiness: jest.fn().mockResolvedValue({ ready: true, accountId: 'acct_1' }),
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
                select: {
                    status: true,
                    verificationStatus: true,
                    verificationExpiresAt: true,
                    jobNationwide: true,
                    jobPostcodeAreas: true,
                },
            });
        });

        it('rejects an approved provider when an OPEN job is outside the configured postcode coverage', async () => {
            prisma.serviceJob.findUnique.mockResolvedValue(openDeliveryJob());
            prisma.contractorCapability.findUnique.mockResolvedValue({
                status: CapabilityStatus.APPROVED,
                verificationStatus: 'VERIFIED',
                verificationExpiresAt: new Date(Date.now() + 86_400_000),
                jobNationwide: false,
                jobPostcodeAreas: ['M'],
            });

            await expect(service.getJob({
                userId: 'provider-user',
                role: UserRole.CONTRACTOR,
                contractorProfileId: 'contractor-1',
            }, 'job-1')).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('rejects an APPROVED capability whose verification is expired', async () => {
            prisma.serviceJob.findUnique.mockResolvedValue(openDeliveryJob());
            prisma.contractorCapability.findUnique.mockResolvedValue({
                status: CapabilityStatus.APPROVED,
                verificationStatus: 'VERIFIED',
                verificationExpiresAt: new Date(Date.now() - 1_000),
                jobNationwide: true,
                jobPostcodeAreas: [],
            });

            await expect(service.getJob({
                userId: 'provider-user',
                role: UserRole.CONTRACTOR,
                contractorProfileId: 'contractor-1',
            }, 'job-1')).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('allows direct OPEN-job access only with a currently verified APPROVED capability', async () => {
            prisma.serviceJob.findUnique.mockResolvedValue(openDeliveryJob());
            prisma.contractorCapability.findUnique.mockResolvedValue({
                status: CapabilityStatus.APPROVED,
                verificationStatus: 'VERIFIED',
                verificationExpiresAt: new Date(Date.now() + 86_400_000),
                jobNationwide: true,
                jobPostcodeAreas: [],
            });

            const result = await service.getJob({
                userId: 'provider-user',
                role: UserRole.CONTRACTOR,
                contractorProfileId: 'contractor-1',
            }, 'job-1');

            expect(result.viewerRole).toBe('bidder');
            expect(result.customer).toEqual({ id: 'customer-1', firstName: 'Customer' });
        });
    });

    describe('contact unlock', () => {
        it('keeps both sides private after quote acceptance while payment is still pending', async () => {
            const pending = acceptedPendingJob();
            prisma.serviceJob.findUnique.mockResolvedValue(pending);

            const providerView = await service.getJob({
                userId: 'provider-user',
                role: UserRole.CONTRACTOR,
                contractorProfileId: 'contractor-1',
            }, 'job-1');
            expect(providerView.customer).toEqual({ id: 'customer-1', firstName: 'Customer' });
            expect(providerView.pickupAddress).toBeNull();
            expect(providerView.deliveryAddress).toBeNull();

            const customerView = await service.getJob({
                userId: 'customer-1',
                role: UserRole.BUYER,
            }, 'job-1');
            expect(customerView.contractor).toEqual({
                id: 'contractor-1',
                businessName: 'Provider Ltd',
                rating: 4.8,
                totalReviews: 12,
                serviceArea: 'West Midlands',
                user: { firstName: 'Pat' },
            });
            expect((customerView.contractor as any).phone).toBeUndefined();
            expect((customerView.contractor as any).user.email).toBeUndefined();
        });

        it('unlocks customer and provider contact details only after payment is recorded', async () => {
            const paid = acceptedPendingJob();
            paid.status = ServiceJobStatus.PAID;
            paid.payment.status = ServicePaymentStatus.PAID;
            prisma.serviceJob.findUnique.mockResolvedValue(paid);

            const providerView = await service.getJob({
                userId: 'provider-user',
                role: UserRole.CONTRACTOR,
                contractorProfileId: 'contractor-1',
            }, 'job-1');
            expect(providerView.customer.email).toBe('customer@example.com');
            expect(providerView.pickupAddress).toBe('1 Pickup Road');

            const customerView = await service.getJob({
                userId: 'customer-1',
                role: UserRole.BUYER,
            }, 'job-1');
            expect(customerView.contractor.phone).toBe('07111111111');
            expect(customerView.contractor.user.email).toBe('provider@example.com');
        });
    });

    describe('Block 8 customer posting controls', () => {
        it('rejects a new paid-service job when the customer already has ten active jobs', async () => {
            prisma.serviceJob.count.mockResolvedValue(10);

            await expect(service.createJob('customer-1', {
                serviceType: ServiceType.DELIVERY,
                title: 'Move another vehicle',
                pickupPostcode: 'B1 1AA',
                deliveryPostcode: 'B2 2BB',
                vehicles: [{ registration: 'AB12 CDE' }],
            } as any)).rejects.toBeInstanceOf(BadRequestException);

            expect(prisma.serviceJob.create).not.toHaveBeenCalled();
        });

        it('rejects a malformed UK postcode before creating a paid-service job', async () => {
            await expect(service.createJob('customer-1', {
                serviceType: ServiceType.DELIVERY,
                title: 'Move vehicle',
                pickupPostcode: 'ZZ99 9ZZ',
                deliveryPostcode: 'B2 2BB',
                vehicles: [{ registration: 'AB12 CDE' }],
            } as any)).rejects.toBeInstanceOf(BadRequestException);

            expect(prisma.serviceJob.create).not.toHaveBeenCalled();
        });

        it('rejects a requested service date in the past', async () => {
            await expect(service.createJob('customer-1', {
                serviceType: ServiceType.INSPECTION,
                title: 'Inspect vehicle',
                servicePostcode: 'B1 1AA',
                requestedFor: new Date(Date.now() - 3_600_000).toISOString(),
                vehicles: [{ registration: 'AB12 CDE' }],
            } as any)).rejects.toBeInstanceOf(BadRequestException);

            expect(prisma.serviceJob.create).not.toHaveBeenCalled();
        });
    });

    describe('Block 8 provider matching and linked-listing controls', () => {
        it('filters the open provider feed to configured service/postcode coverage and paginates', async () => {
            prisma.contractorCapability.findMany.mockResolvedValue([{
                serviceType: ServiceType.DELIVERY,
                jobNationwide: false,
                jobPostcodeAreas: ['B'],
            }]);
            prisma.serviceJob.findMany.mockResolvedValue([
                {
                    ...openDeliveryJob(),
                    id: 'job-2',
                    workPostcodeArea: 'B',
                    createdAt: new Date('2026-09-19T12:00:00Z'),
                    isRecovery: false,
                    quotes: [],
                    _count: { quotes: 0 },
                },
                {
                    ...openDeliveryJob(),
                    id: 'job-1',
                    workPostcodeArea: 'B',
                    createdAt: new Date('2026-09-19T11:00:00Z'),
                    isRecovery: false,
                    quotes: [],
                    _count: { quotes: 0 },
                },
            ]);

            const page = await service.feedPage(
                'contractor-1',
                [ServiceType.DELIVERY],
                ServiceType.DELIVERY,
                { limit: 1 },
            );

            expect(prisma.contractorCapability.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    contractorId: 'contractor-1',
                    serviceType: { in: [ServiceType.DELIVERY] },
                    status: CapabilityStatus.APPROVED,
                    verificationStatus: 'VERIFIED',
                    verificationExpiresAt: { gt: expect.any(Date) },
                }),
            }));
            expect(prisma.serviceJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    status: ServiceJobStatus.OPEN,
                    AND: expect.arrayContaining([
                        expect.objectContaining({
                            OR: [expect.objectContaining({
                                serviceType: ServiceType.DELIVERY,
                                workPostcodeArea: { in: ['B'] },
                            })],
                        }),
                    ]),
                }),
                take: 2,
            }));
            expect(page.items).toHaveLength(1);
            expect(page.nextCursor).toEqual(expect.any(String));
        });

        it('returns no open jobs when the approved capability has no configured paid-job coverage', async () => {
            prisma.contractorCapability.findMany.mockResolvedValue([{
                serviceType: ServiceType.DELIVERY,
                jobNationwide: false,
                jobPostcodeAreas: [],
            }]);

            await expect(service.feedPage(
                'contractor-1',
                [ServiceType.DELIVERY],
                undefined,
                { limit: 20 },
            )).resolves.toEqual({ items: [], nextCursor: null });

            expect(prisma.serviceJob.findMany).not.toHaveBeenCalled();
        });

        it('rejects manual Delivery linkage to a listing unrelated to the customer', async () => {
            prisma.listing.findMany.mockResolvedValue([{
                id: 'listing-1',
                sellerId: 'someone-else',
                status: 'ACTIVE',
                deletedAt: null,
                vrm: 'AB12CDE',
                make: 'BMW',
                model: '320d',
                year: 2020,
                vehicle: null,
                sale: null,
                auction: null,
                offers: [],
            }]);

            await expect(service.createJob('customer-1', {
                serviceType: ServiceType.DELIVERY,
                title: 'Move listed vehicle',
                pickupPostcode: 'B1 1AA',
                deliveryPostcode: 'B2 2BB',
                vehicles: [{ listingId: 'listing-1' }],
            } as any)).rejects.toBeInstanceOf(ForbiddenException);

            expect(prisma.serviceJob.create).not.toHaveBeenCalled();
        });

        it('allows an Inspection to reference an active public listing not owned by the requester', async () => {
            prisma.listing.findMany.mockResolvedValue([{
                id: 'listing-1',
                sellerId: 'someone-else',
                status: 'ACTIVE',
                deletedAt: null,
                vrm: 'AB12CDE',
                make: 'BMW',
                model: '320d',
                year: 2020,
                vehicle: null,
                sale: null,
                auction: null,
                offers: [],
            }]);
            prisma.serviceJob.create.mockResolvedValue({
                id: 'job-inspect',
                serviceType: ServiceType.INSPECTION,
                status: ServiceJobStatus.OPEN,
                workPostcodeArea: 'B',
                vehicles: [{ listingId: 'listing-1' }],
            });

            const result = await service.createJob('customer-1', {
                serviceType: ServiceType.INSPECTION,
                title: 'Inspect listed vehicle',
                servicePostcode: 'B1 1AA',
                vehicles: [{ listingId: 'listing-1' }],
            } as any);

            expect(result.id).toBe('job-inspect');
            expect(prisma.serviceJob.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    workPostcodeArea: 'B',
                    vehicles: {
                        create: [expect.objectContaining({ listingId: 'listing-1' })],
                    },
                }),
            }));
        });

        it('requires paid-job postcode coverage before an admin can approve Delivery', async () => {
            prisma.contractorCapability.findUnique.mockResolvedValue({
                id: 'cap-1',
                serviceType: ServiceType.DELIVERY,
                status: CapabilityStatus.PENDING,
                jobNationwide: false,
                jobPostcodeAreas: [],
                contractor: {
                    user: {
                        id: 'provider-user',
                        email: 'provider@example.com',
                        firstName: 'Provider',
                        stripeConnectAccountId: 'acct_1',
                        stripeConnectOnboardingComplete: true,
                    },
                },
            });

            await expect(service.adminReviewCapability('admin-1', 'cap-1', {
                status: CapabilityStatus.APPROVED,
            } as any)).rejects.toBeInstanceOf(BadRequestException);
        });
    });

    describe('atomic customer lifecycle transitions', () => {
        it('refuses an expired OPEN job before accepting a quote', async () => {
            const job = openDeliveryJob();
            job.expiresAt = new Date(Date.now() - 1000);
            job.quotes = [{
                id: 'quote-1',
                contractorId: 'contractor-1',
                status: ServiceQuoteStatus.ACTIVE,
                amountPence: 10000,
                validUntil: null,
            } as any];
            prisma.serviceJob.findUnique.mockResolvedValue(job);

            await expect(service.acceptQuote('customer-1', 'job-1', 'quote-1'))
                .rejects.toThrow(/expired/i);
            expect(prisma.$transaction).not.toHaveBeenCalled();
            expect(prisma.servicePayment.create).not.toHaveBeenCalled();
        });

        it('refuses an otherwise-active quote when the provider verification has expired', async () => {
            const job = openDeliveryJob();
            job.quotes = [{
                id: 'quote-1',
                jobId: 'job-1',
                contractorId: 'contractor-1',
                status: ServiceQuoteStatus.ACTIVE,
                amountPence: 10000,
                validUntil: null,
            } as any];
            prisma.serviceJob.findUnique.mockResolvedValue(job);
            prisma.contractorCapability.findUnique.mockResolvedValue({
                status: CapabilityStatus.APPROVED,
                verificationStatus: 'VERIFIED',
                verificationExpiresAt: new Date(Date.now() - 1_000),
                jobNationwide: true,
                jobPostcodeAreas: [],
            });

            await expect(service.acceptQuote('customer-1', 'job-1', 'quote-1'))
                .rejects.toThrow(/no longer verified/i);
            expect(prisma.$transaction).not.toHaveBeenCalled();
            expect(prisma.servicePayment.create).not.toHaveBeenCalled();
        });

        it('does not create a payment when another transition wins the acceptance claim', async () => {
            const job = openDeliveryJob();
            job.quotes = [{
                id: 'quote-1',
                jobId: 'job-1',
                contractorId: 'contractor-1',
                status: ServiceQuoteStatus.ACTIVE,
                amountPence: 10000,
                validUntil: null,
            } as any];
            prisma.serviceJob.findUnique.mockResolvedValue(job);
            prisma.serviceJob.updateMany.mockResolvedValueOnce({ count: 0 });

            await expect(service.acceptQuote('customer-1', 'job-1', 'quote-1'))
                .rejects.toBeInstanceOf(ConflictException);
            expect(prisma.servicePayment.create).not.toHaveBeenCalled();
        });

        it('does not expire quotes when cancellation loses a state race', async () => {
            prisma.serviceJob.findUnique.mockResolvedValue(openDeliveryJob());
            prisma.serviceQuote.findMany.mockResolvedValue([{ contractor: { user: { id: 'provider-user' } } }]);
            prisma.serviceJob.updateMany.mockResolvedValueOnce({ count: 0 });

            await expect(service.cancelJob('customer-1', 'job-1', { reason: 'Changed plans' } as any))
                .rejects.toBeInstanceOf(ConflictException);
            expect(prisma.serviceQuote.updateMany).not.toHaveBeenCalled();
            expect(notifications.create).not.toHaveBeenCalled();
        });

        it('does not overwrite a job that stopped being OPEN while the expiry worker was running', async () => {
            prisma.serviceJob.findMany.mockResolvedValue([{
                id: 'job-1',
                title: 'Move vehicle',
                customerId: 'customer-1',
            }]);
            prisma.serviceJob.updateMany.mockResolvedValueOnce({ count: 0 });

            const expired = await service.expireOpenJobs();

            expect(expired).toBe(0);
            expect(prisma.serviceQuote.updateMany).not.toHaveBeenCalled();
            expect(notifications.create).not.toHaveBeenCalled();
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
            expect(prisma.servicePayment.updateMany).not.toHaveBeenCalled();
            expect(prisma.serviceJob.updateMany).not.toHaveBeenCalled();
        });

        it('atomically transitions only a PENDING payment whose job is ACCEPTED', async () => {
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
            expect(prisma.servicePayment.updateMany).toHaveBeenCalledWith({
                where: {
                    id: 'payment-1',
                    jobId: 'job-1',
                    status: ServicePaymentStatus.PENDING,
                    job: { is: { status: ServiceJobStatus.ACCEPTED } },
                },
                data: expect.objectContaining({
                    status: ServicePaymentStatus.PAID,
                    stripePaymentIntentId: 'pi_1',
                }),
            });
            expect(prisma.serviceJob.updateMany).toHaveBeenCalledWith({
                where: { id: 'job-1', status: ServiceJobStatus.ACCEPTED },
                data: {
                    status: ServiceJobStatus.PAID,
                    startedAt: null,
                    completedAt: null,
                    confirmedAt: null,
                },
            });
        });

        it('does not emit duplicate paid notifications when another webhook already claimed the payment', async () => {
            prisma.servicePayment.findUnique.mockResolvedValue({
                id: 'payment-1',
                jobId: 'job-1',
                status: ServicePaymentStatus.PENDING,
                grossPence: 10000,
                contractorPence: 9100,
                job: { status: ServiceJobStatus.ACCEPTED },
            });
            prisma.servicePayment.updateMany.mockResolvedValueOnce({ count: 0 });

            await service.markPaid('job-1', 'payment-1', 'pi_1');

            expect(prisma.serviceJob.updateMany).not.toHaveBeenCalled();
            expect(notifications.create).not.toHaveBeenCalled();
            expect(prisma.serviceJob.findUnique).not.toHaveBeenCalled();
        });
    });

    describe('Block 9 verified service reviews', () => {
        it('rejects a review until both the job and payment are released', async () => {
            prisma.serviceJob.findUnique.mockResolvedValue({
                id: 'job-1',
                customerId: 'customer-1',
                contractorId: 'contractor-1',
                status: ServiceJobStatus.COMPLETED,
                payment: { status: ServicePaymentStatus.RELEASED },
            });

            await expect(service.createServiceReview('customer-1', 'job-1', {
                rating: 5,
                comment: 'Great service',
            } as any)).rejects.toBeInstanceOf(BadRequestException);

            expect(prisma.$queryRaw).not.toHaveBeenCalled();
        });

        it('creates exactly one verified review for the booking customer', async () => {
            prisma.serviceJob.findUnique.mockResolvedValue({
                id: 'job-1',
                customerId: 'customer-1',
                contractorId: 'contractor-1',
                status: ServiceJobStatus.RELEASED,
                payment: { status: ServicePaymentStatus.RELEASED },
            });
            prisma.$queryRaw
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{
                    id: 'review-1',
                    jobId: 'job-1',
                    customerId: 'customer-1',
                    contractorId: 'contractor-1',
                    rating: 5,
                    comment: 'Great service',
                }]);

            const result = await service.createServiceReview('customer-1', 'job-1', {
                rating: 5,
                comment: ' Great service ',
            } as any);

            expect(result).toEqual(expect.objectContaining({
                id: 'review-1',
                rating: 5,
                comment: 'Great service',
            }));
            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('prevents a second review for the same released job', async () => {
            prisma.serviceJob.findUnique.mockResolvedValue({
                id: 'job-1',
                customerId: 'customer-1',
                contractorId: 'contractor-1',
                status: ServiceJobStatus.RELEASED,
                payment: { status: ServicePaymentStatus.RELEASED },
            });
            prisma.$queryRaw.mockResolvedValueOnce([{ id: 'review-1' }]);

            await expect(service.createServiceReview('customer-1', 'job-1', {
                rating: 4,
            } as any)).rejects.toBeInstanceOf(ConflictException);
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
                stripeTransferId: null,
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
            status: ServiceJobStatus.COMPLETED,
            startedAt: new Date(Date.now() - 2 * 60_000),
            completedAt: new Date(Date.now() - 60_000),
            confirmedAt: null,
            payment: {
                id: 'payment-1',
                status: ServicePaymentStatus.PAID,
                contractorPence: 9100,
                stripeTransferId: null,
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