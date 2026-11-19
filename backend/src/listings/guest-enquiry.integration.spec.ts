import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GuestEnquiryService } from './guest-enquiry.service';

const integration = process.env.GUEST_ENQUIRY_POSTGRES_TEST === '1' ? describe : describe.skip;
integration('Guest enquiries with disposable PostgreSQL', () => {
    let prisma: PrismaService;
    let service: GuestEnquiryService;
    let sellerId: string;
    let outsiderId: string;
    let listingId: string;
    const sendEmail = jest.fn().mockResolvedValue({ id: 'synthetic-no-email' });
    beforeAll(async () => {
        if (!process.env.DATABASE_URL?.includes('@127.0.0.1:5432/carmazium_damage_qa')) throw new Error('Requires disposable local CI database');
        process.env.SESSION_SECRET = 'synthetic-guest-enquiry-test-only';
        prisma = new PrismaService();
        const suffix = randomUUID();
        sellerId = (await prisma.user.create({ data: { email: `guest-seller-${suffix}@invalid.example`, passwordHash: 'synthetic', role: 'SELLER' } })).id;
        outsiderId = (await prisma.user.create({ data: { email: `guest-outsider-${suffix}@invalid.example`, passwordHash: 'synthetic', role: 'BUYER' } })).id;
        listingId = (await prisma.listing.create({ data: { sellerId, title: 'Synthetic guest enquiry vehicle', slug: `guest-qa-${suffix}`, type: 'CLASSIFIED', status: 'ACTIVE', price: 2000, images: [] } })).id;
        service = new GuestEnquiryService(prisma, { sendEmail } as any);
    });
    afterAll(async () => {
        if (!prisma) return;
        if (listingId) await prisma.listing.deleteMany({ where: { id: listingId } });
        await prisma.user.deleteMany({ where: { id: { in: [sellerId, outsiderId].filter(Boolean) } } });
        await prisma.$disconnect();
    });
    it('concurrent confirmations produce one enquiry and one notification; outsider cannot see it', async () => {
        const email = `guest-${randomUUID()}@invalid.example`;
        const { id } = await service.start({ listingId, email, fullName: 'Synthetic buyer', message: 'Synthetic test enquiry, not a real customer.', consent: true });
        const code = sendEmail.mock.calls[0][0].html.match(/bold">(\d{6})</)[1];
        expect(await service.mine(sellerId)).toHaveLength(0);
        await Promise.all([service.verify({ id, code }), service.verify({ id, code })]);
        expect(await prisma.notification.count({ where: { userId: sellerId, type: 'LISTING_ENQUIRY' } })).toBe(1);
        const inbox = await service.mine(sellerId);
        expect(inbox).toHaveLength(1); expect(inbox[0].email).toBe(email); expect(inbox[0]).not.toHaveProperty('codeHash');
        expect(await service.mine(outsiderId)).toHaveLength(0);
        expect(await prisma.user.count({ where: { email } })).toBe(0);
    });
    it('concurrent wrong codes cannot bypass the attempt limit', async () => {
        const { id } = await service.start({ listingId, email: `attempt-${randomUUID()}@invalid.example`, fullName: 'Synthetic buyer', message: 'Synthetic invalid code test.', consent: true });
        const results = await Promise.allSettled(Array.from({ length: 8 }, () => service.verify({ id, code: '000000' })));
        expect(results.every(x => x.status === 'rejected')).toBe(true);
        const row = await prisma.guestListingEnquiry.findUniqueOrThrow({ where: { id } });
        expect(row.attempts).toBe(5); expect(row.verifiedAt).toBeNull();
    });
});
