import { classifySupportMessage, requestsHumanSupport } from './mazium-support-policy';
import { verifiedNavigationReply } from '../ai/mazium-site-navigation';

export const HUMAN_HANDOFF_REPLY = "Thank you for contacting CarMazium. We have received your request to speak with a member of our support team.\n\nWe are currently experiencing a higher volume of enquiries than usual, so our response may take a little longer. A member of our team will respond here as soon as they can. Please bear with us.\n\nIn the meantime, you are welcome to leave details of your enquiry in this chat so we can assist you more efficiently.\n\nThank you for your patience.\nCarMazium Customer Support";
export const HUMAN_REVIEW_REPLY = "Thanks for your message. I've passed this to our support team for review. A team member will reply here; I can't authorise a financial or account decision.";
export const SUPPORT_UNAVAILABLE_REPLY = "Thanks for your question. I can't reliably answer it right now, so I've left it with our support team to reply here.";

/** Only human-handled or unresolved support messages should enter the staff queue.
 * Routine successfully answered MaziuM questions are not outstanding tickets.
 */
export function supportNeedsHumanReply(lastMessage: {
    aiGenerated?: boolean;
    content?: string | null;
    sender?: { role?: string | null } | null;
} | null): boolean {
    if (!lastMessage) return false;
    if (!lastMessage.aiGenerated) return lastMessage.sender?.role !== 'ADMIN';
    return [HUMAN_HANDOFF_REPLY, HUMAN_REVIEW_REPLY, SUPPORT_UNAVAILABLE_REPLY]
        .includes(lastMessage.content || '');
}

/** Public help only: these replies run locally and do not share chat text with an AI provider. */
export function routineSupportAnswer(message: string): string | null {
    if (classifySupportMessage(message).action !== 'DRAFT') return null;
    const text = message.trim();
    // Lightweight local conversational help should work even when the
    // external model or background worker is unavailable.
    if (text.length <= 55 && /^(?:hi|hello|hey|good (?:morning|afternoon|evening))(?:[,! .]+(?:can you help me|i need help|anyone there))?[!? .]*$/i.test(text)) {
        return "Hi! I'm MaziuM. How can I help?";
    }
    return null;
}

export function fixedSupportReply(message: string): string | null {
    if (requestsHumanSupport(message)) return HUMAN_HANDOFF_REPLY;
    if (classifySupportMessage(message).action === 'ESCALATE') return HUMAN_REVIEW_REPLY;
    return routineSupportAnswer(message);
}

/** A one-off handoff receipt is allowed even when the customer has opted out. */
export function supportReplyPlan(room: {
    supportAiConsentAt?: Date | null; // Legacy opt-in: no longer required for routine support
    supportAiOptedOutAt?: Date | null;
    supportHumanTakeoverAt?: Date | null;
}, content: string, createdAt: Date): { kind: 'FIXED'; reply: string } | { kind: 'AI' } | null {
    if (requestsHumanSupport(content)) return { kind: 'FIXED', reply: HUMAN_HANDOFF_REPLY };
    // A staff reply should not disable help for the lifetime of the chat.
    // Explicit customer requests for a person remain opted out until they opt back in.
    if (room.supportAiOptedOutAt || (room.supportHumanTakeoverAt
        && createdAt.getTime() - room.supportHumanTakeoverAt.getTime() < 15 * 60_000)) return null;
    const fixed = fixedSupportReply(content);
    if (fixed) return { kind: 'FIXED', reply: fixed };
    // General, non-sensitive support questions use MaziuM by default. The
    // customer is told AI is operating before typing and can pause AI at any
    // time. Only official SUPPORT rooms reach this plan; private marketplace
    // conversations and financial decisions never go to the model.
    return { kind: 'AI' };
}
