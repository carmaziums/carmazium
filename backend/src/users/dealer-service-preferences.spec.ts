import { UsersService } from './users.service';

describe('own dealership service preferences', () => {
    const setup = (existing: any = null) => {
        const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'seller-a', role: 'DEALER', firstName: 'Test' }) }, dealerProfile: { findUnique: jest.fn().mockResolvedValue(existing), create: jest.fn(async ({ data }) => data), update: jest.fn(async ({ data }) => data) } };
        const service = new UsersService(prisma as any, {} as any, { get: () => undefined } as any);
        return { service, prisma };
    };
    it('defaults all four new dealer preferences on without inventing finance or warranty terms', async () => {
        const { service } = setup();
        const data = await service.updateDealerProfile('seller-a', { companyName: 'Synthetic business' });
        expect(data).toMatchObject({ financeOffered: true, warrantyOffered: true, deliveryServicesEnabled: true, inspectionServicesEnabled: true });
        expect(data.financeDetails).toBeNull();
        expect(data.warrantyDetails).toBeNull();
    });
    it('updates only the current dealer and ignores approval, ownership and provider-routing injection', async () => {
        const { service, prisma } = setup({ id: 'dealer-a', financeOffered: true, warrantyOffered: true });
        await service.updateDealerProfile('seller-a', { financeOffered: false, deliveryServicesEnabled: false, isVerified: true, userId: 'seller-b', financeProviderId: 'provider-b' } as any);
        expect(prisma.dealerProfile.update).toHaveBeenCalledWith({ where: { userId: 'seller-a' }, data: { financeOffered: false, financeDetails: null, deliveryServicesEnabled: false } });
    });
    it.each(['financeOffered', 'warrantyOffered', 'deliveryServicesEnabled', 'inspectionServicesEnabled'])('rejects non-boolean %s', async key => {
        const { service } = setup({});
        await expect(service.updateDealerProfile('seller-a', { [key]: 'false' } as any)).rejects.toThrow(/true or false/);
    });
    it('preserves an existing opt-out when saving other business details', async () => {
        const { service, prisma } = setup({ financeOffered: false, warrantyOffered: false });
        await service.updateDealerProfile('seller-a', { description: 'Business introduction' });
        expect(prisma.dealerProfile.update.mock.calls[0][0].data).not.toHaveProperty('financeOffered');
        expect(prisma.dealerProfile.update.mock.calls[0][0].data).not.toHaveProperty('warrantyOffered');
    });
});
