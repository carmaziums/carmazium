import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DealersService } from './dealers.service';

// Pure, isolated unit tests. No production users, database, mail or Stripe.
describe('Dealership invitations — opt-in and expiry policy', () => {
    const dealer = { id: 'dealer-1', userId: 'owner-1', companyName: 'Test Motors', isVerified: true };
    const pending = (expiresAt: Date, token = 'old-token') => ({
        id: 'invite-1', dealerProfileId: dealer.id, email: 'invited@example.test',
        role: 'SALES_AGENT', token, expiresAt,
    });
    let prisma: any;
    let email: any;
    let service: DealersService;
    let notifications: any;

    beforeEach(() => {
        prisma = {
            dealerProfile: {
                findUnique: jest.fn().mockResolvedValue(dealer),
            },
            user: {
                findUnique: jest.fn().mockResolvedValue(null),
                update: jest.fn().mockResolvedValue({}),
            },
            dealerStaff: {
                findFirst: jest.fn().mockResolvedValue(null),
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({}),
                update: jest.fn().mockResolvedValue({}),
            },
            dealerInvite: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'invite-created', ...data })),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
                delete: jest.fn().mockResolvedValue({}),
            },
            $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
        };
        email = {
            sendStaffInviteEmail: jest.fn().mockResolvedValue({ id: 'mock-mail-provider-id' }),
            sendStaffAddedEmail: jest.fn().mockResolvedValue(undefined),
        };
        notifications = { create: jest.fn().mockResolvedValue({}) };
        service = new DealersService(prisma, email, notifications, { get: jest.fn() } as any);
    });

    const send = async () => service.inviteStaff('owner-1', {
        email: ' Invited@Example.Test ', role: 'SALES_AGENT',
    });

    it('requires explicit acceptance for an EXISTING user — no role elevation or staff creation at invite time', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'invited-user', email: 'invited@example.test', role: 'BUYER' });
        const invite = await send();
        expect(invite).toMatchObject({ email: 'invited@example.test', status: 'PENDING' });
        expect(invite).not.toHaveProperty('token');
        expect(prisma.dealerInvite.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                email: 'invited@example.test', dealerProfileId: dealer.id,
                role: 'SALES_AGENT', token: expect.stringMatching(/^[a-f0-9]{64}$/),
            }),
        });
        expect(prisma.user.update).not.toHaveBeenCalled();
        expect(prisma.dealerStaff.create).not.toHaveBeenCalled();
        expect(prisma.dealerStaff.update).not.toHaveBeenCalled();
        expect(email.sendStaffInviteEmail).toHaveBeenCalledTimes(1);
    });

    it('keeps a previously revoked existing user inactive until they explicitly accept again', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'invited-user', email: 'invited@example.test' });
        prisma.dealerStaff.findUnique.mockResolvedValue({ id: 'inactive-staff', isActive: false });
        await send();
        expect(prisma.dealerStaff.update).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
        expect(prisma.dealerInvite.create).toHaveBeenCalledTimes(1);
    });

    it('rejects invites to already ACTIVE dealership staff and never emails another credential', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'invited-user' });
        prisma.dealerStaff.findUnique.mockResolvedValue({ id: 'already-active', isActive: true });
        await expect(send()).rejects.toThrow('already a staff member');
        expect(prisma.dealerInvite.create).not.toHaveBeenCalled();
        expect(email.sendStaffInviteEmail).not.toHaveBeenCalled();
    });

    it('new-account invitations also stay pending and grant no privileges', async () => {
        const invite = await send();
        expect(invite.status).toBe('PENDING');
        expect(prisma.user.update).not.toHaveBeenCalled();
        expect(prisma.dealerStaff.create).not.toHaveBeenCalled();
    });

    it('rejects an outstanding unexpired invite rather than changing its role or resending it', async () => {
        prisma.dealerInvite.findUnique.mockResolvedValue(pending(new Date(Date.now() + 3600000)));
        await expect(send()).rejects.toThrow('already been sent');
        expect(prisma.dealerInvite.create).not.toHaveBeenCalled();
        expect(prisma.dealerInvite.updateMany).not.toHaveBeenCalled();
        expect(email.sendStaffInviteEmail).not.toHaveBeenCalled();
    });

    it('renews an expired invite atomically with a fresh token and another seven-day expiry', async () => {
        const old = pending(new Date(Date.now() - 60000));
        prisma.dealerInvite.findUnique.mockResolvedValue(old);
        const renewed = await send();
        expect(renewed).toMatchObject({ id: old.id, email: old.email, status: 'PENDING' });
        expect(renewed).not.toHaveProperty('token');
        expect(prisma.dealerInvite.updateMany).toHaveBeenCalledTimes(1);
        const update = prisma.dealerInvite.updateMany.mock.calls[0][0];
        expect(update.where).toEqual({ id: old.id, token: old.token, expiresAt: { lte: expect.any(Date) } });
        expect(update.data.token).toMatch(/^[a-f0-9]{64}$/);
        expect(update.data.token).not.toBe(old.token);
        expect(update.data.role).toBe('SALES_AGENT');
        expect(update.data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
        expect(email.sendStaffInviteEmail).toHaveBeenCalledWith(
            old.email, dealer.companyName, 'SALES_AGENT', update.data.token,
        );
        expect(prisma.dealerInvite.create).not.toHaveBeenCalled();
    });

    it('aborts a lost concurrent renewal race without emailing an unusable token', async () => {
        prisma.dealerInvite.findUnique.mockResolvedValue(pending(new Date(Date.now() - 60000)));
        prisma.dealerInvite.updateMany.mockResolvedValue({ count: 0 });
        await expect(send()).rejects.toThrow('renewed elsewhere');
        expect(email.sendStaffInviteEmail).not.toHaveBeenCalled();
    });

    it('email delivery failure frees the exact failed pending token for a safe retry', async () => {
        email.sendStaffInviteEmail.mockRejectedValue(new Error('provider outage'));
        await expect(send()).rejects.toThrow('Could not email the invitation');
        const created = prisma.dealerInvite.create.mock.results[0].value;
        const invite = await created;
        expect(prisma.dealerInvite.deleteMany).toHaveBeenCalledWith({
            where: { id: invite.id, token: invite.token },
        });
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('also treats a null EmailService delivery result as failed and permits a safe retry', async () => {
        email.sendStaffInviteEmail.mockResolvedValue(null);
        await expect(send()).rejects.toThrow('Could not email the invitation');
        const created = await prisma.dealerInvite.create.mock.results[0].value;
        expect(prisma.dealerInvite.deleteMany).toHaveBeenCalledWith({
            where: { id: created.id, token: created.token },
        });
    });

    it('rejects a dealer staff member without MANAGE_TEAM permissions', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'FINANCE_MANAGER',
            dealerProfile: { id: dealer.id, userId: dealer.userId, isVerified: true },
        });
        await expect(service.inviteStaff('finance-staff', {
            email: 'invited@example.test', role: 'ADMIN',
        })).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.dealerInvite.create).not.toHaveBeenCalled();
    });

    it('accepts only the authenticated recipient email, not any user holding the token', async () => {
        prisma.dealerInvite.findUnique.mockResolvedValue(pending(new Date(Date.now() + 3600000)));
        prisma.user.findUnique.mockResolvedValue({ id: 'wrong-user', email: 'other@example.test' });
        await expect(service.acceptInvite('old-token', 'wrong-user')).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.dealerStaff.create).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects expired or already consumed invitations without creating staff', async () => {
        await expect(service.acceptInvite('consumed', 'invited-user')).rejects.toBeInstanceOf(NotFoundException);
        prisma.dealerInvite.findUnique.mockResolvedValue(pending(new Date(Date.now() - 1000)));
        await expect(service.acceptInvite('expired', 'invited-user')).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.dealerStaff.create).not.toHaveBeenCalled();
    });

    it('elevates an existing user only AFTER authenticated acceptance', async () => {
        prisma.dealerInvite.findUnique.mockResolvedValue(pending(new Date(Date.now() + 3600000)));
        prisma.user.findUnique.mockResolvedValue({ id: 'invited-user', email: 'invited@example.test' });
        await service.acceptInvite('old-token', 'invited-user');
        expect(prisma.dealerStaff.create).toHaveBeenCalledWith({
            data: { userId: 'invited-user', dealerProfileId: dealer.id, role: 'SALES_AGENT' },
        });
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'invited-user' }, data: { role: 'DEALER' },
        });
        expect(prisma.dealerInvite.delete).toHaveBeenCalledWith({ where: { token: 'old-token' } });
    });
});
