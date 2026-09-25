import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService Stripe Connect onboarding redirects', () => {
    function build() {
        const prisma: any = {
            user: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'user-1',
                    email: 'partner@example.com',
                    stripeConnectAccountId: 'acct_1',
                }),
                update: jest.fn(),
            },
        };
        const config: any = {
            get: jest.fn((key: string) =>
                key === 'FRONTEND_URL' ? 'https://www.carmazium.com' : 'sk_test_example',
            ),
        };
        const service = new UsersService(prisma, {} as any, config);
        const accountLinksCreate = jest.fn().mockResolvedValue({ url: 'https://connect.stripe.com/setup/test' });
        (service as any).getStripe = jest.fn().mockResolvedValue({
            accounts: { create: jest.fn() },
            accountLinks: { create: accountLinksCreate },
        });
        return { service, prisma, accountLinksCreate };
    }

    it('rejects an external return URL before creating a Stripe onboarding link', async () => {
        const { service, prisma, accountLinksCreate } = build();

        await expect(service.createConnectOnboardingLink(
            'user-1',
            'https://evil.example/steal',
            'https://www.carmazium.com/dashboard/partner',
        )).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(accountLinksCreate).not.toHaveBeenCalled();
    });

    it('allows the canonical CarMazium partner return and refresh URLs', async () => {
        const { service, accountLinksCreate } = build();

        await expect(service.createConnectOnboardingLink(
            'user-1',
            'https://www.carmazium.com/dashboard/partner?stripe=done',
            'https://www.carmazium.com/dashboard/partner',
        )).resolves.toEqual({ url: 'https://connect.stripe.com/setup/test' });

        expect(accountLinksCreate).toHaveBeenCalledWith({
            account: 'acct_1',
            return_url: 'https://www.carmazium.com/dashboard/partner?stripe=done',
            refresh_url: 'https://www.carmazium.com/dashboard/partner',
            type: 'account_onboarding',
        });
    });
});
