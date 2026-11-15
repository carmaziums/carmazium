import { BadRequestException } from '@nestjs/common';
import { Prisma, ServiceType, UserRole } from '@prisma/client';

/** Preferences never grant work access; existing legacy contractor accounts retain their approval flow. */
export function dealerServiceEligibilityWhere(): Prisma.ContractorCapabilityWhereInput {
    // Reuse the original dealer fee, including admin-approved legacy bank payments.
    // Service setup and annual evidence renewal never require another £1 payment.
    const eligible = { isVerified: true, deletedAt: null, kyc: { is: { status: 'APPROVED' as const, OR: [
        { stripeChargedAt: { not: null } },
        { documentStatuses: { path: ['paymentReference', 'status'], equals: 'APPROVED' } },
        { documentStatuses: { path: ['paymentScreenshot', 'status'], equals: 'APPROVED' } },
    ] } } };
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
    const paymentStatuses = dealer?.kyc?.documentStatuses;
    const feeAlreadyPaid = !!dealer?.kyc?.stripeChargedAt
        || paymentStatuses?.paymentReference?.status === 'APPROVED'
        || paymentStatuses?.paymentScreenshot?.status === 'APPROVED';
    if (!dealer?.isVerified || dealer.deletedAt || dealer.kyc?.status !== 'APPROVED' || !feeAlreadyPaid) {
        throw new BadRequestException('Complete dealer business KYC and the one-time £1 account verification payment. If already paid, no further verification payment is required.');
    }
    const key = serviceType === ServiceType.DELIVERY ? 'deliveryServicesEnabled' : 'inspectionServicesEnabled';
    if (dealer[key] === false) throw new BadRequestException('Turn this service on in My dealership services before taking new jobs.');
}
