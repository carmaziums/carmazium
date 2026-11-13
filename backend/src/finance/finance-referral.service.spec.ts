import { BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FinanceReferralService, JIGSAW_FINANCE_URL } from './finance-referral.service';
import { CreateFinanceReferralDto } from './finance-referral.dto';

const dto = { requestId: '939dd888-87c4-4326-a714-87ba43353065', listingId: '5960728b-c243-482f-aec7-b2965330932a', fullName: 'Test Buyer', email: 'buyer@example.test', phone: '07700900123', consent: true };

describe('Jigsaw finance referrals', () => {
    function build() {
        const row = { ...dto, id: dto.requestId, createdAt: new Date(), listingTitle: 'Test & car', listingSlug: 'test-car', adminNotifiedAt: null };
        const prisma: any = {
            listing: { findFirst: jest.fn().mockResolvedValue({ id: dto.listingId, title: row.listingTitle, slug: row.listingSlug, sellerId: 'seller', seller: { preferences: { financeCalculatorEnabled: true } } }) },
            financeReferral: { create: jest.fn().mockResolvedValue(row), findUnique: jest.fn().mockResolvedValue(row), findUniqueOrThrow: jest.fn().mockResolvedValue(row), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
            user: { findMany: jest.fn().mockResolvedValue([{ email: 'admin@example.test' }]), findUnique: jest.fn().mockResolvedValue({ preferences: {} }) },
            dealerProfile: { findUnique: jest.fn().mockResolvedValue(null) }, dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            $executeRaw: jest.fn(),
        };
        const email = { sendEmail: jest.fn().mockResolvedValue({ id: 'mail-1' }) };
        return { prisma, email, row, service: new FinanceReferralService(prisma, email as any) };
    }

    it('notifies admins with escaped contact/vehicle details before returning only the fixed Jigsaw URL', async () => {
        const { service, prisma, email, row } = build();
        row.fullName = '<Test Buyer>';
        await expect(service.create({ ...dto, fullName: row.fullName })).resolves.toEqual({ redirectUrl: JIGSAW_FINANCE_URL });
        expect(prisma.financeReferral.create).toHaveBeenCalledWith({ data: expect.objectContaining({ fullName: row.fullName, listingId: dto.listingId, consentVersion: 'jigsaw-referral-2026-11-13' }) });
        expect(email.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: ['admin@example.test'], html: expect.stringContaining('&lt;Test Buyer&gt;') }));
        expect(email.sendEmail.mock.calls[0][0].html).toContain('not confirmation of a completed application');
        expect(JIGSAW_FINANCE_URL).not.toContain(dto.email);
    });

    it('fails closed for opted-out sellers and unavailable/sold vehicles', async () => {
        const { service, prisma } = build();
        prisma.listing.findFirst.mockResolvedValueOnce({ seller: { preferences: {} } });
        await expect(service.create(dto)).rejects.toBeInstanceOf(ForbiddenException);
        prisma.listing.findFirst.mockResolvedValueOnce(null);
        await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.financeReferral.create).not.toHaveBeenCalled();
        expect(prisma.listing.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'ACTIVE', type: 'CLASSIFIED', deletedAt: null }) }));
    });

    it('keeps the lead when sending fails and does not redirect or mark it notified', async () => {
        const { service, prisma, email } = build(); email.sendEmail.mockResolvedValue(null as any);
        await expect(service.create(dto)).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(prisma.financeReferral.create).toHaveBeenCalled();
        expect(prisma.financeReferral.update).not.toHaveBeenCalled();
        expect(prisma.financeReferral.updateMany).toHaveBeenLastCalledWith({ where: { id: dto.requestId }, data: { notificationClaimedAt: null } });
    });

    it('does not resend on a retry after a successful email', async () => {
        const { service, prisma, email, row } = build();
        prisma.financeReferral.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }));
        prisma.financeReferral.findUnique.mockResolvedValue({ ...row, adminNotifiedAt: new Date() });
        await expect(service.create(dto)).resolves.toEqual({ redirectUrl: JIGSAW_FINANCE_URL });
        expect(email.sendEmail).not.toHaveBeenCalled();
    });

    it('does not send a second concurrent notification when another worker holds the claim', async () => {
        const { service, prisma, email } = build(); prisma.financeReferral.updateMany.mockResolvedValue({ count: 0 });
        await expect(service.notifyAdmin(dto.requestId)).resolves.toBe(false);
        expect(email.sendEmail).not.toHaveBeenCalled();
    });

    it('resolves staff to the dealer owner and prevents finance-only staff changing stock preferences', async () => {
        const { service, prisma } = build();
        prisma.dealerStaff.findFirst.mockResolvedValue({ role: 'ADMIN', dealerProfile: { id: 'dealer', userId: 'owner', isVerified: true } });
        await service.setPreference('staff', true);
        expect(prisma.$executeRaw.mock.calls[0].slice(1)).toEqual([true, 'owner']);
        prisma.dealerStaff.findFirst.mockResolvedValue({ role: 'FINANCE_MANAGER', dealerProfile: { id: 'dealer', userId: 'owner', isVerified: true } });
        await expect(service.setPreference('staff', true)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('defaults to off and validates contact details and explicit consent', async () => {
        const { service } = build();
        await expect(service.preference('seller')).resolves.toEqual({ enabled: false });
        expect(await validate(plainToInstance(CreateFinanceReferralDto, dto))).toHaveLength(0);
        const errors = await validate(plainToInstance(CreateFinanceReferralDto, { ...dto, email: 'invalid', consent: false, fullName: '  ', phone: 'letters' }));
        expect(errors.map(e => e.property)).toEqual(expect.arrayContaining(['fullName', 'email', 'phone', 'consent']));
        await expect(service.create({ ...dto, phone: '-------' })).rejects.toBeInstanceOf(BadRequestException);
    });
});
