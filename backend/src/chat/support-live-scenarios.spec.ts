import { classifySupportMessage } from './mazium-support-policy';
import { supportReplyPlan, SUPPORT_HELP_OFFER, HUMAN_HANDOFF_REPLY } from './support-automatic-responses';

/** Regression matrix from the signed-in Messages audit. These assert routing,
 * not model answer quality; real generated answers are checked separately. */
describe('customer support journey routing', () => {
    it.each([
        'hi can you help me',
        'how can i updat existing listing?',
        'I am a private seller. I want to change the price but I cannot see Edit. What should I do?',
        'How do I set up my payouts to receive the seller reward?',
        'Where is my £100 reward?', 'My payout has not arrived',
        'How can I update my bank details in settings?',
        'How does the £100 seller reward work and when does a seller qualify?',
        'What is the refund policy?',
        'How do I request a refund?',
        'Yes please',
        'I am not a dealer. Can I bid on auction cars?',
        'But I want to buy from auctions. Can you make an exception?',
        'How can I list a caravan without a registration number and how many photos do I need?',
        'What about a campervan?',
        'I uploaded 10 photos but it still says photos missing. I am using Chrome on Android. What can I try?',
        'How do I relist my car after the auction ends without meeting reserve?',
        'How can I accept an offer below my reserve?',
        'Where do I find offers received and how do I reply to the buyer?',
        'What are the retail packages and is there a monthly subscription?',
        'The DVLA lookup gives no result for my registration. How can I continue?',
        'How do I get a delivery quote through TradeXchange?',
        'How do I apply for finance on a car?',
        'How can I reset my password?',
        'My password reset link has expired',
        'Where can I download the app?',
        'How can I view my saved cars?',
        'How do I turn off email notifications?',
        'How can I mark my car sold elsewhere?',
        'What happens when the reserve is not met?',
        'Can I use a sole trader account?',
        'What documents are needed for verification?',
        'How much does a warranty cost?',
        'How can a provider quote on a job?',
        'How do I enable the finance badge on my listings?',
        'My listing says pending review. What does that mean?',
        'Can I edit a listing with active bids?',
        'I tried refreshing already and the page is still blank',
    ])('keeps informational questions in the assistant: %s', question => {
        expect(classifySupportMessage(question).action).toBe('DRAFT');
    });
    it.each([
        'How do I request a refund if I paid twice for a listing?',
        'Please refund my listing fee', 'Release my payout now',
        'How do payouts work? Also transfer my money now.',
        'Can you guarantee finance approval and approve my dealer verification now?',
        'Change my bank account', 'Delete my account', 'My account was hacked',
        'My OTP is 123456', 'My password is synthetic-test-value',
        'My email is synthetic@example.com', 'My bank details are 00-00-00',
        'My bank details: 00-00-00', 'My sort code=00-00-00',
    ])('routes private details and decisions to staff: %s', question => {
        expect(classifySupportMessage(question).action).toBe('ESCALATE');
    });
    it('offers help once and honours a confirmation or firm refusal', () => {
        const now = new Date();
        expect(supportReplyPlan({}, 'I want to talk to a human', now)).toEqual({kind:'FIXED',reply:SUPPORT_HELP_OFFER});
        expect(supportReplyPlan({supportHelpOffered:true,supportHelpOfferPending:true}, 'yes please', now)).toEqual({kind:'FIXED',reply:HUMAN_HANDOFF_REPLY});
        expect(supportReplyPlan({}, 'Stop AI, I only want a human', now)).toEqual({kind:'FIXED',reply:HUMAN_HANDOFF_REPLY});
    });
});
