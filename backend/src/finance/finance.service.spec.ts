import { BadRequestException } from '@nestjs/common';
import { FinanceService } from './finance.service';

describe('FinanceService partner integrity', () => {
    function build() {
        const prisma: any = {
            partnerProfile: {
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            financeApplication: {
                findUnique: jest.fn(),
                update: jest.fn(),
                groupBy: jest.fn().mockResolvedValue([]),
                findMany: jest.fn().mockResolvedValue([]),
                aggregate: jest.fn(),
                count: jest.fn(),
            },
            listing: { findUnique: jest.fn() },
        };
        return { prisma, service: new FinanceService(prisma) };
    }

    it('resolves only the active finance profile owned by the logged-in user', async () => {
        const { prisma, service } = build();
        prisma.partnerProfile.findFirst.mockResolvedValue({ id: 'finance-profile-1' });

        await expect(service.getPartnerProfileId('finance-user-1')).resolves.toBe('finance-profile-1');
        expect(prisma.partnerProfile.findFirst).toHaveBeenCalledWith({
            where: {
                financeUserId: 'finance-user-1',
                partnerType: 'FINANCE_PARTNER',
                isActive: true,
                deletedAt: null,
            },
        });
    });

    it('requires a monthly payment before approving finance', async () => {
        const { prisma, service } = build();
        prisma.financeApplication.findUnique.mockResolvedValue({
            id: 'app-1',
            partnerId: 'finance-profile-1',
            status: 'PENDING',
            deletedAt: null,
        });

        await expect(
            service.updateStatus('app-1', 'finance-profile-1', { status: 'APPROVED' } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.financeApplication.update).not.toHaveBeenCalled();
    });

    it('persists the approved monthly payment and approval date', async () => {
        const { prisma, service } = build();
        prisma.financeApplication.findUnique.mockResolvedValue({
            id: 'app-1',
            partnerId: 'finance-profile-1',
            status: 'PENDING',
            deletedAt: null,
        });
        prisma.financeApplication.update.mockResolvedValue({ id: 'app-1', status: 'APPROVED' });

        await service.updateStatus('app-1', 'finance-profile-1', {
            status: 'APPROVED',
            monthlyPayment: 329.5,
        } as any);

        expect(prisma.financeApplication.update).toHaveBeenCalledWith({
            where: { id: 'app-1' },
            data: {
                status: 'APPROVED',
                monthlyPayment: 329.5,
                approvalDate: expect.any(Date),
            },
        });
    });

    it('creates persistent partner settings without exposing the stored full key', async () => {
        const { prisma, service } = build();
        prisma.partnerProfile.findUnique.mockResolvedValue(null);
        prisma.partnerProfile.create.mockImplementation(({ data }: any) => ({
            id: 'finance-profile-1',
            ...data,
            isActive: true,
        }));

        const result = await service.updatePartnerSettings('finance-user-1', {
            companyName: 'Finance Co',
            callbackUrl: 'https://partner.example/callback',
        });

        expect(prisma.partnerProfile.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                financeUserId: 'finance-user-1',
                partnerType: 'FINANCE_PARTNER',
                companyName: 'Finance Co',
                callbackUrl: 'https://partner.example/callback',
                apiKey: expect.stringMatching(/^cmz_fin_/),
            }),
        });
        expect(result.apiKeyHint).toMatch(/^••••••••••••/);
        expect(result).not.toHaveProperty('apiKey');
        expect(result.integrationEnabled).toBe(false);
    });
});
