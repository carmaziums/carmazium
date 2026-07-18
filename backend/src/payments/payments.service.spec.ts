// ─── Stripe mock (module-level, must be before all imports) ─────────────────
const mockPaymentIntentsCreate = jest.fn();
const mockCustomersCreate = jest.fn();
const mockEphemeralKeysCreate = jest.fn();
const mockConstructEvent = jest.fn();
const mockCheckoutSessionsCreate = jest.fn();

jest.mock('stripe', () => {
    const MockStripe = jest.fn().mockImplementation(() => ({
        paymentIntents: { create: mockPaymentIntentsCreate },
        customers: { create: mockCustomersCreate },
        ephemeralKeys: { create: mockEphemeralKeysCreate },
        webhooks: { constructEvent: mockConstructEvent },
        checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    }));
    // `payments.service.ts` loads Stripe via a dynamic `await import('stripe')`
    // (unlike dealers.service.ts's static import) — __esModule: true is required
    // here so TS's dynamic-import interop unwraps `.default` to MockStripe itself
    // instead of double-wrapping it.
    return { __esModule: true, default: MockStripe };
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { HpiService } from '../hpi/hpi.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { EmailService } from '../email/email.service';

function buildPrismaMock() {
    return {
        listing: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        user: {
            findUnique: jest.fn().mockResolvedValue({ id: 'user-1', email: 'buyer@example.com', stripeCustomerId: 'cus_existing' }),
            update: jest.fn(),
        },
        transaction: {
            create: jest.fn().mockResolvedValue({ id: 'txn-1' }),
            update: jest.fn(),
        },
        sale: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
        },
        auction: {
            findFirst: jest.fn(),
            update: jest.fn(),
        },
        $transaction: jest.fn((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prismaTxProxy))),
    };
}

// Used only by the $transaction((tx) => ...) callback form — mirror the same mock shape.
let prismaTxProxy: any;

function buildModule(prisma: any) {
    prismaTxProxy = prisma;
    return Test.createTestingModule({
        providers: [
            PaymentsService,
            { provide: PrismaService, useValue: prisma },
            { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('sk_test_mock') } },
            { provide: HpiService, useValue: { generateAndSaveReport: jest.fn() } },
            { provide: NotificationsService, useValue: { create: jest.fn().mockResolvedValue(null) } },
            { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
            { provide: EmailService, useValue: {} },
        ],
    }).compile();
}

describe('PaymentsService — createPaymentSheet (LISTING_FEE)', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockPaymentIntentsCreate.mockReset();
        mockCustomersCreate.mockReset();
        mockEphemeralKeysCreate.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);

        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', deletedAt: null });
        mockEphemeralKeysCreate.mockResolvedValue({ secret: 'ek_mock' });
        mockPaymentIntentsCreate.mockResolvedValue({ id: 'pi_mock', client_secret: 'pi_mock_secret' });
    });

    it('accepts type LISTING_FEE (previously rejected by DTO validation) and includes badgeTier in the PaymentIntent metadata', async () => {
        await service.createPaymentSheet('listing-1', 'user-1', 25, 'LISTING_FEE', 'gbp', 'PREMIUM');

        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 2500,
                metadata: expect.objectContaining({
                    type: 'LISTING_FEE',
                    badgeTier: 'PREMIUM',
                }),
            }),
        );
    });

    it('omits badgeTier from metadata for non-listing-fee payment types', async () => {
        await service.createPaymentSheet('listing-1', 'user-1', 125, 'COMMISSION', 'gbp');

        const callArg = mockPaymentIntentsCreate.mock.calls[0][0];
        expect(callArg.metadata.badgeTier).toBeUndefined();
    });

    it('throws BadRequestException for LISTING_FEE with no badgeTier', async () => {
        await expect(
            service.createPaymentSheet('listing-1', 'user-1', 25, 'LISTING_FEE', 'gbp', undefined),
        ).rejects.toThrow('badgeTier is required');
        expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    });
});

