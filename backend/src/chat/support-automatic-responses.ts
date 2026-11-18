import { classifySupportMessage, requestsHumanSupport, requiresImmediateHumanSupport, hasSensitiveSupportContent } from './mazium-support-policy';
import { verifiedNavigationReply } from '../ai/mazium-site-navigation';

const LEGACY_HUMAN_HANDOFF_REPLY = "Thank you for contacting CarMazium. We have received your request to speak with a member of our support team.\n\nWe are currently experiencing a higher volume of enquiries than usual, so our response may take a little longer. A member of our team will respond here as soon as they can. Please bear with us.\n\nIn the meantime, you are welcome to leave details of your enquiry in this chat so we can assist you more efficiently.\n\nThank you for your patience.\nCarMazium Customer Support";
export const SUPPORT_HELP_OFFER = "I can help with most CarMazium questions, including listings, buying, selling and using your account. Tell me what you need help with and I'll try to resolve it here. Would you still prefer me to pass your enquiry to a person?";
export const SUPPORT_HELP_ACCEPTED = "Of course. Tell me what you need help with, and I'll guide you through it.";
export const HUMAN_HANDOFF_REPLY = "I've passed your enquiry to our customer support team. A team member will get back to you here as soon as they can. Please add any details you haven't already shared, such as what went wrong, the listing reference or the error shown, so we can assist faster. Your conversation is saved here for the team.";
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
    return [HUMAN_HANDOFF_REPLY, LEGACY_HUMAN_HANDOFF_REPLY, HUMAN_REVIEW_REPLY, SUPPORT_UNAVAILABLE_REPLY]
        .includes(lastMessage.content || '');
}

