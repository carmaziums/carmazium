import { validate } from 'class-validator';
import { DealersService } from './dealers.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

describe('CRM dealership boundaries', () => {
    const setup = () => {
        const profile = { id: 'dealer-a', userId: 'owner-a', isVerified: true, staff: [{ userId: 'staff-a', isActive: true }] };
        const prisma = {
            dealerProfile: { findUnique: jest.fn().mockResolvedValue(profile) },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            listing: { findFirst: jest.fn().mockResolvedValue(null) },
            lead: { create: jest.fn().mockResolvedValue({ id: 'lead-a' }), update: jest.fn().mockResolvedValue({ id: 'lead-a' }), findFirst: jest.fn().mockResolvedValue({ id: 'lead-a', dealerProfileId: 'dealer-a' }), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        };
        return { prisma, service: new DealersService(prisma as any, {} as any, {} as any, {} as any) };
    };
    it('rejects a listing outside the dealership before creating a customer', async () => {
        const { prisma, service } = setup();
        await expect(service.createLead('owner-a', { buyerName: 'Synthetic', listingId: 'foreign' })).rejects.toThrow('Listing not found in your dealership');
        expect(prisma.listing.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', sellerId: 'owner-a', deletedAt: null }, select: { id: true } });
        expect(prisma.lead.create).not.toHaveBeenCalled();
    });
    it('rejects assignments outside active dealership staff on creation and update', async () => {
        const { prisma, service } = setup();
        await expect(service.createLead('owner-a', { buyerName: 'Synthetic', assignedToId: 'foreign' })).rejects.toThrow('active member');
        await expect(service.updateLead('owner-a', 'lead-a', { assignedToId: 'foreign' })).rejects.toThrow('active member');
        expect(prisma.dealerStaff.findFirst).toHaveBeenCalledWith({ where: { dealerProfileId: 'dealer-a', userId: 'foreign', isActive: true, user: { deletedAt: null } }, select: { id: true } });
        expect(prisma.lead.create).not.toHaveBeenCalled(); expect(prisma.lead.update).not.toHaveBeenCalled();
    });
    it('allows owner assignments, active team members and clearing an assignment', async () => {
        const { prisma, service } = setup();
        await service.createLead('owner-a', { buyerName: 'Synthetic', assignedToId: 'owner-a' });
        prisma.dealerStaff.findFirst.mockResolvedValue({ id: 'membership' });
        await service.updateLead('owner-a', 'lead-a', { assignedToId: 'staff-a' });
        await service.updateLead('owner-a', 'lead-a', { assignedToId: null });
        expect(prisma.lead.create).toHaveBeenCalledTimes(1); expect(prisma.lead.update).toHaveBeenCalledTimes(2);
    });
    it('rejects a foreign lead before any mutation', async () => {
        const { prisma, service } = setup(); prisma.lead.findFirst.mockResolvedValue(null);
        await expect(service.updateLead('owner-a', 'foreign', { status: 'WON' })).rejects.toThrow('Lead not found');
        expect(prisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', dealerProfileId: 'dealer-a' } });
        expect(prisma.lead.update).not.toHaveBeenCalled();
    });
    it('redacts old foreign listing and staff references without changing historical records', async () => {
        const { prisma, service } = setup();
        prisma.lead.findMany.mockResolvedValue([{ id: 'old', listing: { id: 'foreign', sellerId: 'other', title: 'private draft' }, assignedTo: { id: 'foreign', email: 'private@invalid.example' } }]);
        const result = await service.getLeads('owner-a');
        expect(result.data[0]).toMatchObject({ listing: null, assignedTo: null });
        expect(prisma.lead.update).not.toHaveBeenCalled();
    });
    it.each([[0,20],[1,0],[1,101],[1.5,20]])('rejects invalid page/limit %s/%s', async (page, limit) => {
        const { prisma, service } = setup(); await expect(service.getLeads('owner-a', undefined, page, limit)).rejects.toThrow();
        expect(prisma.lead.findMany).not.toHaveBeenCalled();
    });
    it('rejects unknown filter stages before querying', async () => {
        const { service } = setup(); await expect(service.getLeads('owner-a', 'APPROVED')).rejects.toThrow('Invalid customer stage');
    });
    it('validates submitted stages, sources and whitespace-only customer names', async () => {
        for (const data of [{ buyerName: '   ' }, { buyerName: 'Synthetic', status: 'INVALID' }, { buyerName: 'Synthetic', source: 'invented' }]) expect((await validate(Object.assign(new CreateLeadDto(), data))).length).toBeGreaterThan(0);
        expect((await validate(Object.assign(new UpdateLeadDto(), { status: 'INVALID' }))).length).toBeGreaterThan(0);
        expect(await validate(Object.assign(new UpdateLeadDto(), { status: 'WON', assignedToId: null }))).toEqual([]);
    });
});
