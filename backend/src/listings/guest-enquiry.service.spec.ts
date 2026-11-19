import { GuestEnquiryService } from './guest-enquiry.service';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GuestEnquiryDto } from './guest-enquiry.dto';

const dto = { listingId: '22468b66-68ca-47bc-a4bf-a7f3c169af9b', fullName: 'Test Buyer', email: 'buyer@example.test', message: 'Is this vehicle available to view?', consent: true };
function setup() {
    process.env.SESSION_SECRET = 'unit-test-only-secret';
    let row: any;
    const eligible = { id: dto.listingId, sellerId: 'seller', title: 'Test vehicle', slug: 'test-vehicle' };
    const enquiries = {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async ({ data }) => row = { ...data, attempts: 0, verifiedAt: null, seller: { email: 'seller@example.test', deletedAt: null }, listing: { title: '<script>car</script>' } }),
        findUnique: jest.fn().mockImplementation(async () => row), findUniqueOrThrow: jest.fn().mockImplementation(async () => row),
        update: jest.fn().mockImplementation(async ({ data }) => { Object.assign(row, { ...data, ...(data.attempts ? { attempts: row.attempts + data.attempts.increment } : {}) }); return row; }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn(),
    };
    const prisma: any = { guestListingEnquiry: enquiries, listing: { findFirst: jest.fn().mockResolvedValue(eligible) }, $executeRaw: jest.fn(),
        notification: { create: jest.fn() }, dealerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'dealer', userId: 'seller' }) }, lead: { create: jest.fn() }, dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) } };
    prisma.$transaction = jest.fn(fn => fn(prisma));
    const email = { sendEmail: jest.fn().mockResolvedValue({ id: 'sent' }) };
    const service = new GuestEnquiryService(prisma, email as any);
    const code = () => email.sendEmail.mock.calls[0][0].html.match(/bold">(\d{6})</)[1];
    return { service, prisma, enquiries, email, code, row: () => row };
}
describe('guest retail enquiries', () => {
    it('validates consent and rejects overlong, invalid and injected contact fields', async () => {
        expect(await validate(plainToInstance(GuestEnquiryDto, dto))).toHaveLength(0);
        for (const patch of [{ consent: 'true' }, { email: 'a\r\nb@example.test' }, { phone: 'tel:javascript:bad' }, { message: 'x'.repeat(2001) }, { website: 'bot' }]) {
            expect((await validate(plainToInstance(GuestEnquiryDto, { ...dto, ...patch }))).length).toBeGreaterThan(0);
        }
    });
    it('sends only a confirmation code before verification and does not create a buyer account or lead', async () => {
        const s = setup(); const result = await s.service.start(dto);
        expect(result.id).toBe(s.row().id); expect(s.row().codeHash).not.toContain(s.code());
        expect(s.email.sendEmail).toHaveBeenCalledTimes(1); expect(s.email.sendEmail.mock.calls[0][0].to).toBe(dto.email);
        expect(s.prisma.lead.create).not.toHaveBeenCalled(); expect(s.prisma.notification.create).not.toHaveBeenCalled();
    });
    it('checks active retail eligibility and keeps missing/sold/auction requests out', async () => {
        const s = setup(); s.prisma.listing.findFirst.mockResolvedValue(null);
        await expect(s.service.start(dto)).rejects.toThrow(/no longer available/);
        expect(s.prisma.listing.findFirst.mock.calls[0][0].where).toMatchObject({ type: 'CLASSIFIED', status: 'ACTIVE', deletedAt: null, offers: { none: { status: 'ACCEPTED' } } });
        expect(s.email.sendEmail).not.toHaveBeenCalled();
    });
    it('limits requests per address inside a database lock', async () => {
        const s = setup(); s.enquiries.count.mockResolvedValue(3);
        await expect(s.service.start(dto)).rejects.toThrow(/Too many/);
        expect(s.prisma.$executeRaw).toHaveBeenCalled(); expect(s.email.sendEmail).not.toHaveBeenCalled();
    });
    it('persists failed-code attempts and refuses a sixth attempt, even if correct', async () => {
        const s = setup(); const { id } = await s.service.start(dto);
        for (let i = 0; i < 5; i++) await expect(s.service.verify({ id, code: '000000' })).rejects.toThrow(/incorrect/);
        expect(s.row().attempts).toBe(5);
        await expect(s.service.verify({ id, code: s.code() })).rejects.toThrow(/incorrect/);
        expect(s.prisma.notification.create).not.toHaveBeenCalled();
    });
    it('rejects expired codes and listings that change owner or close before confirmation', async () => {
        const s = setup(); const { id } = await s.service.start(dto);
        s.row().expiresAt = new Date(0);
        await expect(s.service.verify({ id, code: s.code() })).rejects.toThrow(/expired/);
        s.row().expiresAt = new Date(Date.now() + 60_000); s.prisma.listing.findFirst.mockResolvedValue(null);
        await expect(s.service.verify({ id, code: s.code() })).rejects.toThrow(/no longer available/);
        expect(s.row().verifiedAt).toBeNull();
    });
    it('creates one seller notification and one CRM lead and safely retries confirmation', async () => {
        const s = setup(); const { id } = await s.service.start(dto);
        await expect(s.service.verify({ id, code: s.code() })).resolves.toEqual({ sent: true });
        await s.service.verify({ id, code: s.code() });
        expect(s.prisma.notification.create).toHaveBeenCalledTimes(1); expect(s.prisma.lead.create).toHaveBeenCalledTimes(1);
        expect(s.prisma.notification.create.mock.calls[0][0].data.data.link).toBe('/dashboard/enquiries');
        expect(s.email.sendEmail.mock.calls[1][0].replyTo).toBe(dto.email);
        expect(s.email.sendEmail.mock.calls[1][0].html).toContain('&lt;script&gt;');
    });
    it('keeps a confirmed enquiry in the seller inbox if notification email fails', async () => {
        const s = setup(); const { id } = await s.service.start(dto); s.email.sendEmail.mockResolvedValue(null);
        await expect(s.service.verify({ id, code: s.code() })).resolves.toEqual({ sent: true });
        expect(s.row().verifiedAt).toBeInstanceOf(Date); expect(s.row().notifiedAt).toBeUndefined();
    });
    it('reports failure when the confirmation email cannot be sent', async () => {
        const s = setup(); s.email.sendEmail.mockResolvedValue(null);
        await expect(s.service.start(dto)).rejects.toThrow(/could not send/);
    });
    it('limits the inbox to the authenticated seller and returns no code secrets', async () => {
        const s = setup(); s.prisma.dealerProfile.findUnique.mockResolvedValue(null);
        await s.service.mine('private-seller');
        const query = s.enquiries.findMany.mock.calls[0][0];
        expect(query.where).toEqual({ sellerId: 'private-seller', verifiedAt: { not: null } });
        expect(query.select.codeHash).toBeUndefined(); expect(query.select.email).toBe(true);
    });
    it('denies staff without CRM permissions', async () => {
        const s = setup(); s.prisma.dealerProfile.findUnique.mockResolvedValue(null); s.prisma.dealerStaff.findFirst.mockResolvedValue({ role: 'FINANCE_MANAGER', dealerProfile: { id: 'dealer', userId: 'seller', isVerified: true } });
        await expect(s.service.mine('staff')).rejects.toThrow(); expect(s.enquiries.findMany).not.toHaveBeenCalled();
    });
});
