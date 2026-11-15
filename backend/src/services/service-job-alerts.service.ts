import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { eligibleJobProviderWhere } from './service-job-alert-eligibility';

// Do not turn rollout into an email campaign for historical jobs.
export const SERVICE_JOB_ALERTS_FROM = new Date('2026-11-15T16:25:00.000Z');
export const SERVICE_JOB_ALERT_TYPE = 'SERVICE_JOB_AVAILABLE';
@Injectable()
export class ServiceJobAlertsService {
    private readonly logger = new Logger(ServiceJobAlertsService.name);
    private catchingUp = false;
    constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}
    /** Called after commit; failures are recovered by the scheduled sweep. */
    async forJob(jobId: string): Promise<void> {
        try {
            const job = await this.prisma.serviceJob.findUnique({ where: { id: jobId } });
            if (!job || job.status !== 'OPEN' || job.expiresAt <= new Date() || job.createdAt < SERVICE_JOB_ALERTS_FROM) return;
            let cursor: string | undefined;
            do {
                const providers = await this.prisma.contractorCapability.findMany({
                    where: { AND: [eligibleJobProviderWhere(job), { contractor: { user: { notifications: { none: { type: SERVICE_JOB_ALERT_TYPE, entityId: job.id } } } } }] },
                    select: { id: true, contractor: { select: { userId: true } } },
                    orderBy: { id: 'asc' }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                });
                const label = job.serviceType === 'INSPECTION' ? 'inspection' : job.isRecovery ? 'recovery' : 'collection or delivery';
                for (const provider of providers) await this.notifications.create({
                    userId: provider.contractor.userId, type: SERVICE_JOB_ALERT_TYPE,
                    title: `New ${label} job available`,
                    message: `A new ${label} job${job.workPostcodeArea ? ` in the ${job.workPostcodeArea} postcode area` : ''} matches your services. Open the job to review the details and submit a quote.`,
                    entityType: 'SERVICE_JOB', entityId: job.id,
                    data: { jobId: job.id, serviceType: job.serviceType, screen: 'ProviderJobDetail', params: { jobId: job.id } }, link: `/dashboard/service/jobs/${job.id}`,
                }, `service-job:${job.id}:${provider.contractor.userId}`);
                cursor = providers.length === 100 ? providers[providers.length - 1].id : undefined;
            } while (cursor);
        } catch {
            this.logger.warn(`Provider job alerts deferred for retry: ${jobId}`);
        }
    }
    @Cron('* * * * *')
    async recoverPendingAlerts(): Promise<void> {
        if (this.catchingUp) return;
        this.catchingUp = true;
        try {
            let cursor: string | undefined;
            do {
                const jobs = await this.prisma.serviceJob.findMany({ where: {
                    status: 'OPEN', expiresAt: { gt: new Date() }, createdAt: { gte: SERVICE_JOB_ALERTS_FROM }, serviceType: { in: ['DELIVERY', 'INSPECTION'] },
                }, select: { id: true }, orderBy: { id: 'asc' }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
                for (const job of jobs) await this.forJob(job.id);
                cursor = jobs.length === 100 ? jobs[jobs.length - 1].id : undefined;
            } while (cursor);
        } catch { this.logger.warn('Provider job alert recovery deferred until next sweep'); }
        finally { this.catchingUp = false; }
    }
}
