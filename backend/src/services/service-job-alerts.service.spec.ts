import { ServiceJobAlertsService, SERVICE_JOB_ALERTS_FROM } from './service-job-alerts.service';
import { eligibleJobProviderWhere } from './service-job-alert-eligibility';

describe('New job provider alerts', () => {
    const job = { id: 'job', customerId: 'customer', serviceType: 'DELIVERY', workPostcodeArea: 'B', isRecovery: false, status: 'OPEN', createdAt: new Date(SERVICE_JOB_ALERTS_FROM.getTime()+1000), expiresAt: new Date('2099-01-01') };
    let db: any, notifications: any, service: ServiceJobAlertsService;
    beforeEach(() => {
        db = { serviceJob: { findUnique: jest.fn().mockResolvedValue(job), findMany: jest.fn().mockResolvedValue([{ id: 'job' }]) }, contractorCapability: { findMany: jest.fn().mockResolvedValue([{ id: 'cap', contractor: { userId: 'provider' } }]) } };
        notifications = { create: jest.fn().mockResolvedValue({}) };
        service = new ServiceJobAlertsService(db, notifications);
    });
    it('creates one durable account/email notification with a direct job link and retry key', async () => {
        await service.forJob('job');
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'provider', type: 'SERVICE_JOB_AVAILABLE', entityId: 'job', link: '/dashboard/service/jobs/job' }), 'service-job:job:provider');
        expect(notifications.create.mock.calls[0][0].message).not.toContain('customer');
    });
    it.each(['ACCEPTED','CANCELLED','EXPIRED'])('does not announce %s jobs', async status => {
        db.serviceJob.findUnique.mockResolvedValue({ ...job, status }); await service.forJob('job'); expect(notifications.create).not.toHaveBeenCalled();
    });
    it('does not announce expired or historical jobs', async () => {
        db.serviceJob.findUnique.mockResolvedValue({ ...job, expiresAt: new Date(0) }); await service.forJob('job');
        db.serviceJob.findUnique.mockResolvedValue({ ...job, createdAt: new Date(0) }); await service.forJob('job');
        expect(notifications.create).not.toHaveBeenCalled();
    });
    it('recovers failures on the next sweep without failing job creation', async () => {
        notifications.create.mockRejectedValueOnce(new Error('temporary')); await expect(service.forJob('job')).resolves.toBeUndefined();
        await service.recoverPendingAlerts(); expect(notifications.create).toHaveBeenCalledTimes(2);
    });
    it.each([['INSPECTION',false,'inspection'],['DELIVERY',true,'recovery']])('labels %s recovery=%s correctly', async (serviceType,isRecovery,label) => {
        db.serviceJob.findUnique.mockResolvedValue({ ...job, serviceType,isRecovery }); await service.forJob('job');
        expect(notifications.create.mock.calls[0][0].title).toBe(`New ${label} job available`);
    });
    it('requires opt-in, current approval, payout readiness and matching coverage, excludes customer', () => {
        const query = eligibleJobProviderWhere(job as any);
        expect(query).toMatchObject({ status:'APPROVED', verificationStatus:'VERIFIED', contractor:{user:{id:{not:'customer'},stripeConnectOnboardingComplete:true,deletedAt:null}} });
        expect(JSON.stringify(query)).toContain('deliveryServicesEnabled'); expect(JSON.stringify(query)).toContain('stripeChargedAt');
        expect(query.OR).toEqual([{jobNationwide:true},{jobPostcodeAreas:{has:'B'}}]);
        expect(eligibleJobProviderWhere({...job,workPostcodeArea:null} as any).OR).toEqual([{jobNationwide:true}]);
    });
});
