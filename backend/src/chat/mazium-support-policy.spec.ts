import { canAutoReplyToSupport, canPrepareSupportDraft, classifySupportMessage } from './mazium-support-policy';

describe('MaziuM support safety policy', () => {
    it.each([
        'Please refund my listing fee',
        'I want to dispute this sale',
        'Change my bank account',
        'Delete my account',
        'Can you waive the fee?',
        'I need a solicitor',
        'My OTP is 123456',
        'My account was hacked',
        'I need a chargeback',
        'I want to request GDPR data erasure',
        'Please send your bank transfer details',
        'I will take this to trading standards',
    ])('escalates sensitive requests: %s', (message) => {
        expect(classifySupportMessage(message).action).toBe('ESCALATE');
    });

    it('permits routine support questions for drafting only', () => {
        expect(classifySupportMessage('How do I list my car for retail?')).toEqual({
            action: 'DRAFT',
            reason: 'ROUTINE_SUPPORT',
        });
    });

    const eligible = {
        context: 'SUPPORT',
        supportClosedAt: null,
        humanAssigned: false,
        latestSenderIsCustomer: true,
        alreadyRepliedToLatestMessage: false,
        consentToAi: true,
    };

    it('requires all eligibility conditions', () => {
        expect(canPrepareSupportDraft(eligible)).toBe(true);
        expect(canPrepareSupportDraft({ ...eligible, context: 'VEHICLE' })).toBe(false);
        expect(canPrepareSupportDraft({ ...eligible, humanAssigned: true })).toBe(false);
        expect(canPrepareSupportDraft({ ...eligible, supportClosedAt: new Date() })).toBe(false);
        expect(canPrepareSupportDraft({ ...eligible, latestSenderIsCustomer: false })).toBe(false);
        expect(canPrepareSupportDraft({ ...eligible, alreadyRepliedToLatestMessage: true })).toBe(false);
        expect(canPrepareSupportDraft({ ...eligible, consentToAi: false })).toBe(false);
    });
    it('fails closed for automatic delivery unless every safeguard passes', () => {
        const eligibleAuto = {
            enabled: true,
            context: 'SUPPORT',
            roomClosed: false,
            roomDeleted: false,
            aiDisclosedAndConsented: true,
            optedOut: false,
            humanTakeover: false,
            latestMessageFromCustomer: true,
            latestMessageHasAttachment: false,
            latestMessageIdMatches: true,
            alreadyProcessed: false,
            withinRateAndBudgetLimits: true,
            incomingMessage: 'How do I list my car?',
            proposedReply: 'You can create a retail listing for £1.',
        };
        expect(canAutoReplyToSupport(eligibleAuto)).toBe(true);
        expect(canAutoReplyToSupport({ ...eligibleAuto, enabled: false })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, context: 'RETAIL' })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, aiDisclosedAndConsented: false })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, optedOut: true })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, humanTakeover: true })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, latestMessageIdMatches: false })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, alreadyProcessed: true })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, withinRateAndBudgetLimits: false })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, incomingMessage: 'Refund my fee' })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, proposedReply: 'I will refund your fee' })).toBe(false);
    });

});