/** Public help only: these replies run locally and do not share chat text with an AI provider. */
export function routineSupportAnswer(message: string): string | null {
    if (classifySupportMessage(message).action !== 'DRAFT') return null;
    const text = message.trim();
    // Authoritative navigation answers are shared by public MaziuM and
    // official support. Never send someone creating a duplicate advert at
    // /sell when their request is to edit an existing listing.
    if (/\b(?:but|also|already|still|didn'?t work|doesn'?t work|not working|tried|failed|error|unable)\b/i.test(text)
        || (text.match(/\?/g) || []).length > 1) return null;
    const verifiedRoute = verifiedNavigationReply(text);
    if (verifiedRoute) return verifiedRoute;
    // Lightweight local conversational help should work even when the
    // external model or background worker is unavailable.
    if (text.length <= 55 && /^(?:hi|hello|hey|good (?:morning|afternoon|evening))(?:[,! .]+(?:can you help me|i need help|anyone there))?[!? .]*$/i.test(text)) {
        return "Hi! I'm MaziuM. I can help with selling a car, creating a listing, auctions, and CarMazium account questions. What would you like help with?";
    }
    if (/\b(?:i (?:want|would like|need) to|help me|can i|how do i|where can i)\b.*\b(?:upload|list|advertise|sell)\b.*\b(?:a |my |the )?(?:car|vehicle)\b/i.test(text)) {
        return "I can help you list a car. Open https://www.carmazium.com/sell, enter the registration, then choose Auction (free) or Retail (Basic £1 until sold). Complete the details, photos and declarations. Tell me which step you need help with.";
    }
    // Only a single, clearly identified topic should use a fixed answer. Other
    // questions go to the conversational model (with the customer's permission).
    if (/\b(how much|costs?|fees?|free)\b/i.test(text) && /\b(list|listing|advertis|sell|auction|retail|buyer)\w*/i.test(text)) {
        return 'Auction listings are free. A Basic retail listing costs £1 once and stays listed until sold. The winning auction buyer pays a £125 platform fee; retail buyers pay no platform buyer fee. Buyers pay the vehicle price directly to the seller.';
    }
    if (/\b(how|where)\b/i.test(text) && /\b(list|advertise|sell)\b.*\b(car|vehicle)\b/i.test(text)) {
        return 'Open https://www.carmazium.com/sell, enter your registration, then choose Auction or Retail. Complete the vehicle details and seller declarations, add at least 10 photos, and follow the review and submission steps. Auctions are free to list; a Basic retail listing is £1 until sold.';
    }

    if (/\b(how|where)\b/i.test(text) && /\b(mark|car|vehicle)\b.*\bsold\b/i.test(text)) {
        return 'Open your dashboard and find the vehicle under Listings or Inventory. Use Mark as sold and follow the confirmation steps. If it sold elsewhere, choose that option so it is not recorded as a CarMazium buyer purchase.';
    }
    if (/\b(how|what|why|do i)\b/i.test(text) && /\b(service history|number of keys|mechanical faults?|electrical faults?)\b/i.test(text)) {
        return 'Enter the actual number of keys and the service history supported by your records. For mechanical and electrical faults, choose No known faults or Yes and describe the problem. These are separate required answers; DVLA/MOT cannot supply them. Missing answers are highlighted when you try to continue.';
    }
    if (/\b(?:caravan|campervan)\b/i.test(text) && /\b(?:photo|picture|image)s?\b/i.test(text)) {
        return /\bcaravan\b/i.test(text) && !/\bcampervan\b/i.test(text)
            ? 'A towable caravan needs at least one clear photo before publication. You can enter the details manually without a registration or VIN/CRiS number. Show its condition and disclose any faults honestly.'
            : 'A motorised campervan needs at least 10 clear photos, including exterior, interior and any damage. It follows the normal motor-vehicle registration and specification requirements.';
    }
    if (/\b(how many|minimum|required|what photos|what pictures|which photos|need to upload)\b/i.test(text) && /\b(photos?|pictures?|images?)\b/i.test(text)) {
        return 'A listing needs at least 10 vehicle photos. Include clear exterior and interior views and show any damage honestly. Add them in the Photos step; the first photo is the cover. If an upload fails, tell me the error shown and the device you are using.';
    }
    if (/\b(how|where)\b/i.test(text) && /\b(download|install|apk|app)\b/i.test(text)) {
        return 'Open https://www.carmazium.com/download-app and choose your device. That page shows the current Android download and browser installation options. Use only the official CarMazium download page.';
    }
    if (/\b(forgot|reset|change)\b.*\bpassword\b/i.test(text) && !/\b(my password is|password[:=])\b/i.test(text)) {
        return 'Use Forgot password on the sign-in page and follow the reset link sent to your registered email address. Check your spam folder if needed. Never send your password or a one-time code in chat.';
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
    supportHelpOffered?: boolean;
    supportHelpOfferPending?: boolean;
}, content: string, createdAt: Date): { kind: 'FIXED'; reply: string } | { kind: 'AI' } | null {
    const confirmingPerson = room.supportHelpOfferPending && /^(?:yes(?: please)?|please do|go ahead|pass it on|connect me|no thanks?[, ]*human please)[.!? ]*$/i.test(content.trim());
    if (requestsHumanSupport(content) || confirmingPerson) {
        const handoff = confirmingPerson || room.supportHelpOffered || room.supportAiOptedOutAt
            || room.supportHumanTakeoverAt || requiresImmediateHumanSupport(content)
            || hasSensitiveSupportContent(content);
        return { kind: 'FIXED', reply: handoff ? HUMAN_HANDOFF_REPLY : SUPPORT_HELP_OFFER };
    }
    // A staff reply should not disable help for the lifetime of the chat.
    // Explicit customer requests for a person remain opted out until they opt back in.
    if (room.supportAiOptedOutAt || (room.supportHumanTakeoverAt
        && createdAt.getTime() - room.supportHumanTakeoverAt.getTime() < 15 * 60_000)) return null;
    if (room.supportHelpOfferPending && /^(?:no(?: thanks?)?|you can help(?: me)?|help me instead|let'?s try)[.!? ]*$/i.test(content.trim())) {
        return { kind: 'FIXED', reply: SUPPORT_HELP_ACCEPTED };
    }
    const fixed = fixedSupportReply(content);
    if (fixed) return { kind: 'FIXED', reply: fixed };
    // General, non-sensitive support questions use MaziuM by default. The
    // customer is told AI is operating before typing and can pause AI at any
    // time. Only official SUPPORT rooms reach this plan; private marketplace
    // conversations and financial decisions never go to the model.
    return { kind: 'AI' };
}
