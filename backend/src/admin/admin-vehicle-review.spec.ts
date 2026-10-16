import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

const motHistory = [{
    completedDate: '2026-09-01',
    testResult: 'PASSED' as const,
    motTestNumber: '123456789',
    expiryDate: '2027-09-01',
}];

function setup(original: Record<string, any>, officialOverride: Record<string, any> = {}) {
    const row = {
        id: 'retail-1', sellerId: 'seller-1', type: 'CLASSIFIED',
        status: 'ACTIVE', deletedAt: null, linkedListingId: null,
        vrm: 'AB12CDE', make: 'FORD', year: 2020,
        updatedAt: new Date('2026-10-16T00:00:00Z'),
        mileage: 37000, price: 6000, numberOfKeys: null,
        serviceHistory: null, motHistory: null, model: null,
        ...original,
    };
    const official = {
        vrm: 'AB12CDE', make: 'FORD', year: 2020, model: 'FOCUS',
        motStatus: 'Valid', motExpiryDate: '2027-09-01',
        motHistory, dataSource: 'DVLA',
        ...officialOverride,
    };
    const prisma: any = {
        listing: {
            findUnique: jest.fn().mockResolvedValue(row),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
    };
    const gateway: any = { sendNotification: jest.fn() };
    const notifications: any = { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) };
    const dvla: any = { lookupVrm: jest.fn().mockResolvedValue(official) };
    const service = new AdminService(
        prisma, {} as any, {} as any,
        gateway, notifications,
        {} as any, {} as any, {} as any, dvla,
    );
    return { service, prisma, official, dvla, notifications, gateway, row };
}

describe('admin-only official missing-field repair', () => {
    it('fills only absent verified DVLA/DVSA facts, preserving all seller and commercial values', async () => {
        const { service, prisma } = setup({});
        const result = await service.refreshOfficialVehicleData('retail-1');
        expect(result.updated).toHaveLength(1);
        const patch = prisma.listing.updateMany.mock.calls[0][0].data;
        expect(patch.motStatus).toBe('Valid');
        expect(patch.motExpiryDate).toBe('2027-09-01');
        expect(patch.model).toBe('FOCUS');
        expect(patch.motHistory).toEqual(motHistory);
        for (const protectedField of ['mileage', 'price', 'numberOfKeys', 'serviceHistory', 'reservePrice', 'status']) {
            expect(patch).not.toHaveProperty(protectedField);
        }
        expect(prisma.listing.updateMany.mock.calls[0][0].where.updatedAt).toBeDefined();
    });

    it('does not overwrite existing official values', async () => {
        const { service, prisma } = setup({ motStatus: 'Valid', motExpiryDate: '2027-01-01', model: 'Focus Titanium', motHistory });
        await service.refreshOfficialVehicleData('retail-1');
        expect(prisma.listing.updateMany).not.toHaveBeenCalled();
    });

    it('rejects an official make mismatch without a database write', async () => {
        const { service, prisma } = setup({}, { make: 'BMW' });
        await expect(service.refreshOfficialVehicleData('retail-1')).rejects.toBeInstanceOf(BadGatewayException);
        expect(prisma.listing.updateMany).not.toHaveBeenCalled();
    });

    it('can safely fill an unchanged reciprocal sibling but not an unrelated row', async () => {
        const { service, prisma, row } = setup({ linkedListingId: 'auction-2' });
        const sibling = { ...row, id: 'auction-2', type: 'AUCTION', linkedListingId: 'retail-1' };
        prisma.listing.findUnique.mockImplementation(async ({ where }: any) => where.id === 'auction-2' ? sibling : row);
        const result = await service.refreshOfficialVehicleData('retail-1');
        expect(result.updated).toHaveLength(2);
        expect(prisma.listing.updateMany).toHaveBeenCalledTimes(2);
    });

    it('requests only explicitly selected seller-entered fields via in-app notification', async () => {
        const { service, notifications, gateway } = setup({});
        await service.requestVehicleDetailsFromSeller('retail-1', ['numberOfKeys', 'serviceHistory']);
        const message = notifications.create.mock.calls[0][0];
        expect(message.message).toContain('number of keys');
        expect(message.message).toContain('service history');
        expect(message.message).not.toContain('MOT expiry');
        expect(gateway.sendNotification).toHaveBeenCalled();
        await expect(service.requestVehicleDetailsFromSeller('retail-1', ['motExpiryDate']))
            .rejects.toBeInstanceOf(BadRequestException);
    });
});
