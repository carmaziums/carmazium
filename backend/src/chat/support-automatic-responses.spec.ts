import { classifySupportMessage, safeAutomaticSupportReply } from './mazium-support-policy';
import { fixedSupportReply, supportReplyPlan, supportNeedsHumanReply, HUMAN_HANDOFF_REPLY, HUMAN_REVIEW_REPLY, SUPPORT_UNAVAILABLE_REPLY, SUPPORT_HELP_OFFER, SUPPORT_HELP_ACCEPTED } from './support-automatic-responses';

describe('automatic support answers', () => {
    const now = new Date();
    it('acknowledges a human request after opt-out without model consent', () => {
        expect(supportReplyPlan({ supportAiOptedOutAt: now, supportHumanTakeoverAt: now }, "I'd like to speak to a human support agent, please.", now)).toEqual({ kind: 'FIXED', reply: HUMAN_HANDOFF_REPLY });
        expect(HUMAN_HANDOFF_REPLY).not.toMatch(/joined|available now|shortly|minutes/i);
    });
    it.each(['hi can you help me'])('provides useful local support without a dispatcher: %s', text => {
        const plan = supportReplyPlan({}, text, now);
        expect(plan?.kind).toBe('FIXED');
        if (plan?.kind === 'FIXED') {
            expect(plan.reply.length).toBeGreaterThan(10);
            expect(plan.reply).not.toBe(SUPPORT_UNAVAILABLE_REPLY);
        }
    });
    it.each(['How much does a retail listing cost?', 'How do I list my car?', 'How many photos do I need?', 'Where do I download the app?'])('answers common questions without referring them to a person: %s', text => {
        expect(supportReplyPlan({}, text, now)?.kind).toBe('AI');
        expect(fixedSupportReply(text)).toBeNull();
    });
    it.each(['How does identity verification work?', 'How do I reset my password?', 'Why can I not log in?', 'I have a complaint about uploading photos'])('does not confuse routine help with approval: %s', text => {
        expect(classifySupportMessage(text).action).toBe('DRAFT');
    });
    it.each(['Refund my fee', 'Can you waive the payment?', 'Delete my account'])('routes decisions to staff with a receipt: %s', text => {
        expect(supportReplyPlan({}, text, now)).toEqual({ kind: 'FIXED', reply: HUMAN_REVIEW_REPLY });
    });
    it.each(['How many photos do I need for a caravan?', 'How many photos for a campervan?', 'Where is my £100 reward?', 'I want to upload a car and arrange collection'])('lets the model retrieve specific workflows: %s', text => {
        expect(supportReplyPlan({}, text, now)?.kind).toBe('AI');
    });
    it('respects explicit opt-out and current staff conversation', () => {
        expect(supportReplyPlan({ supportAiOptedOutAt: now }, 'How much to list?', now)).toBeNull();
        expect(supportReplyPlan({ supportHumanTakeoverAt: now }, 'How much to list?', now)).toBeNull();
        expect(supportReplyPlan({ supportHumanTakeoverAt: new Date(now.getTime() - 3600000) }, 'How much to list my car?', now)?.kind).toBe('AI');
    });
    it('answers general unmatched questions with MaziuM by default, without an opt-in panel', () => {
        const text = 'Why does the app close when I select a photo?';
        expect(supportReplyPlan({}, text, now)).toEqual({ kind: 'AI' });
        expect(supportReplyPlan({ supportAiConsentAt: new Date(now.getTime() + 1000) }, text, now)).toEqual({ kind: 'AI' });
        expect(supportReplyPlan({ supportAiOptedOutAt: now }, text, now)).toBeNull();
    });
    it.each([
        'Please put me through to customer service',
        'I want to speak with the support department',
        'Please connect me with your team',
        'I would prefer a human being',
    ])('hands a natural request to staff without requiring a button: %s', text => {
        expect(supportReplyPlan({}, text, now)).toEqual({ kind: 'FIXED', reply: SUPPORT_HELP_OFFER });
        expect(supportReplyPlan({ supportHelpOffered: true }, text, now)).toEqual({ kind: 'FIXED', reply: HUMAN_HANDOFF_REPLY });
    });
    it.each([
        'Please email me at customer@example.com about my account',
        'My phone number is 07911 123456, can you call me?',
        'I need to discuss my medical condition with customer support',
        'My date of birth is in the listing details',
    ])('does not send obvious personal details to the external AI model: %s', text => {
        expect(classifySupportMessage(text).action).toBe('ESCALATE');
        expect(supportReplyPlan({}, text, now)).toEqual({ kind: 'FIXED', reply: HUMAN_REVIEW_REPLY });
    });
    it.each(['I will refund you £100.', 'Your payout has been approved.', "I'm a human agent.", 'Send us your password.'])('blocks unsupported commitments: %s', reply => expect(safeAutomaticSupportReply(reply)).toBe(false));
    it('allows factual fee information', () => expect(safeAutomaticSupportReply('A Basic retail listing costs £1 until sold.')).toBe(true));
    it.each([
        'how can i update existing listing?',
        'how do I change my car advert details?',
        'where can I edit my listing price?',
    ])('gives the correct existing-listing editor in official customer support: %s', text => {
        expect(supportReplyPlan({}, text, now)?.kind).toBe('AI');
    });

    it('keeps only pending handoffs and unresolved questions in the staff queue', () => {
        expect(supportNeedsHumanReply(null)).toBe(false);
        expect(supportNeedsHumanReply({ aiGenerated: false, content: 'Question', sender: { role: 'BUYER' } })).toBe(true);
        expect(supportNeedsHumanReply({ aiGenerated: false, content: 'Staff reply', sender: { role: 'ADMIN' } })).toBe(false);
        expect(supportNeedsHumanReply({ aiGenerated: true, content: 'A basic listing costs £1', sender: { role: 'BUYER' } })).toBe(false);
        expect(supportNeedsHumanReply({ aiGenerated: true, content: HUMAN_HANDOFF_REPLY })).toBe(true);
        expect(supportNeedsHumanReply({ aiGenerated: true, content: HUMAN_REVIEW_REPLY })).toBe(true);
        expect(supportNeedsHumanReply({ aiGenerated: true, content: SUPPORT_UNAVAILABLE_REPLY })).toBe(true);
    });

});

