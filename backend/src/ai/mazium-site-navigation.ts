/**
 * Verified website navigation for MaziuM's public conversational assistant.
 *
 * Keep these destinations aligned with real route components and their Edit
 * actions. Do not ask the model to infer the website's current information
 * architecture from general car-marketplace knowledge.
 */
export const VERIFIED_SITE_NAVIGATION = `
CarMazium website navigation — these are verified, role-aware destinations:
- To EDIT or UPDATE an EXISTING car listing: DO NOT go to /sell; that starts a new listing.
  Private sellers: open My Cars at /dashboard/user?tab=cars, locate the existing car and select Edit.
  Dealers: open Stock / Inventory at /dashboard/dealer/inventory, locate the car and select Edit.
  The Edit action opens the existing record in the appropriate listing editor.
  For unknown account roles, offer both paths concisely rather than guessing a role.
  If an edit is restricted by sale or auction status, do not promise it can be changed.
- To CREATE a new vehicle listing: /sell for a private seller, or /dashboard/dealer/add-listing for dealers.
- To MANAGE auctions already submitted: private seller /dashboard/seller/auctions;
  dealer /dashboard/dealer/auctions. New auctions and active auctions have different controls.
- Platform administrators: Admin Control Panel -> Auctions at /dashboard/admin/auctions.
  This administrative oversight is distinct from verified-dealer bidding permissions.
  Account Management: /dashboard/admin/users. Combine account type, dealer KYC, service category, service verification, account status and email filters with search. These are administrator-only controls.
  Warranty Orders: /dashboard/admin/warranty-orders. Trade Services -> Jobs: /dashboard/admin/services?tab=jobs.
  Admin accounts use these admin review pages rather than the personal My Warranties dashboard.
- To BROWSE vehicles: /search. To browse live auctions: /auctions.
- To download the mobile app: /download-app.
- For seller valuation and choosing between Auction and Retail, use /sell; no separate /valuation route is verified.
- Auction Wins: /dashboard/dealer/auctions/won. Retail Purchases: /dashboard/dealer/purchases/retail.
  Bids & Offers: /dashboard/dealer/bids for current auction bids; /dashboard/dealer/bids?tab=retail for outgoing retail offers.
  All Purchases: /dashboard/dealer/purchases. Purchase History: /dashboard/dealer/purchases/history.
  These are separate buyer-side dealer views, not one interchangeable tab.
- For profile, verification and payout details: /profile; the Payouts section can be selected at /profile?section=payouts.
  Never ask for bank credentials in chat.
- Buyer/seller dashboard: Home /dashboard/user?tab=overview; Saved Cars /dashboard/user?tab=watchlist; Purchases /dashboard/user?tab=purchases; Sales & Earnings /dashboard/user?tab=earnings; Listing Performance /dashboard/user?tab=stats; Messages /dashboard/user?tab=messages.
- My Warranties: /dashboard/warranties. Sale Cancellations: /dashboard/cancellations.
- Sign in at /auth/login; use Forgot Password at /auth/forgot-password to request a reset link. Never request the password or reset token in chat.
- Offers Received for private sellers: /dashboard/user?tab=offers. My Offers sent as a buyer: /dashboard/user?tab=bids.
- For service jobs: /services/jobs/new to post, /services/jobs to see jobs and
  /dashboard/service/jobs for an approved service provider to find and quote matching jobs.
- For TradeXchange capability setup: /dashboard/service/capabilities, subject to account approval.
- Notifications and email preferences: /notifications.
- Pricing: /pricing for consumer listing tiers, /pricing/traders for auction buyer fees.
- For payment, transaction status, KYC, cancellation or refunds, link only to the relevant
  verified dashboard page and refer account-specific decisions to staff; never fabricate an ID or checkout URL.
- Only tell people to use dashboard options that exist; never invent menus, IDs, account status or admin actions.
- Do not claim to have opened a customer's dashboard, modified their listing or checked a private account.
- If you cannot verify an exact navigation route for another topic, say so briefly and ask one question
  or describe the generic in-dashboard step without fabricating an URL.
`.trim();

