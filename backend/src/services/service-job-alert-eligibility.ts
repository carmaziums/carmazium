import { Prisma, ServiceType } from '@prisma/client';
import { verifiedCapabilityWhere } from './capability-verification';
import { dealerServiceEligibilityWhere } from './dealer-service-eligibility';

export interface AlertJob { serviceType: ServiceType; customerId: string; workPostcodeArea: string | null; inspectionScope?: string | null; }
/** Reuse approval, opt-in, payout and postcode gates; never alert the customer. */
export function eligibleJobProviderWhere(job: AlertJob, now = new Date()): Prisma.ContractorCapabilityWhereInput {
    return {
        serviceType: job.serviceType, ...verifiedCapabilityWhere(now),
        AND: [dealerServiceEligibilityWhere(), { serviceType: { in: ['DELIVERY', 'INSPECTION'] } },
            ...(job.serviceType === ServiceType.INSPECTION ? [{
                inspectionScopes: job.inspectionScope === 'BOTH'
                    ? { hasEvery: ['VEHICLE', 'COSMETIC'] } : { has: job.inspectionScope || 'VEHICLE' },
            }] : []),
        ],
        contractor: { deletedAt: null, user: {
            id: { not: job.customerId }, deletedAt: null,
            stripeConnectAccountId: { not: null }, stripeConnectOnboardingComplete: true,
        } },
        OR: [{ jobNationwide: true }, ...(job.workPostcodeArea ? [{ jobPostcodeAreas: { has: job.workPostcodeArea } }] : [])],
    };
}