describe('conversation-first support handoff', () => {
    const now = new Date();
    it.each(['I still want a human', 'Stop the bot', "I don't want to talk to a bot", 'Just connect me to customer support'])('does not obstruct a firm request: %s', text => {
        expect(supportReplyPlan({}, text, now)).toEqual({ kind: 'FIXED', reply: HUMAN_HANDOFF_REPLY });
    });
    it('hands off yes only in response to its own offer', () => {
        expect(supportReplyPlan({}, 'yes please', now)).toEqual({ kind: 'AI' });
        expect(supportReplyPlan({ supportHelpOfferPending: true }, 'yes please', now)).toEqual({ kind: 'FIXED', reply: HUMAN_HANDOFF_REPLY });
        expect(supportReplyPlan({ supportHelpOfferPending: true }, 'no thanks', now)).toEqual({ kind: 'FIXED', reply: SUPPORT_HELP_ACCEPTED });
    });
    it('continues helping when a customer explains the issue after the offer', () => {
        expect(supportReplyPlan({ supportHelpOffered: true }, 'i want to upload a car', now)?.kind).toBe('AI');
    });
    it.each(['I already tried uploading a car but it failed', 'How much is a listing? Also how do I edit one?'])('does not bury a complex problem under generic FAQs: %s', text => {
        expect(supportReplyPlan({}, text, now)).toEqual({ kind: 'AI' });
    });
    it('keeps sensitive handoff requests out of the persuasion step', () => {
        expect(supportReplyPlan({}, 'I want a human to refund my fee', now)).toEqual({ kind: 'FIXED', reply: HUMAN_HANDOFF_REPLY });
    });
    it('does not claim a human is queued while offering automatic help', () => {
        expect(supportNeedsHumanReply({ aiGenerated: true, content: SUPPORT_HELP_OFFER })).toBe(false);
        expect(HUMAN_HANDOFF_REPLY).not.toContain('higher volume');
    });
});
