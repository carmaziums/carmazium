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
];

export function classifySupportMessage(message: string): SupportDecision {
    const content = message.trim();
    if (!content || content.length > 4000) {
        return { action: 'ESCALATE', reason: 'EMPTY_OR_OVERSIZED' };
    }
    if (OWNER_APPROVAL.some((pattern) => pattern.test(content))) {
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
        && !input.latestMessageHasAttachment
        && input.latestMessageIdMatches
        && !input.alreadyProcessed
        && input.withinRateAndBudgetLimits
        && classifySupportMessage(input.incomingMessage).action === 'DRAFT'
        && classifySupportMessage(input.proposedReply).action === 'DRAFT';
}
