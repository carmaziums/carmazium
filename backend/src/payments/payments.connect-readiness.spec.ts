const mockAccountsRetrieve = jest.fn();

jest.mock('stripe', () => {
    const MockStripe = jest.fn().mockImplementation(() => ({
        accounts: { retrieve: mockAccountsRetrieve },
    }));
    return { __esModule: true, default: MockStripe };
});

import { PaymentsService } from './payments.service';

describe('PaymentsService — TradeXchange Connect transfer readiness', () => {
    let prisma: any;
    let service: PaymentsService;

    beforeEach(() => {
        mockAccountsRetrieve.mockReset();
        prisma = {
            user: {
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        };
        service = new PaymentsService(
            prisma,
            { get: jest.fn().mockReturnValue('sk_test_mock') } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
        );
    });

    it('treats a transfer-ready provider as ready even when provider-side charges are disabled', async () => {
        mockAccountsRetrieve.mockResolvedValue({
            id: 'acct_1',
            deleted: false,
            details_submitted: true,
            charges_enabled: false,
            payouts_enabled: true,
            capabilities: { transfers: 'active' },
            requirements: { currently_due: [] },
        });

        await expect(service.refreshConnectAccountReadiness('acct_1')).resolves.toEqual({
            ready: true,
            accountId: 'acct_1',
        });
        expect(prisma.user.updateMany).toHaveBeenCalledWith({
            where: { stripeConnectAccountId: 'acct_1' },
            data: { stripeConnectOnboardingComplete: true },
        });
    });

    it('fails closed when the transfers capability is not active', async () => {
        mockAccountsRetrieve.mockResolvedValue({
            id: 'acct_2',
            deleted: false,
            details_submitted: true,
            charges_enabled: true,
            payouts_enabled: true,
            capabilities: { transfers: 'inactive' },
            requirements: { currently_due: [] },
        });

        await expect(service.refreshConnectAccountReadiness('acct_2')).resolves.toEqual({
            ready: false,
            accountId: 'acct_2',
        });
        expect(prisma.user.updateMany).toHaveBeenCalledWith({
            where: { stripeConnectAccountId: 'acct_2' },
            data: { stripeConnectOnboardingComplete: false },
        });
    });

    it('fails closed when Stripe has currently-due verification requirements', async () => {
        mockAccountsRetrieve.mockResolvedValue({
            id: 'acct_3',
            deleted: false,
            details_submitted: true,
            payouts_enabled: true,
            capabilities: { transfers: 'active' },
            requirements: { currently_due: ['company.verification.document'] },
        });

        await expect(service.refreshConnectAccountReadiness('acct_3')).resolves.toEqual({
            ready: false,
            accountId: 'acct_3',
        });
    });
});