describe('PaymentsService — createPaymentSheet (F2: server-side amount, ignores client amount)', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockPaymentIntentsCreate.mockReset();
        mockCustomersCreate.mockReset();
        mockEphemeralKeysCreate.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);

        mockEphemeralKeysCreate.mockResolvedValue({ secret: 'ek_mock' });
        mockPaymentIntentsCreate.mockResolvedValue({ id: 'pi_mock', client_secret: 'pi_mock_secret' });
    });

    it('charges the real listing price for FULL_PAYMENT regardless of a lower client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, deletedAt: null });

        await service.createPaymentSheet('listing-1', 'user-1', 1, 'FULL_PAYMENT', 'gbp');

        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
            expect.objectContaining({ amount: 3000000 }), // £30,000 in pence, NOT the client's £1
        );
        expect(prisma.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ amount: 30000 }) }),
        );
    });

    it('charges the fixed £500 deposit for DEPOSIT regardless of client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, deletedAt: null });

        await service.createPaymentSheet('listing-1', 'user-1', 1, 'DEPOSIT', 'gbp');

        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 50000 }));
    });

    it('charges the fixed £125 auction buyer fee for COMMISSION regardless of client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, deletedAt: null });

        await service.createPaymentSheet('listing-1', 'user-1', 1, 'COMMISSION', 'gbp');

        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 12500 }));
    });

    it('charges the real LISTING_FEES[badgeTier] amount regardless of a lower client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, deletedAt: null });

        await service.createPaymentSheet('listing-1', 'user-1', 1, 'LISTING_FEE', 'gbp', 'PREMIUM');

        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 2500 })); // £25 PREMIUM fee, not the client's £1
    });
});

describe('PaymentsService — handleWebhook payment_intent.succeeded (LISTING_FEE)', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockConstructEvent.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);
    });

    it('moves the listing to PENDING_REVIEW (not ACTIVE) when a PREMIUM LISTING_FEE PaymentIntent succeeds — featuring is deferred to admin approval', async () => {
        mockConstructEvent.mockReturnValue({
            type: 'payment_intent.succeeded',
            data: {
                object: {
                    id: 'pi_mock',
                    metadata: { transactionId: 'txn-1', listingId: 'listing-1', type: 'LISTING_FEE', badgeTier: 'PREMIUM' },
                },
            },
        });

        await service.handleWebhook(Buffer.from('{}'), 'sig');

        expect(prisma.transaction.update).toHaveBeenCalledWith({
            where: { id: 'txn-1' },
            data: { status: 'COMPLETED', stripePaymentId: 'pi_mock' },
        });
        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: expect.objectContaining({
                status: 'PENDING_REVIEW',
                badgeTier: 'PREMIUM',
            }),
        });
    });

    it('moves a BASIC tier LISTING_FEE payment to PENDING_REVIEW the same way', async () => {
        mockConstructEvent.mockReturnValue({
            type: 'payment_intent.succeeded',
            data: {
                object: {
                    id: 'pi_mock',
                    metadata: { transactionId: 'txn-1', listingId: 'listing-1', type: 'LISTING_FEE', badgeTier: 'BASIC' },
                },
            },
        });

        await service.handleWebhook(Buffer.from('{}'), 'sig');

        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: expect.objectContaining({
                status: 'PENDING_REVIEW',
                badgeTier: 'BASIC',
            }),
        });
    });
});

describe('PaymentsService — createCheckoutSession (F6: server-side amount, same fix as F2)', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockCheckoutSessionsCreate.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);

        mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_mock', url: 'https://checkout.stripe.com/cs_mock' });
    });

    it('charges the real listing price for FULL_PAYMENT regardless of a lower client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, make: 'BMW', model: 'M3', year: 2022, images: [], deletedAt: null });

        await service.createCheckoutSession('listing-1', 'user-1', 1, 'FULL_PAYMENT', 'gbp');

        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 3000000 }) })],
            }),
        );
        expect(prisma.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ amount: 30000 }) }),
        );
    });

    it('charges the fixed £500 deposit for DEPOSIT regardless of client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, make: 'BMW', model: 'M3', year: 2022, images: [], deletedAt: null });

        await service.createCheckoutSession('listing-1', 'user-1', 1, 'DEPOSIT', 'gbp');

        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 50000 }) })],
            }),
        );
    });

    it('charges the fixed £125 auction buyer fee for COMMISSION regardless of client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, make: 'BMW', model: 'M3', year: 2022, images: [], deletedAt: null });

        await service.createCheckoutSession('listing-1', 'user-1', 1, 'COMMISSION', 'gbp');

        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 12500 }) })],
            }),
        );
    });
});
