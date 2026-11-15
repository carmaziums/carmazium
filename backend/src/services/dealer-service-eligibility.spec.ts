import { ServiceType } from '@prisma/client';
import { assertDealerServiceReady, dealerServiceEligibilityWhere } from './dealer-service-eligibility';

describe('dealer job eligibility', () => {
    const ready = () => ({ role: 'DEALER', dealerProfile: { isVerified: true, deletedAt: null, deliveryServicesEnabled: true, inspectionServicesEnabled: true, kyc: { status: 'APPROVED', stripeChargedAt: new Date() } } });
    it.each([ServiceType.DELIVERY, ServiceType.INSPECTION])('accepts verified, paid and enabled dealer %s', type => {
        expect(() => assertDealerServiceReady(ready(), type)).not.toThrow();
    });
    it.each([ServiceType.DELIVERY, ServiceType.INSPECTION])('blocks enabled but unpaid or unverified dealer %s', type => {
        const unpaid = ready(); unpaid.dealerProfile.kyc.stripeChargedAt = null as any;
        expect(() => assertDealerServiceReady(unpaid, type)).toThrow(/£1/);
        const unverified = ready(); unverified.dealerProfile.isVerified = false;
        expect(() => assertDealerServiceReady(unverified, type)).toThrow(/KYC/);
    });
    it('turning off one job service leaves the other eligible', () => {
        const user = ready(); user.dealerProfile.deliveryServicesEnabled = false;
        expect(() => assertDealerServiceReady(user, ServiceType.DELIVERY)).toThrow(/Turn this service on/);
        expect(() => assertDealerServiceReady(user, ServiceType.INSPECTION)).not.toThrow();
    });
    it('cannot bypass dealer checks by changing account role', () => {
        const user = ready(); user.role = 'CONTRACTOR'; user.dealerProfile.isVerified = false;
        expect(() => assertDealerServiceReady(user, ServiceType.DELIVERY)).toThrow(/KYC/);
    });
    it('keeps finance/warranty partnerships and legacy contractor approval flows separate', () => {
        expect(() => assertDealerServiceReady({ role: 'DEALER' }, ServiceType.FINANCE)).not.toThrow();
        expect(() => assertDealerServiceReady({ role: 'CONTRACTOR' }, ServiceType.INSPECTION)).not.toThrow();
    });
    it('applies payment, KYC and opt-out filters to dealer job discovery and quoting', () => {
        const where = dealerServiceEligibilityWhere();
        for (const [serviceType, field] of [[ServiceType.DELIVERY, 'deliveryServicesEnabled'], [ServiceType.INSPECTION, 'inspectionServicesEnabled']] as const) {
            expect(where.OR).toContainEqual({ serviceType, contractor: { user: { dealerProfile: { is: { isVerified: true, deletedAt: null, [field]: true, kyc: { is: { status: 'APPROVED', stripeChargedAt: { not: null } } } } } } } });
        }
    });
});
