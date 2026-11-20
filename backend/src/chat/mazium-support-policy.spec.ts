import { canAutoReplyToSupport, canPrepareSupportDraft, classifySupportMessage, supportAutoReplyClientMessageId, requestsHumanSupport, isInboundCustomerSupportMessage } from './mazium-support-policy';

describe('MaziuM support safety policy', () => {
    it.each([
        'Android QA - For that same retail advert if I change the price will it automatically approve the listing and release my 100 pound seller reward',
        'Does editing my advert approve my listing and release my reward?',
        'Will that approve my listing and then release my bonus?',
        'For that same advert, if I just change the price, does that automatically approve it and activate a £100 bonus? Please keep the distinction between a retail advert and an auction sale.',
        'Does paying for my warranty automatically issue my policy?',
        'My delivery is marked COMPLETED but the driver never came. Can I just leave it unconfirmed and send a chat message next week to stop the money being released? Explain what I should do now without changing the job.',
        'Can I upload a screenshot and send a message about my payment?',
        'Who can release my payout after approval?',
        'Does the team approve my listing before it is visible?',
        'How does the team refund a payment?',
        'I do not want to talk to a human. I want you to explain whether a Finance Manager in a verified dealership can bid, and who can pay the buyer fee.',
        "I don't need a human, please explain retail fees.",
        'I don’t want to speak to a real person. Can you check my listing?',
        'Please do not connect me to customer support. Explain my options.',
        'I want you to explain what a Finance Manager can do.',
        'I need to know whether a dealership manager can list cars.',
    ])('does not confuse negated contact or role questions with human requests: %s', message => {
        expect(requestsHumanSupport(message)).toBe(false);
        expect(classifySupportMessage(message).action).toBe('DRAFT');
    });
    it.each([
        "I don't want a human for the fees, but connect me to a person for my complaint.",
        'I don’t want to talk to an AI. Connect me to support.',
        'Please transfer me to your manager.',
        'I need a human to help with my listing.',
        'I want to speak with a supervisor.',
    ])('preserves explicit contact requests including a later change of mind: %s', message => {
        expect(requestsHumanSupport(message)).toBe(true);
    });
    it.each(['I am a finance manager. Why can I not bid?', 'Is the assistant a human or AI?', 'Can a dealership manager list cars?'])('keeps ordinary role and identity questions with AI: %s', message => {
        expect(requestsHumanSupport(message)).toBe(false);
        expect(classifySupportMessage(message).action).toBe('DRAFT');
    });
    it.each([
        'Please refund my listing fee',
        'Will that approve my listing? Also release my reward now.',
        'Does editing my advert help, and please release my reward now.',
        'Does editing my advert help and can you release my reward?',
        'Will that approve my listing and release my bonus? Please refund my fee.',
        'Can you release my bonus now?',
        'Please send me my approved bonus.',
        'Please make a payment now.',
        'I need you to issue my payment.',
        'How does a bonus work? Also release my payment now.',
        'Explain warranty payment and then refund my fee.',
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
            senderIdentityVerified: true,
            dedicatedAiSenderVerified: true,
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
        expect(canAutoReplyToSupport({ ...eligibleAuto, senderIdentityVerified: false })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, dedicatedAiSenderVerified: false })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, latestMessageIdMatches: false })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, alreadyProcessed: true })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, withinRateAndBudgetLimits: false })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, incomingMessage: 'Refund my fee' })).toBe(false);
        expect(canAutoReplyToSupport({ ...eligibleAuto, proposedReply: 'I will refund your fee' })).toBe(false);
    });

    it('creates a stable per-inbound-message idempotency key', () => {
        const messageId = '123e4567-e89b-12d3-a456-426614174000';
        expect(supportAutoReplyClientMessageId(messageId)).toBe(
            'mazium-support-123e4567-e89b-12d3-a456-426614174000',
        );
        expect(supportAutoReplyClientMessageId(messageId.toUpperCase())).toBe(
            supportAutoReplyClientMessageId(messageId),
        );
        expect(() => supportAutoReplyClientMessageId('../invalid')).toThrow();
    });

    it.each([
        'I want to speak to a human',
        'Please connect me with a live agent',
        'Turn off your AI',
        "I don't want to chat with a bot",
    ])('routes human handoff requests away from automatic replies: %s', (message) => {
        expect(requestsHumanSupport(message)).toBe(true);
        expect(classifySupportMessage(message).action).toBe('ESCALATE');
    });

    it('does not classify ordinary listing help as an opt-out', () => {
        expect(requestsHumanSupport('How do I create an auction listing?')).toBe(false);
    });

    it('only triggers for customer messages, never official support or automated messages', () => {
        const room = {
            context: 'SUPPORT',
            initiatorId: 'customer-1',
            participantId: 'support-1',
            officialSupportAccountId: 'support-1',
            senderIsAutomated: false,
        };
        expect(isInboundCustomerSupportMessage({ ...room, senderId: 'customer-1' })).toBe(true);
        expect(isInboundCustomerSupportMessage({ ...room, senderId: 'support-1' })).toBe(false);
        expect(isInboundCustomerSupportMessage({ ...room, senderId: 'staff-2' })).toBe(false);
        expect(isInboundCustomerSupportMessage({ ...room, senderId: 'customer-1', senderIsAutomated: true })).toBe(false);
        expect(isInboundCustomerSupportMessage({ ...room, senderId: 'customer-1', context: 'RETAIL' })).toBe(false);
        expect(isInboundCustomerSupportMessage({ ...room, senderId: 'customer-1', officialSupportAccountId: 'unknown' })).toBe(false);
        expect(isInboundCustomerSupportMessage({
            ...room, initiatorId: 'support-1', participantId: 'customer-1', senderId: 'customer-1',
        })).toBe(true);
    });

});
