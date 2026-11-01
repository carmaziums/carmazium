/**
 * Conservative gate for MaziuM replies in official SUPPORT conversations.
 * This module does not send messages or grant administrative privileges.
 * An authenticated backend workflow must verify the room, latest message,
 * human takeover state, and idempotency before any delivery.
 */
export type SupportDecision =
    | { action: 'ESCALATE'; reason: string }
    | { action: 'DRAFT'; reason: 'ROUTINE_SUPPORT' };

const OWNER_APPROVAL = [
    /\b(refund|reimburse|chargeback|compensation|payout|withdrawal|transfer money)\b/i,
    /\b(bank (?:details|account)|sort code|iban|card number)\b/i,
    /\b(kyc|identity verification|verify my identity|delete (?:my |the )?account|change (?:my |the )?role)\b/i,
    /\b(legal action|solicitor|court|police|fraud|scam|complaint|dispute)\b/i,
    /\b(change|waive|reduce|cancel) (?:the |my )?(?:fee|payment|invoice|price)\b/i,
    /\b(approve|reject|override|reinstate|ban|suspend)\b/i,
    /\b(api key|password|one.time code|otp|pin|cvv)\b/i,
    /\b(refunds?|reimbursements?|chargebacks?|payouts?|withdrawals?|compensate|compensated)\b/i,
    /\b(banking|bank transfer|account number|sort.code|payment details|sortcode)\b/i,
    /\b(gdpr|data erasure|personal data request|subject access|remove my data)\b/i,
    /\b(sue|lawsuit|litigation|small claims|trading standards|citizens advice)\b/i,
    /\b(hacked|unauthorised access|stolen account|security breach|phishing)\b/i,
    /\b(refund(?:ing|ed)?|cancel(?:ling|ation)?|repay(?:ment)?|reverse (?:a |the )?charge)\b/i,
    /\b(account (?:locked|suspended|deleted|compromised)|can't (?:log ?in|access my account))\b/i,
    /\b(privacy complaint|data breach|identity theft|stolen identity)\b/i,
];

export function classifySupportMessage(message: string): SupportDecision {
    const content = message.trim();
    if (!content || content.length > 4000) {
        return { action: 'ESCALATE', reason: 'EMPTY_OR_OVERSIZED' };
    }
    if (requestsHumanSupport(content) || OWNER_APPROVAL.some((pattern) => pattern.test(content))) {
        return { action: 'ESCALATE', reason: 'SENSITIVE_OR_APPROVAL_REQUIRED' };
    }
    return { action: 'DRAFT', reason: 'ROUTINE_SUPPORT' };
}

/** Never silently enable AI replies when an administrator is involved. */
export function canPrepareSupportDraft(input: {
    context: string;
    supportClosedAt: Date | null;
    humanAssigned: boolean;
    latestSenderIsCustomer: boolean;
    alreadyRepliedToLatestMessage: boolean;
    consentToAi: boolean;
}): boolean {
    return input.context === 'SUPPORT'
        && input.supportClosedAt === null
        && !input.humanAssigned
        && input.latestSenderIsCustomer
        && !input.alreadyRepliedToLatestMessage
        && input.consentToAi;
}

/**
 * Gate for unattended delivery. A draft being available is not authorisation
 * to send: every condition must be rechecked against fresh database state
 * immediately before the atomic delivery operation.
 */
export function canAutoReplyToSupport(input: {
    enabled: boolean;
    context: string;
    roomClosed: boolean;
    roomDeleted: boolean;
    aiDisclosedAndConsented: boolean;
    optedOut: boolean;
    humanTakeover: boolean;
    latestMessageFromCustomer: boolean;
    /** Trusted server-side sender/participant check; never infer from message text. */
    senderIdentityVerified: boolean;
    /** Reply must originate from the dedicated, server-owned AI account. */
    dedicatedAiSenderVerified: boolean;
    latestMessageHasAttachment: boolean;
    latestMessageIdMatches: boolean;
    alreadyProcessed: boolean;
    withinRateAndBudgetLimits: boolean;
    incomingMessage: string;
    proposedReply: string;
}): boolean {
    return input.enabled
        && input.context === 'SUPPORT'
        && !input.roomClosed
        && !input.roomDeleted
        && input.aiDisclosedAndConsented
        && !input.optedOut
        && !input.humanTakeover
        && input.latestMessageFromCustomer
        && input.senderIdentityVerified
        && input.dedicatedAiSenderVerified
        && !input.latestMessageHasAttachment
        && input.latestMessageIdMatches
        && !input.alreadyProcessed
        && input.withinRateAndBudgetLimits
        && classifySupportMessage(input.incomingMessage).action === 'DRAFT'
        && classifySupportMessage(input.proposedReply).action === 'DRAFT';
}

/**
 * Stable delivery key for retries of the same inbound support message.
 * The sender's unique clientMessageId index enforces at-most-one stored
 * reply per incoming message; it is not sufficient on its own to prevent
 * a human/AI race, which must be resolved in a database transaction.
 */
export function supportAutoReplyClientMessageId(incomingMessageId: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(incomingMessageId)) {
        throw new Error('Invalid incoming support message identifier');
    }
    return `mazium-support-${incomingMessageId.toLowerCase()}`;
}

/**
 * A customer's plain-language request for a person is an opt-out signal.
 * The caller must persist the preference and route the room to human support;
 * this classifier does not itself mutate the room or send a message.
 */
export function requestsHumanSupport(message: string): boolean {
    return [
        /\b(human|real person|actual person|live agent|support agent|staff member|manager|supervisor)\b/i,
        /\b(?:speak|talk|chat|connect|transfer|put me through)\s+(?:to|with)\s+(?:a|an|the|someone|somebody)?\s*(?:person|representative|someone|somebody|agent)\b/i,
        /\b(stop|disable|turn off|opt out of|no more) (?:the |your )?(?:ai|bot|automated|automatic)\b/i,
        /\b(don't|do not|no longer) (?:want to )?(?:talk to|chat with|speak to) (?:an? )?(?:ai|bot|robot)\b/i,
    ].some((pattern) => pattern.test(message));
}

/**
 * Determine the sender from trusted persisted user/room IDs, never from
 * message text, display name, role labels supplied by a client, or content.
 * Only the non-support participant can trigger a support AI response.
 * The official support account and every other sender fail closed.
 */
export function isInboundCustomerSupportMessage(input: {
    context: string;
    senderId: string;
    initiatorId: string;
    participantId: string;
    officialSupportAccountId: string;
    senderIsAutomated: boolean;
}): boolean {
    const { context, senderId, initiatorId, participantId, officialSupportAccountId, senderIsAutomated } = input;
    if (context !== 'SUPPORT' || senderIsAutomated || !senderId || !officialSupportAccountId) return false;
    if (initiatorId === participantId) return false;
    if (officialSupportAccountId !== initiatorId && officialSupportAccountId !== participantId) return false;
    const customerId = officialSupportAccountId === initiatorId ? participantId : initiatorId;
    return senderId === customerId && senderId !== officialSupportAccountId;
}
