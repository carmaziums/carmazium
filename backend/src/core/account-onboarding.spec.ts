import { getAccountOnboardingGuide } from './account-onboarding';

describe('account onboarding guidance', () => {
    it('explains Personal Account buying and selling without dealer-auction bidding', () => {
        const guide = getAccountOnboardingGuide('BUYER');
        const text = guide.features.join(' ');

        expect(guide.accountLabel).toBe('Personal Account');
        expect(text).toMatch(/free auction listing/i);
        expect(text).toMatch(/£1/i);
        expect(text).toMatch(/do not bid in dealer auctions/i);
    });

    it('explains Partner Account verification, auction fee and service approval', () => {
        const guide = getAccountOnboardingGuide('DEALER');
        const text = guide.features.join(' ');

        expect(guide.accountLabel).toBe('Partner Account');
        expect(text).toMatch(/KYC verification/i);
        expect(text).toMatch(/£125/i);
        expect(text).toMatch(/capability approval/i);
        expect(guide.dashboardPath).toBe('/dashboard/partner');
    });

    it('gives contractors their own service guidance instead of buyer guidance', () => {
        const guide = getAccountOnboardingGuide('CONTRACTOR');
        const text = guide.features.join(' ');

        expect(guide.accountLabel).toBe('Service Partner Account');
        expect(text).toMatch(/capabilit/i);
        expect(text).toMatch(/service/i);
        expect(guide.dashboardPath).toBe('/dashboard/service');
    });

    it('keeps finance and insurance partner guidance distinct', () => {
        const finance = getAccountOnboardingGuide('FINANCE_PARTNER');
        const insurance = getAccountOnboardingGuide('INSURANCE_PARTNER');

        expect(finance.accountLabel).toBe('Finance Partner Account');
        expect(finance.features.join(' ')).toMatch(/finance enquiries/i);
        expect(insurance.accountLabel).toBe('Insurance Partner Account');
        expect(insurance.features.join(' ')).toMatch(/insurance quote requests/i);
    });

    it('uses safe generic guidance for an unknown/internal role', () => {
        const guide = getAccountOnboardingGuide('SOMETHING_NEW');

        expect(guide.accountLabel).toBe('CarMazium Account');
        expect(guide.notificationTitle).toMatch(/Start Here/i);
    });
});
