import { BadRequestException } from '@nestjs/common';
import { WarrantiesService } from './warranties.service';

describe('warranty admin queue pagination', () => {
    function setup() {
        const row = { id: 'old-order', status: 'PAID_AWAITING_ISSUE', accessTokenHash: 'secret-token', requestHash: 'secret-request' };
        const prisma: any = { warrantyOrder: { findMany: jest.fn().mockResolvedValue([row]), count: jest.fn().mockResolvedValue(251) }, $transaction: jest.fn(promises => Promise.all(promises)) };
        const service = new WarrantiesService(prisma, {} as any, {} as any, {} as any, {} as any);
        return { prisma, service };
    }
    it('can retrieve orders beyond the old 200 cap, oldest first, without exposing access secrets', async () => {
        const { prisma, service } = setup();
        const result = await service.adminOrdersPage('PAID_AWAITING_ISSUE', 9, 25);
        expect(prisma.warrantyOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 200, take: 25, where: { status: 'PAID_AWAITING_ISSUE' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }));
        expect(result.total).toBe(251);
        expect(result.data[0]).not.toHaveProperty('accessTokenHash');
        expect(result.data[0]).not.toHaveProperty('requestHash');
    });
    it('uses identical filters for rows and totals, with exact ID and registration/customer search', async () => {
        const { prisma, service } = setup();
        await service.adminOrdersPage(undefined, 1, 25, 'qa12 abc', 'newest');
        const query = prisma.warrantyOrder.findMany.mock.calls[0][0];
        expect(prisma.warrantyOrder.count).toHaveBeenCalledWith({ where: query.where });
        expect(query.where.status).toEqual({ not: 'QUOTED' });
        expect(query.where.OR).toContainEqual({ vehicle: { path: ['vrm'], string_contains: 'QA12ABC', mode: 'insensitive' } });
        expect(query.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    });
    it.each([[0,25],[1,101],[1.5,25],[1,NaN]])('rejects invalid page %s / limit %s', async (page, limit) => {
        const { service, prisma } = setup();
        await expect(service.adminOrdersPage(undefined,page,limit)).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.warrantyOrder.findMany).not.toHaveBeenCalled();
    });
    it('rejects invalid statuses and sorting', async () => {
        const { service } = setup();
        await expect(service.adminOrdersPage('FAKE')).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.adminOrdersPage(undefined,1,25,'','FAKE')).rejects.toBeInstanceOf(BadRequestException);
    });
});
