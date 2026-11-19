import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
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
            'cancellations-disputes',
            'vehicle-valuation-and-dvla', 'listing-validation-review',
            'listing-status-and-relisting', 'bidding-reserve-and-provisional',
            'checkout-and-platform-payments', 'dealer-purchase-destinations',
            'messaging-notifications', 'mobile-app-and-installation',
            'customer-support',
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

    it('has an existing first-party source file for every knowledge claim', () => {
        const repositoryRoot = resolve(__dirname, '../../..');
        for (const topic of PLATFORM_KNOWLEDGE) {
            for (const source of topic.sources) {
                expect(existsSync(resolve(repositoryRoot, source))).toBe(true);
            }
        }
    });

    it.each([
        ['how do I edit my existing car listing and change the photos?', 'edit-existing-listing'],
        ['how can I change my listing price?', 'edit-existing-listing'],
        ['my listing is pending approval, why not live?', 'listing-validation-review'],
        ['I want to relist after reserve was not met', 'listing-status-and-relisting'],
        ['what happens after an auction bid below reserve?', 'bidding-reserve-and-provisional'],
        ['where do I see my dealer auction wins and receipts?', 'dealer-purchase-destinations'],
        ['I need to make a card payment for the platform fee', 'checkout-and-platform-payments'],
        ['where are my messages and notifications?', 'messaging-notifications'],
        ['how do I download the Android app?', 'mobile-app-and-installation'],
        ['why is the DVLA lookup giving no car valuation?', 'vehicle-valuation-and-dvla'],
    ])('retrieves priority evidence for the actual workflow: %s', (question, expectedTopic) => {
        const output = platformKnowledgeFor(question, 1);
        expect(output).toContain('[' + expectedTopic + ']');
    });

    it('never fills every answer with generic account context when a specific task exists', () => {
        const output = platformKnowledgeFor('I am a seller and I want to edit my listing', 1);
        expect(output).toContain('[edit-existing-listing]');
        expect(output).not.toContain('[accounts-and-roles]');
    });

    it('explains account filters without expanding assistant account access', () => {
        const output = platformKnowledgeFor('How can I filter accounts?');
        expect(output).toContain('/dashboard/admin/users');
        expect(output).toContain('Dealer KYC, current service approval and email verification are separate');
        expect(output).toContain('does not give MaziuM permission to search other users');
        expect(hasUnverifiedNavigationPath('Open /dashboard/admin/users')).toBe(false);
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
        expect(hasUnverifiedNavigationPath('Use https://www.carmazium.com/pricing')).toBe(false);
        expect(hasUnverifiedNavigationPath('Look in /dashboard/dealer/purchases/history')).toBe(false);
        expect(hasUnverifiedNavigationPath('Open /notifications to see alerts')).toBe(false);
        expect(hasUnverifiedNavigationPath('Administrators can view [Auctions](/dashboard/admin/auctions)')).toBe(false);
        expect(hasUnverifiedNavigationPath('Go to /dashboard/admin/impersonate')).toBe(true);
        expect(hasUnverifiedNavigationPath('Go to /dashboard/dealer/listings to edit')).toBe(true);
        expect(hasUnverifiedNavigationPath('Go to /dashboard/user/cars/edit/123')).toBe(true);
        expect(hasUnverifiedNavigationPath('Open /dashboard/dealer/add-listing?editId=madeup')).toBe(true);
    });
    it.each([
        'Choose collection/delivery or inspection at /services/jobs/new.',
        'Accept/reject an offer from /dashboard/seller/auctions.',
        'Open [Offers Received](/dashboard/user?tab=offers).',
        'Outgoing offers are at /dashboard/user?tab=bids.',
        'Saved Cars: /dashboard/user?tab=watchlist. Purchases: /dashboard/user?tab=purchases.',
        'Use /auth/forgot-password if you cannot sign in at /auth/login.',
    ])('does not mistake ordinary slash-separated prose for a website path: %s', answer => {
        expect(hasUnverifiedNavigationPath(answer)).toBe(false);
    });
    it.each(['Open (/invented).', 'Use [help](/dashboard/fake).', 'Go to https://www.carmazium.com/fake'])('still blocks invented routes: %s', answer => {
        expect(hasUnverifiedNavigationPath(answer)).toBe(true);
    });
    it('retrieves actual photo limits and payout setup instructions', () => {
        expect(platformKnowledgeFor('My photos will not upload')).toContain('50MB');
        expect(platformKnowledgeFor('How do I set up payouts?')).toContain('Stripe Connect');
    });
});
