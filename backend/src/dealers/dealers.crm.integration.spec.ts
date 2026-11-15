import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DealersService } from './dealers.service';
const integration = process.env.TRADE_POSTGRES_TEST === '1' ? describe : describe.skip;
integration('CRM boundaries with disposable PostgreSQL', () => {
    let prisma: PrismaService;
    let service: DealersService;
    const users: string[] = [];
    const profiles: string[] = [];
    const listings: string[] = [];
    beforeAll(async () => {
        if (!process.env.DATABASE_URL?.includes('@127.0.0.1:5432/carmazium_damage_qa')) throw new Error('Requires the disposable CI PostgreSQL database');
        prisma = new PrismaService();
        service = new DealersService(prisma, {} as any, {} as any, {} as any);
        for (let index = 0; index < 4; index++) {
            const user = await prisma.user.create({ data: { email: `crm-${randomUUID()}@invalid.example`, role: 'DEALER', passwordHash: 'synthetic-only' } }); users.push(user.id);
        }
        for (const userId of users.slice(0, 2)) {
            const profile = await prisma.dealerProfile.create({ data: { userId, companyName: 'Synthetic QA', vatNumber: randomUUID(), isVerified: true } }); profiles.push(profile.id);
            const listing = await prisma.listing.create({ data: { sellerId: userId, slug: `synthetic-crm-${randomUUID()}`, title: 'Synthetic private draft', type: 'CLASSIFIED', status: 'DRAFT', price: 100, bodyType: 'CARAVAN', location: 'Birmingham' } }); listings.push(listing.id);
        }
        await prisma.dealerStaff.create({ data: { userId: users[2], dealerProfileId: profiles[0], role: 'SALES_AGENT' } });
        await prisma.dealerStaff.create({ data: { userId: users[3], dealerProfileId: profiles[0], role: 'FINANCE_MANAGER' } });
    });
    afterAll(async () => {
        if (!prisma) return;
        await prisma.lead.deleteMany({ where: { dealerProfileId: { in: profiles } } });
        await prisma.listing.deleteMany({ where: { id: { in: listings } } });
        await prisma.dealerStaff.deleteMany({ where: { dealerProfileId: { in: profiles } } });
        await prisma.dealerProfile.deleteMany({ where: { id: { in: profiles } } });
        await prisma.user.deleteMany({ where: { id: { in: users } } });
        await prisma.$disconnect();
    });
    it('owner and sales staff create only own-stock customers; foreign stock and assignees are rejected', async () => {
        await expect(service.createLead(users[0], { buyerName: 'Synthetic', listingId: listings[1] })).rejects.toThrow('Listing not found');
        await expect(service.createLead(users[0], { buyerName: 'Synthetic', assignedToId: users[1] })).rejects.toThrow('active member');
        const lead = await service.createLead(users[2], { buyerName: 'Synthetic', listingId: listings[0], assignedToId: users[2], source: 'phone' });
        expect(lead.dealerProfileId).toBe(profiles[0]);
        await service.updateLead(users[0], lead.id, { status: 'QUALIFIED' });
        await expect(service.updateLead(users[1], lead.id, { status: 'WON' })).rejects.toThrow('Lead not found');
        await expect(service.updateLead(users[3], lead.id, { status: 'WON' })).rejects.toThrow('permission');
        expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('QUALIFIED');
    });
    it('removed staff cannot receive assignments and legacy foreign references are hidden on reads and updates', async () => {
        await prisma.dealerStaff.updateMany({ where: { userId: users[2] }, data: { isActive: false } });
        await expect(service.createLead(users[0], { buyerName: 'Synthetic', assignedToId: users[2] })).rejects.toThrow('active member');
        const legacy = await prisma.lead.create({ data: { dealerProfileId: profiles[0], buyerName: 'Legacy synthetic', listingId: listings[1], assignedToId: users[1] } });
        const read = (await service.getLeads(users[0])).data.find(row => row.id === legacy.id);
        expect(read).toMatchObject({ listing: null, listingId: null, assignedTo: null, assignedToId: null });
        expect(await service.updateLead(users[0], legacy.id, { notes: 'Safe note update' })).toMatchObject({ listing: null, listingId: null, assignedTo: null, assignedToId: null });
        const original = await prisma.lead.findUniqueOrThrow({ where: { id: legacy.id } });
        expect(original.listingId).toBe(listings[1]);
        expect(original.assignedToId).toBe(users[1]);
    });
    it('pagination includes more than 20 records with stable nonoverlapping pages', async () => {
        await prisma.lead.createMany({ data: Array.from({ length: 51 }, (_, i) => ({ dealerProfileId: profiles[0], buyerName: `Synthetic ${i}` })) });
        const first = await service.getLeads(users[0], undefined, 1, 50);
        const second = await service.getLeads(users[0], undefined, 2, 50);
        expect(first.total).toBeGreaterThan(50);
        expect(first.data.length + second.data.length).toBe(first.total);
        expect(new Set([...first.data, ...second.data].map(lead => lead.id)).size).toBe(first.total);
    });
});
