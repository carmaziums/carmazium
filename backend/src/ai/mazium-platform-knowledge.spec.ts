import { PLATFORM_KNOWLEDGE, platformKnowledgeFor } from './mazium-platform-knowledge';
import {
    VERIFIED_SITE_NAVIGATION,
    verifiedNavigationReply,
    hasUnverifiedNavigationPath,
} from './mazium-site-navigation';

describe('MaziuM source-verified public platform knowledge', () => {
    it('covers every main customer role and public workflow', () => {
        const required = [
            'accounts-and-roles', 'create-new-listing', 'edit-existing-listing',
            'sell-caravan-campervan', 'retail-listing-packages', 'dealer-auctions',
            'sale-handover-reward', 'retail-buyer-offers', 'buyer-and-dealer-purchases',
            'verification-and-kyc', 'warranty', 'vehicle-finance',
            'tradexchange-jobs', 'dealer-services-and-partners',
            'search-buying', 'account-security-privacy',
            'cancellations-disputes', 'customer-support',
        ];
        expect(PLATFORM_KNOWLEDGE.map(t => t.id)).toEqual(required);
        for (const topic of PLATFORM_KNOWLEDGE) {
            expect(topic.facts.length).toBeGreaterThan(150);
            expect(topic.sources.length).toBeGreaterThan(0);
            expect(topic.sources.every(s => s.includes('/'))).toBe(true);
        }
    });

    it.each([
        ['how can i update existing listing?', 'edit-existing-listing'],
        ['How do I list my campervan?', 'sell-caravan-campervan'],
        ['What is the premium retail package?', 'retail-listing-packages'],
        ['I won an auction, what is the buyer fee?', 'dealer-auctions'],
        ['When is my £100 reward paid?', 'sale-handover-reward'],
        ['How do I post a TradeXchange job?', 'tradexchange-jobs'],
        ['How can I apply for Jigsaw Finance?', 'vehicle-finance'],
        ['How do I get a Warrantywise quote?', 'warranty'],
        ['How can I update my bank payout details?', 'account-security-privacy'],
        ['I want to cancel my auction purchase', 'cancellations-disputes'],
    ])('retrieves verified %s guidance: %s', (question, topic) => {
        expect(platformKnowledgeFor(question)).toContain('[' + topic + ']');
    });

    it('never treats a new listing path as the editor', () => {
        const reply = verifiedNavigationReply('how can i update existing listing?');
        expect(reply).toContain('/dashboard/user?tab=cars');
        expect(reply).toContain('/dashboard/dealer/inventory');
        expect(reply).toContain('rather than starting again at /sell');
        expect(VERIFIED_SITE_NAVIGATION).toContain('DO NOT');
    });

    it('avoids intercepting unrelated changes or normal search', () => {
        expect(verifiedNavigationReply('Change my password')).toBeNull();
        expect(verifiedNavigationReply('Show me SUVs under £15,000')).toBeNull();
        expect(verifiedNavigationReply('How do I list my car for the first time?')).toBeNull();
    });

    it('keeps verified website navigation while withholding invented routes and edit IDs', () => {
        expect(hasUnverifiedNavigationPath('Go to /dashboard/user?tab=cars then Edit')).toBe(false);
        expect(hasUnverifiedNavigationPath('Go to /dashboard/dealer/inventory and select Edit')).toBe(false);
        expect(hasUnverifiedNavigationPath('Use https://www.carmazium.com/pricing')).toBe(true); // only verified routes
        expect(hasUnverifiedNavigationPath('Go to /dashboard/dealer/listings to edit')).toBe(true);
        expect(hasUnverifiedNavigationPath('Go to /dashboard/user/cars/edit/123')).toBe(true);
        expect(hasUnverifiedNavigationPath('Open /dashboard/dealer/add-listing?editId=madeup')).toBe(true);
    });
});