const EDIT_WORDS = /\b(?:edit|update|change|modify|amend|correct|manage|revise)\b/i;
const LISTING_WORDS = /\b(?:listing|advert(?:isement)?|adverts?|ad|stock)\b/i;
const CAR_ALREADY_LISTED = /\b(?:car|vehicle)\b.{0,65}\b(?:listed|uploaded|advertised|published|already online)\b|\b(?:listed|uploaded|advertised|published)\b.{0,65}\b(?:car|vehicle)\b/i;
const DETAILS_ALREADY_LISTED = /\b(?:change|update|edit|correct)\b.{0,60}\b(?:price|photos?|pictures?|description|mileage|details)\b.{0,75}\b(?:listing|advert|listed|car|vehicle)\b/i;

/** For verified high-volume navigation questions, avoid model guesswork entirely. */
export function verifiedNavigationReply(query: string): string | null {
    const text = query.trim();
    if (!EDIT_WORDS.test(text)) return null;
    if (!LISTING_WORDS.test(text) && !CAR_ALREADY_LISTED.test(text) && !DETAILS_ALREADY_LISTED.test(text)) return null;

    return 'To edit an existing vehicle, open the listing from your dashboard rather than starting again at /sell. ' +
        'Private seller: go to My Cars (/dashboard/user?tab=cars), find your car and select Edit. ' +
        'Dealer: go to Stock / Inventory (/dashboard/dealer/inventory), find the vehicle and select Edit. ' +
        'What would you like to change — the price, photos or vehicle details?';
}

const VERIFIED_ROUTES = new Set([
    '/sell',
    '/auth/login',
    '/auth/forgot-password',
    '/dashboard/warranties',
    '/dashboard/cancellations',
    '/search',
    '/auctions',
    '/auctions/browse',
    '/download-app',
    '/pricing',
    '/pricing/traders',
    '/become-a-partner',
    '/used-cars',
    '/dashboard/enquiries',
    '/how-it-works',
    '/privacy-policy',
    '/terms',
    '/services',
    '/services/finance',
    '/services/warranty',
    '/services/inspection',
    '/services/delivery',
    '/services/jobs/new',
    '/services/jobs',
    '/profile',
    '/dashboard/user',
    '/dashboard/seller/auctions',
    '/dashboard/admin/auctions',
    '/dashboard/admin/users',
    '/dashboard/admin/warranty-orders',
    '/dashboard/admin/services',
    '/dashboard/seller/add-listing',
    '/dashboard/seller/offers',
    '/dashboard/buyer/history',
    '/dashboard/buyer/offers',
    '/dashboard/dealer',
    '/dashboard/dealer/inventory',
    '/dashboard/dealer/bids',
    '/dashboard/dealer/auctions',
    '/notifications',
    '/checkout',
    '/dashboard/dealer/auctions/won',
    '/dashboard/dealer/purchases',
    '/dashboard/dealer/purchases/retail',
    '/dashboard/dealer/purchases/history',
    '/dashboard/dealer/add-listing',
    '/dashboard/partner',
    '/dashboard/service/jobs',
    '/dashboard/service/capabilities',
]);

/**
 * If the model attempts to provide a precise CarMazium page we haven't verified,
 * refuse that route rather than confidently directing someone to a non-existent page.
 * Static route listing is intentional: generated customer/vehicle IDs are not trusted.
 */
export function hasUnverifiedNavigationPath(answer: string): boolean {
    const matches = answer.matchAll(/(?<![a-z0-9/])(?:https?:\/\/(?:www\.)?carmazium\.com)?\/(?:[a-z][a-z0-9-]*)(?:\/[a-z][a-z0-9-]*)*(?:\?[a-z0-9_=&%.-]+)?/gi);
    for (const match of matches) {
        const url = new URL(match[0].replace(/[.,;:!?]+$/, ''), 'https://www.carmazium.com');
        const path = url.pathname.replace(/\/$/, '') || '/';
        if (!VERIFIED_ROUTES.has(path)) return true;
        if (url.searchParams.has('editId') || url.searchParams.has('listingId') || url.searchParams.has('editSlug')) return true;
        if (path === '/dashboard/user' && [...url.searchParams.keys()].some(key => key !== 'tab')) return true;
        if (path === '/dashboard/user' && url.searchParams.has('tab') &&
            !['overview','cars','inventory','offers','bids','watchlist','purchases','earnings','stats','messages'].includes(url.searchParams.get('tab') || '')) return true;
    }
    return false;
}

export const UNVERIFIED_NAVIGATION_REPLY =
    "I don't want to direct you to the wrong page. Tell me what you need to do and whether you're a private seller or a dealer, and I'll guide you through the correct dashboard.";
