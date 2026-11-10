import { classifySupportMessage, requestsHumanSupport } from './mazium-support-policy';

export const HUMAN_HANDOFF_REPLY = "Of course. I've passed your request to our support team. Please wait for a human support agent to reply here.";
export const HUMAN_REVIEW_REPLY = "Thanks for your message. I've passed this to our support team for review. A team member will reply here; I can't authorise a financial or account decision.";
export const SUPPORT_UNAVAILABLE_REPLY = "Thanks for your question. I can't reliably answer it right now, so I've left it with our support team to reply here.";

/** Public help only: these replies run locally and do not share chat text with an AI provider. */
export function routineSupportAnswer(message: string): string | null {
    if (classifySupportMessage(message).action !== 'DRAFT') return null;
    const text = message.trim();
    // Only a single, clearly identified topic should use a fixed answer. Other
    // questions go to the conversational model (with the customer's permission).
    if (/\b(how much|costs?|fees?|free)\b/i.test(text) && /\b(list|listing|advertis|sell|auction|retail|buyer)\w*/i.test(text)) {
        return 'Auction listings are free. A Basic retail listing costs £1 once and stays listed until sold. The winning auction buyer pays a £125 platform fee; retail buyers pay no platform buyer fee. Buyers pay the vehicle price directly to the seller.';
    }
    if (/\b(how|where)\b/i.test(text) && /\b(list|advertise|sell)\b.*\b(car|vehicle)\b/i.test(text)) {
        return 'Open https://www.carmazium.com/sell, enter your registration, then choose Auction or Retail. Complete the vehicle details and seller declarations, add at least 10 photos, and follow the review and submission steps. Auctions are free to list; a Basic retail listing is £1 until sold.';
    }
    if (/\b(how|where)\b/i.test(text) && /\b(edit|change|update|lower|reduce)\b.*\b(listing|advert|asking price|reserve)\b/i.test(text)) {
        return 'Open your dashboard, go to Listings (or your dealer Inventory), choose the vehicle and select Edit. Save your changes there. Live auctions may restrict changes to bidding terms. If you see an error, tell me the exact wording so I can help.';
    }
    if (/\b(how|where)\b/i.test(text) && /\b(mark|car|vehicle)\b.*\bsold\b/i.test(text)) {
        return 'Open your dashboard and find the vehicle under Listings or Inventory. Use Mark as sold and follow the confirmation steps. If it sold elsewhere, choose that option so it is not recorded as a CarMazium buyer purchase.';
    }
    if (/\b(how|what|why|do i)\b/i.test(text) && /\b(service history|number of keys|mechanical faults?|electrical faults?)\b/i.test(text)) {
        return 'Enter the actual number of keys and the service history supported by your records. For mechanical and electrical faults, choose No known faults or Yes and describe the problem. These are separate required answers; DVLA/MOT cannot supply them. Missing answers are highlighted when you try to continue.';
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
    supportAiConsentAt?: Date | null;
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
    if (room.supportAiConsentAt && createdAt >= room.supportAiConsentAt) return { kind: 'AI' };
    return { kind: 'FIXED', reply: SUPPORT_UNAVAILABLE_REPLY };
}
