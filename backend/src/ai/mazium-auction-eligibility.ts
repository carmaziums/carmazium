/**
 * Source of truth: VerifiedDealerGuard and the live auction bidding page.
 * A public visitor may browse an auction but only an authorised verified
 * motor-trade dealer account may bid. Do not let an LLM redefine this rule.
 */
export type MaziumConversationMessage = {
    role: 'user' | 'assistant';
    content: string;
};

const AUCTION_TOPIC = /\b(?:auctions?|bids?|bidding|bidder|trade[- ]only auction)\b/i;
const BUYING_INTENT = /\b(?:bids?|bidding|buy|buying|purchase|purchasing|participate|join|take part|eligible|allowed|permission|place an? offer)\b/i;
const SELLING_INTENT = /\b(?:list|listing|sell|selling|advertise|advertising|upload|post)\b/i;
const FOLLOW_UP = /^(?:but|so|then|and|what if|what about|how about|can i|could i|why|still|even if|is there|i want|i'd like)\b/i;
const CLEAR_NON_DEALER = /\b(?:not (?:a |an )?(?:car |motor[- ]trade )?(?:dealer|trader)|don't (?:have|own|run) (?:a |an )?(?:dealership|motor[- ]trade business)|without (?:a |an )?(?:dealer|trade) account|non[- ]?dealers?|private (?:buyer|seller|customer|person)|individual(?: buyer)?|regular customer|anyone|everyone|not in (?:the )?motor trade)\b/i;
const VERIFIED_DEALER = /\b(?:verified|approved|registered|authorised) (?:motor[- ]trade )?(?:dealer|trader|dealership)\b/i;

/** We only carry the *user's* auction subject across short follow-ups.
 * Previous model answers are untrusted and can be wrong.
 */
function previousAuctionPurchaseContext(messages: MaziumConversationMessage[]): boolean {
    const userMessages = messages.filter(m => m.role === 'user');
    const prior = userMessages.slice(-4, -1);
    return prior.some(m => AUCTION_TOPIC.test(m.content) && BUYING_INTENT.test(m.content));
}

/**
 * Deterministic, multi-turn public eligibility guidance. Does not pretend
 * to know the customer's verification status; that requires an authenticated
 * check when placing a real bid.
 */
export function verifiedAuctionEligibilityReply(messages: MaziumConversationMessage[]): string | null {
    const latest = [...messages].reverse().find(m => m.role === 'user');
    if (!latest) return null;
    const question = latest.content.trim();
    if (!question) return null;

    const explicitAuction = AUCTION_TOPIC.test(question);
    const priorAuctionBuying = previousAuctionPurchaseContext(messages);
    const contextualBuying = priorAuctionBuying && FOLLOW_UP.test(question);
    if (!explicitAuction && !contextualBuying) return null;

    const buyingIntent = BUYING_INTENT.test(question)
        || (contextualBuying && /\b(?:can|could|still|want|like|how|why|allowed|participat|buy|bid)\b/i.test(question));
    // Listing a car at auction is a distinct seller workflow.
    if (!buyingIntent && SELLING_INTENT.test(question)) return null;
    if (!buyingIntent) return null;

    const previousUserMessages = messages.filter(m => m.role === 'user').slice(-4).map(m => m.content);
    const userContext = previousUserMessages.join(' ');
    const userIsNonDealer = CLEAR_NON_DEALER.test(question) || (contextualBuying && CLEAR_NON_DEALER.test(userContext));
    const userClaimsVerified = VERIFIED_DEALER.test(question) && !userIsNonDealer;

    if (userIsNonDealer || /\b(?:but|still|really) (?:i |we )?(?:want|need|would like) to (?:buy|bid)/i.test(question)) {
        return 'CarMazium auctions are for verified motor-trade dealers only. ' +
            'A private buyer or seller cannot place bids, even though the auctions are visible to everyone. ' +
            'If you want to buy privately, browse Retail cars at /search and contact the seller. ' +
            'If you genuinely operate a motor-trade business, you can register as a dealer, but verification and bidding approval are required.';
    }
    if (userClaimsVerified) {
        return 'Verified, authorised dealers can sign in, visit /auctions, open a live auction, review the vehicle details and place a bid using the bidding controls. ' +
            'Bidding only works when the dealership and account permissions are approved and the auction is still open. ' +
            'If your account cannot bid, check your verification and permissions rather than opening a private buyer account.';
    }
    return 'Only verified, authorised motor-trade dealers can bid on CarMazium auctions. ' +
        'To bid as a dealer, sign in, visit /auctions, choose a live vehicle and use its bidding controls after verification. ' +
        'Private buyers and sellers can view auctions but cannot bid; they can buy from public Retail listings at /search.';
}

/** A second, post-generation assertion prevents hallucinated permissions if a
 * future prompt change causes a policy-critical answer to reach the model.
 */
export function contradictsDealerOnlyAuctionRule(answer: string): boolean {
    const text = answer.replace(/\s+/g, ' ');
    if (!AUCTION_TOPIC.test(text)) return false;
    if (/\b(?:anyone|everybody|all users)\s+(?:can|may|are allowed to)\s+(?:place |make )?(?:a )?bid\b/i.test(text)) return true;
    if (/\b(?:private (?:buyers?|sellers?|customers?|people|person)|non[- ]?dealers?|individuals?)\b.{0,95}\b(?:can|may|is allowed to|are allowed to|is eligible to|are eligible to)\b.{0,65}\b(?:bid|place a bid|participate)\b/i.test(text)
        && !/\b(?:cannot|can't|not allowed|not eligible|not permitted)\b.{0,100}\b(?:bid|participate)/i.test(text)) return true;
    if (/\b(?:private (?:buyers?|sellers?|customers?|people|person)|non[- ]?dealers?)\b.{0,150}\b(?:place a bid directly|bid directly|participate in public auctions)\b/i.test(text)
        && !/\b(?:cannot|can't|not allowed|not permitted)\b.{0,100}\b(?:bid|participate)/i.test(text)) return true;
    return false;
}
