import { BadRequestException } from '@nestjs/common';
import { InsuranceService } from './insurance.service';

describe('InsuranceService partner integrity', () => {
    function build() {
        const prisma: any = {
            partnerProfile: {
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            insuranceQuote: {
                findUnique: jest.fn(),
                update: jest.fn(),
                groupBy: jest.fn().mockResolvedValue([]),
                aggregate: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                count: jest.fn(),
            },
            listing: { findUnique: jest.fn() },
        };
        return { prisma, service: new InsuranceService(prisma) };
    }

    it('resolves insurance partners through insuranceUserId, not financeUserId', async () => {
        const { prisma, service } = build();
        prisma.partnerProfile.findFirst.mockResolvedValue({ id: 'insurance-profile-1' });

        await expect(service.getPartnerProfileId('insurance-user-1')).resolves.toBe('insurance-profile-1');
        expect(prisma.partnerProfile.findFirst).toHaveBeenCalledWith({
            where: {
                insuranceUserId: 'insurance-user-1',
                partnerType: 'INSURANCE_PARTNER',
                isActive: true,
                deletedAt: null,
            },
        });
    });

    it('requires an annual premium before moving a request to QUOTED', async () => {
        const { prisma, service } = build();
        prisma.insuranceQuote.findUnique.mockResolvedValue({
            id: 'quote-1',
            partnerId: 'insurance-profile-1',
            status: 'PENDING',
            deletedAt: null,
        });

        await expect(
            service.updateStatus('quote-1', 'insurance-profile-1', { status: 'QUOTED' } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.insuranceQuote.update).not.toHaveBeenCalled();
    });

    it('writes the real InsuranceQuote fields when issuing a quote', async () => {
        const { prisma, service } = build();
        prisma.insuranceQuote.findUnique.mockResolvedValue({
            id: 'quote-1',
            partnerId: 'insurance-profile-1',
            status: 'PENDING',
            deletedAt: null,
        });
        prisma.insuranceQuote.update.mockResolvedValue({ id: 'quote-1', status: 'QUOTED' });

        await service.updateStatus('quote-1', 'insurance-profile-1', {
            status: 'QUOTED',
            quotedPrice: 899.99,
            coverageType: 'Comprehensive',
        } as any);

        const call = prisma.insuranceQuote.update.mock.calls[0][0];
        expect(call.where).toEqual({ id: 'quote-1' });
        expect(call.data).toEqual(expect.objectContaining({
            status: 'QUOTED',
            quotedPrice: 899.99,
            coverageType: 'Comprehensive',
            expiryDate: expect.any(Date),
        }));
        expect(call.data).not.toHaveProperty('annualPrice');
        expect(call.data).not.toHaveProperty('quotedDate');
    });

    it('creates persistent insurance settings against insuranceUserId', async () => {
        const { prisma, service } = build();
        prisma.partnerProfile.findUnique.mockResolvedValue(null);
        prisma.partnerProfile.create.mockImplementation(({ data }: any) => ({
            id: 'insurance-profile-1',
            ...data,
            isActive: true,
        }));

        const result = await service.updatePartnerSettings('insurance-user-1', {
            companyName: 'Insurance Co',
            callbackUrl: 'https://insurer.example/callback',
        });

        expect(prisma.partnerProfile.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                insuranceUserId: 'insurance-user-1',
                partnerType: 'INSURANCE_PARTNER',
                companyName: 'Insurance Co',
                callbackUrl: 'https://insurer.example/callback',
                apiKey: expect.stringMatching(/^cmz_ins_/),
            }),
        });
        expect(result).not.toHaveProperty('apiKey');
        expect(result.integrationEnabled).toBe(false);
    });
});
