import { ServiceType } from '@prisma/client';
import { ServicesService } from './services.service';

describe('TradeXchange new-job admin coverage alerts', () => {
    let prisma: any;
    let notify: jest.Mock;
    let service: ServicesService;

    const job = {
        id: 'job-123',
        serviceType: ServiceType.DELIVERY,
        title: 'Collect the vehicle',
        workPostcodeArea: 'RG',
        pickupPostcode: 'RG7 4UX',
        deliveryPostcode: 'RG7 4UX',
    };

    beforeEach(() => {
        prisma = {
            user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]) },
            contractorCapability: { count: jest.fn().mockResolvedValue(2) },
        };
        notify = jest.fn().mockResolvedValue({});
        service = new ServicesService(
            prisma,
            { create: notify } as any,
            { sendBrandedEmail: jest.fn() } as any,
            {} as any,
            { get: jest.fn() } as any,
        );
    });

    it('notifies every active admin exactly once, linking to the job details', async () => {
        await (service as any).notifyAdminsOfNewJob(job);

        expect(prisma.user.findMany).toHaveBeenCalledWith({
            where: { role: 'ADMIN', deletedAt: null }, select: { id: true },
        });
        expect(prisma.contractorCapability.count).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({
                serviceType: ServiceType.DELIVERY,
                OR: expect.arrayContaining([{ jobNationwide: true }]),
            }) }),
        );
        expect(notify).toHaveBeenCalledTimes(2);
        for (const id of ['admin-1', 'admin-2']) {
            expect(notify).toHaveBeenCalledWith(expect.objectContaining({
                userId: id, type: 'SERVICE_JOB_POSTED',
                link: '/dashboard/admin/services/jobs/job-123',
                message: expect.stringContaining('RG7 4UX'),
            }));
        }
        expect(notify.mock.calls[0][0].message).toContain('availability not confirmed');
    });

    it('flags no matching verified provider as an actionable admin alert, without pretending providers are unavailable in real time', async () => {
        prisma.contractorCapability.count.mockResolvedValue(0);
        await (service as any).notifyAdminsOfNewJob({
            ...job, id: 'inspection-5', serviceType: ServiceType.INSPECTION,
            servicePostcode: 'B12 8AB', title: 'Inspect an Audi',
        });

        expect(notify).toHaveBeenCalledTimes(2);
        expect(notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'admin-1',
            type: 'SERVICE_JOB_NEEDS_PROVIDER',
            title: expect.stringContaining('Provider assistance needed'),
            link: '/dashboard/admin/services/jobs/inspection-5',
            message: expect.stringContaining('No currently verified, payout-ready provider matches'),
        }));
        expect(notify.mock.calls[0][0].message).toContain('B12 8AB');
    });

    it('still notifies admins when provider-count discovery fails', async () => {
        prisma.contractorCapability.count.mockRejectedValue(new Error('Provider query timed out'));
        await expect((service as any).notifyAdminsOfNewJob(job)).resolves.toBeUndefined();
        expect(notify).toHaveBeenCalledTimes(2);
        expect(notify.mock.calls[0][0]).toMatchObject({ type: 'SERVICE_JOB_POSTED' });
        expect(notify.mock.calls[0][0].message).toContain('could not be checked');
    });

    it('does not fail a posted job if admin delivery is unavailable', async () => {
        notify.mockRejectedValue(new Error('notifications offline'));
        await expect((service as any).notifyAdminsOfNewJob(job)).resolves.toBeUndefined();
        expect(notify).toHaveBeenCalledTimes(2);
    });

    it('does not emit a job alert if the active admin lookup fails', async () => {
        prisma.user.findMany.mockRejectedValue(new Error('notification recipients unreachable'));
        await expect((service as any).notifyAdminsOfNewJob(job)).resolves.toBeUndefined();
    });
});
