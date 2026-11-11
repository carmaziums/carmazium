import { BadRequestException, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SaleCancellationsService } from './sale-cancellations.service';
import { SaleCancellationsController } from './sale-cancellations.controller';

describe('Admin cancellation visibility and notifications', () => {
    function setup(status = 'PENDING_COUNTERPARTY') {
        const request = {
            id: 'request', listingId: 'listing', sellerId: 'seller', buyerId: 'buyer',
            requestedById: 'buyer', requestedByRole: 'BUYER', status, evidence: [],
        };
        const prisma: any = {
            saleCancellationRequest: {
                findFirst: jest.fn().mockResolvedValue(null),
                findUnique: jest.fn().mockResolvedValue(request),
                findMany: jest.fn().mockResolvedValue([request]),
                create: jest.fn().mockImplementation(async ({ data }) => ({ ...request, ...data, evidence: [] })),
                update: jest.fn().mockImplementation(async ({ data }) => ({ ...request, ...data })),
            },
            user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]) },
        };
        const notifications: any = { create: jest.fn().mockResolvedValue({}) };
        const evidence: any = { storeFiles: jest.fn().mockResolvedValue([]), deletePaths: jest.fn() };
        const service = new SaleCancellationsService(prisma, notifications, {} as any, {} as any, evidence);
        jest.spyOn(service as any, 'context').mockResolvedValue({
            listing: { id: 'listing', title: 'Example car', vrm: 'TEST123' },
            sellerId: 'seller', buyerId: 'buyer', sale: { id: 'sale' },
        });
        jest.spyOn(service as any, 'actor').mockResolvedValue({ canonicalId: 'buyer', dealerActor: null });
        jest.spyOn(service as any, 'hydrate').mockImplementation(async row => row);
        return { service, prisma, notifications, evidence };
    }

    it('notifies every active admin immediately while the request still awaits the seller', async () => {
        const { service, prisma, notifications } = setup();
        const result = await service.create('buyer', { listingId: 'listing', reason: 'BUYER_CHANGED_MIND' }, []);
        expect(result.status).toBe('PENDING_COUNTERPARTY');
        expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { role: 'ADMIN', deletedAt: null }, select: { id: true } });
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'seller', link: '/dashboard/cancellations' }));
        for (const userId of ['admin-1', 'admin-2']) {
            expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
                userId, link: '/dashboard/admin/cancellations', entityId: result.id,
                message: expect.stringContaining('TEST123'),
            }));
        }
    });

    it('does not discard saved evidence when admin recipient lookup fails', async () => {
        const { service, prisma, evidence } = setup();
        const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        prisma.user.findMany.mockRejectedValue(new Error('Temporary lookup failure'));
        evidence.storeFiles.mockResolvedValue([{ storagePath: 'private/evidence', fileName: 'evidence.jpg', mimeType: 'image/jpeg', sizeBytes: 10 }]);
        await expect(service.create('buyer', { listingId: 'listing', reason: 'VEHICLE_FAULT' }, [{}])).resolves.toMatchObject({ status: 'PENDING_COUNTERPARTY' });
        expect(evidence.deletePaths).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalled();
        log.mockRestore();
    });

    it('loads both open statuses, making existing un-escalated requests visible', async () => {
        const { service, prisma } = setup();
        const rows = await service.pendingAdmin();
        expect(prisma.saleCancellationRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { status: { in: ['PENDING_COUNTERPARTY', 'PENDING_ADMIN'] } },
        }));
        expect(rows[0].viewer.canAdminReview).toBe(true);
    });

    it.each(['PENDING_COUNTERPARTY', 'PENDING_ADMIN'])('allows admin approval of %s through the existing reversal flow', async status => {
        const { service } = setup(status);
        const finalize = jest.spyOn(service as any, 'finalize').mockResolvedValue({ status: 'APPROVED' });
        await service.adminReview('request', 'admin', 'APPROVE', 'Evidence reviewed', false);
        expect(finalize).toHaveBeenCalledWith('request', 'admin', 'Evidence reviewed', false);
    });

    it('requires an audit note when overriding the unanswered counterparty stage', async () => {
        const { service } = setup();
        for (const decision of ['APPROVE', 'REJECT'] as const) {
            await expect(service.adminReview('request', 'admin', decision, ' ')).rejects.toBeInstanceOf(BadRequestException);
        }
    });

    it('records the admin rejection and notifies both parties', async () => {
        const { service, prisma, notifications } = setup();
        await service.adminReview('request', 'admin', 'REJECT', 'Reviewed evidence');
        expect(prisma.saleCancellationRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
            status: 'REJECTED', adminReviewedById: 'admin', adminNote: 'Reviewed evidence',
        }) }));
        expect(notifications.create.mock.calls.map(([dto]) => dto.userId).sort()).toEqual(['buyer', 'seller']);
    });

    it('escalates a seller refusal so an admin can still approve, preserving their response', async () => {
        const { service, prisma, notifications } = setup();
        (service as any).actor.mockResolvedValue({ canonicalId: 'seller', dealerActor: null });
        const result = await service.respond('request', 'seller', 'REJECT', 'I disagree');
        expect(result).toMatchObject({
            status: 'PENDING_ADMIN', counterpartRespondedById: 'seller',
            counterpartResponseNote: 'Declined cancellation. I disagree', resolvedAt: null,
        });
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'admin-1', title: 'Disputed sale cancellation needs review' }));
        prisma.saleCancellationRequest.findUnique.mockResolvedValue(result);
        const finalize = jest.spyOn(service as any, 'finalize').mockResolvedValue({ status: 'APPROVED' });
        await service.adminReview('request', 'admin', 'APPROVE', 'Evidence supports cancellation', false);
        expect(finalize).toHaveBeenCalledWith('request', 'admin', 'Evidence supports cancellation', false);
    });

    it.each(['APPROVED', 'REJECTED', 'WITHDRAWN'])('refuses another decision on %s', async status => {
        const { service, prisma } = setup(status);
        await expect(service.adminReview('request', 'admin', 'APPROVE', 'Reviewed')).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.saleCancellationRequest.update).not.toHaveBeenCalled();
    });

    it('derives privileged detail access from the authenticated role only', async () => {
        const service: any = { findOne: jest.fn().mockResolvedValue({}) };
        const controller = new SaleCancellationsController(service);
        await controller.findOne('request', { id: 'admin', role: UserRole.ADMIN });
        expect(service.findOne).toHaveBeenLastCalledWith('request', 'admin', true);
        await controller.findOne('request', { id: 'buyer', role: 'DEALER' });
        expect(service.findOne).toHaveBeenLastCalledWith('request', 'buyer', false);
    });
});
