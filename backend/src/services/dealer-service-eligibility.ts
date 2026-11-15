import { BadRequestException } from '@nestjs/common';
import { Prisma, ServiceType, UserRole } from '@prisma/client';

/** Preferences never grant work access; existing legacy contractor accounts retain their approval flow. */
export function dealerServiceEligibilityWhere(): Prisma.ContractorCapabilityWhereInput {
    const eligible = { isVerified: true, deletedAt: null, kyc: { is: { status: 'APPROVED' as const, stripeChargedAt: { not: null } } } };
    return { OR: [
        { contractor: { user: { dealerProfile: { is: null }, role: { not: UserRole.DEALER } } } },
        { serviceType: ServiceType.DELIVERY, contractor: { user: { dealerProfile: { is: { ...eligible, deliveryServicesEnabled: true } } } } },
        { serviceType: ServiceType.INSPECTION, contractor: { user: { dealerProfile: { is: { ...eligible, inspectionServicesEnabled: true } } } } },
        { serviceType: { in: [ServiceType.FINANCE, ServiceType.WARRANTY] } },
    ] };
}

export function assertDealerServiceReady(user: any, serviceType: ServiceType) {
    if (![ServiceType.DELIVERY, ServiceType.INSPECTION].includes(serviceType as any)) return;
    if (user?.role !== UserRole.DEALER && !user?.dealerProfile) return;
    const dealer = user.dealerProfile;
    if (!dealer?.isVerified || dealer.deletedAt || dealer.kyc?.status !== 'APPROVED' || !dealer.kyc?.stripeChargedAt) {
        throw new BadRequestException('Complete business KYC and the £1 dealer verification payment before taking paid jobs.');
    }
    const key = serviceType === ServiceType.DELIVERY ? 'deliveryServicesEnabled' : 'inspectionServicesEnabled';
    if (dealer[key] === false) throw new BadRequestException('Turn this service on in My dealership services before taking new jobs.');
}
