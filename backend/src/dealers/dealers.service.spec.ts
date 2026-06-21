// ─── Stripe mock (module-level, must be before all imports) ─────────────────
// We capture the mock constructor and the per-instance mock separately so
// each test can configure paymentIntents.retrieve responses independently.
const mockPaymentIntentsRetrieve = jest.fn();
const mockPaymentIntentsCreate = jest.fn();

jest.mock('stripe', () => {
    const MockStripe = jest.fn().mockImplementation(() => ({
        paymentIntents: {
            retrieve: mockPaymentIntentsRetrieve,
            create: mockPaymentIntentsCreate,
        },
    }));
    return { default: MockStripe };
});

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DealersService } from './dealers.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

// ─── createKycPaymentIntent ──────────────────────────────────────────────────

describe('DealersService — KYC: createKycPaymentIntent', () => {
    let service: DealersService;
    let prisma: any;

    beforeEach(async () => {
        // Reset stripe mocks between tests
        mockPaymentIntentsRetrieve.mockReset();
        mockPaymentIntentsCreate.mockReset();

        prisma = {
            dealerProfile: {
                findUnique: jest.fn(),
                upsert: jest.fn(),
                update: jest.fn(),
            },
            dealerKyc: {
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            user: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DealersService,
                { provide: PrismaService, useValue: prisma },
                {
                    provide: EmailService,
                    useValue: { sendKycSubmissionAdminAlert: jest.fn().mockResolvedValue(null) },
                },
                {
                    provide: NotificationsService,
                    useValue: { create: jest.fn().mockResolvedValue(null) },
                },
                {
                    provide: ConfigService,
                    useValue: { get: jest.fn().mockReturnValue('sk_test_mock') },
                },
            ],
        }).compile();

        service = module.get<DealersService>(DealersService);
    });

    // KYC-PAY-01: Already paid — returns alreadyPaid: true immediately
    it('KYC-PAY-01: returns { alreadyPaid: true, chargedAt } when stripeChargedAt is already set', async () => {
        const chargedAt = new Date('2026-06-01T12:00:00Z');

        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: {
                id: 'kyc-1',
                stripeChargedAt: chargedAt,
                stripePaymentIntentId: 'pi_already_paid',
            },
        });

        const result = await (service as any).createKycPaymentIntent('user-1');

        expect(result).toEqual({ alreadyPaid: true, chargedAt });
    });

    // KYC-PAY-02: Existing PI with requires_payment_method status — reuse it
    it('KYC-PAY-02: returns { clientSecret, alreadyPaid: false } when existing PI needs payment method', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: {
                id: 'kyc-1',
                stripeChargedAt: null,
                stripePaymentIntentId: 'pi_existing_123',
            },
        });

        mockPaymentIntentsRetrieve.mockResolvedValue({
            id: 'pi_existing_123',
            status: 'requires_payment_method',
            client_secret: 'pi_secret_xxx',
        });

        const result = await (service as any).createKycPaymentIntent('user-1');

        expect(result).toEqual({ clientSecret: 'pi_secret_xxx', alreadyPaid: false });
    });
});

// ─── submitKyc (Stripe verification path) ───────────────────────────────────

describe('DealersService — KYC: submitKyc Stripe verification', () => {
    let service: DealersService;
    let prisma: any;

    const baseDto = {
        companyHouseName: 'Test Motors Ltd',
        representativeName: 'John Doe',
        representativePosition: 'Director',
        vatNumber: 'GB123456789',
        companyRegistrationNumber: '12345678',
        personOfSignificantControl: 'John Doe',
        directorName: 'John Doe',
        businessWebsite: 'https://testmotors.co.uk',
        businessRegisteredAddress: '1 Test Street, London',
        paymentReference: 'REF-001',
        stripePaymentIntentId: 'pi_test_456',
    };

    beforeEach(async () => {
        // Reset stripe mocks between tests
        mockPaymentIntentsRetrieve.mockReset();
        mockPaymentIntentsCreate.mockReset();

        prisma = {
            dealerProfile: {
                findUnique: jest.fn(),
                upsert: jest.fn(),
                update: jest.fn(),
            },
            dealerKyc: {
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            user: {
                findUnique: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DealersService,
                { provide: PrismaService, useValue: prisma },
                {
                    provide: EmailService,
                    useValue: { sendKycSubmissionAdminAlert: jest.fn().mockResolvedValue(null) },
                },
                {
                    provide: NotificationsService,
                    useValue: { create: jest.fn().mockResolvedValue(null) },
                },
                {
                    provide: ConfigService,
                    useValue: { get: jest.fn().mockReturnValue('sk_test_mock') },
                },
            ],
        }).compile();

        service = module.get<DealersService>(DealersService);
    });

    // KYC-PAY-03: PI not succeeded — throws BadRequestException
    it('KYC-PAY-03: throws BadRequestException when Stripe PI status is not succeeded', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: null,
            user: { id: 'user-1', role: 'DEALER', firstName: 'John', lastName: 'Doe' },
        });

        mockPaymentIntentsRetrieve.mockResolvedValue({
            id: 'pi_test_456',
            status: 'requires_payment_method',
        });

        await expect(
            service.submitKyc('user-1', baseDto as any),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    // KYC-PAY-04: PI succeeded — saves stripePaymentIntentId to KYC record
    it('KYC-PAY-04: saves stripePaymentIntentId and stripeChargedAt when PI status is succeeded', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: null,
            user: { id: 'user-1', role: 'DEALER', firstName: 'John', lastName: 'Doe' },
        });

        mockPaymentIntentsRetrieve.mockResolvedValue({
            id: 'pi_test_456',
            status: 'succeeded',
        });

        prisma.dealerKyc.create.mockResolvedValue({
            id: 'kyc-new',
            stripePaymentIntentId: 'pi_test_456',
            stripeChargedAt: new Date(),
            documentStatuses: {},
        });

        prisma.dealerProfile.update.mockResolvedValue({});

        await service.submitKyc('user-1', baseDto as any);

        // Verify that prisma.dealerKyc.create was called with stripePaymentIntentId in data
        expect(prisma.dealerKyc.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    stripePaymentIntentId: 'pi_test_456',
                }),
            }),
        );
    });

    // KYC-PAY-05: PI succeeded — auto-approves paymentReference and paymentScreenshot fields
    it('KYC-PAY-05: auto-approves paymentReference and paymentScreenshot in documentStatuses when Stripe-verified', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: null,
            user: { id: 'user-1', role: 'DEALER', firstName: 'John', lastName: 'Doe' },
        });

        mockPaymentIntentsRetrieve.mockResolvedValue({
            id: 'pi_test_456',
            status: 'succeeded',
        });

        let capturedData: any;
        prisma.dealerKyc.create.mockImplementation(({ data }: any) => {
            capturedData = data;
            return Promise.resolve({ id: 'kyc-new', ...data });
        });

        prisma.dealerProfile.update.mockResolvedValue({});

        await service.submitKyc('user-1', baseDto as any);

        // Verify payment fields are auto-approved when Stripe-verified
        expect(capturedData.documentStatuses.paymentReference.status).toBe('APPROVED');
        expect(capturedData.documentStatuses.paymentScreenshot.status).toBe('APPROVED');
    });
});
