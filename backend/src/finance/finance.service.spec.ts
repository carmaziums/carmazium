import { ForbiddenException } from '@nestjs/common';
import { FinanceService } from './finance.service';

function buildPrisma() {
    return {
        user: {
            findUnique: jest.fn(),
        },
        dealerProfile: {
            findUnique: jest.fn().mockResolvedValue(null),
        },
        dealerStaff: {
            findFirst: jest.fn().mockResolvedValue(null),
        },
        financeApplication: {
            create: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        partnerProfile: {
            findFirst: jest.fn(),
        },
    } as any;
}

const dto = {
    listingId: '11111111-1111-4111-8111-111111111111',
    partnerId: '22222222-2222-4222-8222-222222222222',
    depositAmount: 2500,
    termMonths: 36,
};

describe('FinanceService — dealership applicant identity', () => {
    it('keeps a retail buyer finance application personal', async () => {
        const prisma = buildPrisma();
        prisma.user.findUnique.mockResolvedValue({ role: 'BUYER' });
        prisma.financeApplication.create.mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'finance-1', ...data }),
        );
        const service = new FinanceService(prisma);

        await service.create('buyer-1', dto as any);

        expect(prisma.financeApplication.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'buyer-1',
                listingId: dto.listingId,
                partnerId: dto.partnerId,
            }),
        });
        expect(prisma.dealerStaff.findFirst).not.toHaveBeenCalled();
    });

    it('stores a FINANCE_MANAGER application against the dealership owner', async () => {
        const prisma = buildPrisma();
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER' });
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'FINANCE_MANAGER',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });
        prisma.financeApplication.create.mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'finance-1', ...data }),
        );
        const service = new FinanceService(prisma);

        await service.create('finance-staff-1', dto as any);

        expect(prisma.financeApplication.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'owner-1',
            }),
        });
    });

    it('blocks SALES_AGENT from dealership finance management', async () => {
        const prisma = buildPrisma();
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER' });
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'SALES_AGENT',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });
        const service = new FinanceService(prisma);

        await expect(service.create('sales-1', dto as any))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.financeApplication.create).not.toHaveBeenCalled();
    });

    it('blocks staff finance access until the dealership is KYC verified', async () => {
        const prisma = buildPrisma();
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER' });
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'FINANCE_MANAGER',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: false,
            },
        });
        const service = new FinanceService(prisma);

        await expect(service.findMyApplications('finance-staff-1'))
            .rejects.toThrow(/complete KYC/i);
        expect(prisma.financeApplication.findMany).not.toHaveBeenCalled();
    });

    it('reads dealership finance history through the canonical owner id', async () => {
        const prisma = buildPrisma();
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER' });
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'FINANCE_MANAGER',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });
        const service = new FinanceService(prisma);

        await service.findMyApplications('finance-staff-1', 2, 10);

        expect(prisma.financeApplication.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId: 'owner-1', deletedAt: null },
                skip: 10,
                take: 10,
            }),
        );
        expect(prisma.financeApplication.count).toHaveBeenCalledWith({
            where: { userId: 'owner-1', deletedAt: null },
        });
    });
});
