/**
 * Canonical MaziuM public-platform knowledge, reviewed against current web/backend code.
 * This is a maintained retrieval catalogue, NOT model fine-tuning and NOT access to
 * live customer account, inventory or payment information.
 *
 * Every entry names the owning source(s). When an underlying flow changes,
 * update its knowledge entry and regression tests in the same PR.
 * Avoid speculative product claims, unsupported direct URLs and guarantees.
 */

export type PlatformKnowledgeTopic = {
    id: string;
    /** Phrases used to retrieve relevant guidance for a free-text question. */
    triggers: RegExp;
    facts: string;
    sources: readonly string[];
};

export const PLATFORM_KNOWLEDGE: readonly PlatformKnowledgeTopic[] = [
    {
        id: 'accounts-and-roles',
        triggers: /\b(?:sign ?up|register|account|login|log in|password|seller|buyer|trader|dealer|role|partner account|business account)\b/i,
        facts: [
            'CarMazium supports individual buyer/seller accounts and verified motor-trade Partner/Dealer accounts.',
            'The same login can access its role-appropriate dashboard; never promise a customer has a particular permission or approval.',
            'Dealers need business verification before bidding at dealer-only auctions. Partner accounts manage eligible service capabilities.',
            'Account/profile settings: /profile. It contains personal/business details, verification, notification choices, payouts, appearance and account/security controls.',
            'The public assistant cannot see whether a particular account has passed KYC, changed password or been suspended.'
        ].join(' '),
        sources: ['src/app/profile/page.tsx','src/app/dashboard/partner/page.tsx','src/app/pricing/traders/page.tsx']
    },
    {
        id: 'create-new-listing',
        triggers: /\b(?:new listing|list a|sell my|upload a|upload my|advertise a|create a listing|add vehicle|post a car|start auction|sell a car)\b/i,
        facts: [
            'To CREATE a new private seller listing, start at /sell, then choose free Auction or paid Retail. CarMazium can look up a motor vehicle registration and estimate values, with a manual flow where supported.',
            'To add new dealer stock use /dashboard/dealer/add-listing (reachable from Stock/Inventory).',
            'Provide truthful registration, mileage and vehicle details, photos, service history, keys, damage and mechanical/electrical faults; required inputs are validated by the wizard.',
            'Auction seller listing fee is £0; Basic Retail is £1 one-off until sold. Never imply every listing is guaranteed approval or publication.',
            'Do not tell an existing owner to create a duplicate listing to edit or relist an existing one.'
        ].join(' '),
        sources: ['src/app/sell/page.tsx','src/app/dashboard/dealer/inventory/page.tsx','src/components/listing/ListingWizard.tsx','src/lib/pricingConfig.ts']
    },
    {
        id: 'edit-existing-listing',
        triggers: /\b(?:edit|update|change|modify|correct|revise|amend|replace|manage)\b.{0,90}\b(?:listing|advert|ad|car|vehicle|stock|photo|price|description)\b|\b(?:listing|advert|vehicle)\b.{0,90}\b(?:edit|update|change|modify|correct|revise)\b/i,
        facts: [
            'To EDIT an existing listing, DO NOT send anyone to /sell (that creates a new listing).',
            'Private seller: /dashboard/user?tab=cars -> find vehicle -> Edit -> existing listing editor.',
            'Dealer: /dashboard/dealer/inventory -> find stock vehicle -> Edit -> existing listing editor.',
            'Only the actual owner with sufficient privileges may edit; status and review rules can restrict changes.',
            'If role unknown, provide both private seller and dealer routes and ask which account type they use.'
        ].join(' '),
        sources: ['src/app/dashboard/user/page.tsx','src/app/dashboard/dealer/inventory/page.tsx']
    },
    {
        id: 'sell-caravan-campervan',
        triggers: /\b(?:caravan|campervan|motorhome|towable)\b/i,
        facts: [
            'The listing wizard has a combined Caravan / Campervan selection, with separate Caravan (towable) and Campervan (motorised) body types; supported listings can be filtered by the appropriate type.',
            'A towable touring caravan can be listed manually without a registration number, VIN/CRiS or motor-vehicle specifications. It needs at least one photo and honest seller declarations. A motorised campervan is treated as a motor vehicle for required registration, mileage, fuel, transmission and normal 10-photo rules.',
            'The seller chooses price or auction reserve as applicable; do not promise an automatic valuation for a caravan.',
            'Begin from /sell; choose the caravan/campervan option when entering the listing.'
        ].join(' '),
        sources: ['src/app/sell/page.tsx','backend/src/listings/caravan-listings.spec.ts','backend/prisma/schema.prisma']
    },
    {
        id: 'retail-listing-packages',
        triggers: /\b(?:retail|classified|basic|standard|premium|package|advertising cost|listing cost|listing fee|£1|£10|£25|boost|featured|advert price|hpi|history report)\b/i,
        facts: [
            'Retail listings advertise to public buyers. Current advertised one-off packages: Basic £1 until sold; Standard £10 including a vehicle history report; Premium £25 including Standard benefits and a 28-day Featured Boost.',
            'An optional vehicle history check is separately priced at £9.99; a separate Featured Boost is £25 for 28 days where eligible.',
            'A retail buyer pays £0 in CarMazium buyer fees. This is distinct from paying the seller for the vehicle.',
            'See package details at /pricing; never claim the customer already paid, or that a failed payment succeeded.'
        ].join(' '),
        sources: ['src/lib/pricingConfig.ts','src/app/pricing/page.tsx']
    },
    {
        id: 'dealer-auctions',
        triggers: /\b(?:auction|bid|bidding|reserve|winning|winner|anti-snipe|provisional|dealer fee|buyer fee)\b/i,
        facts: [
            'CarMazium seller auctions are free to list and normally run for 24 hours, with verified motor traders eligible to bid.',
            'Browse public auction information at /auctions or /auctions/browse. Only eligible verified motor traders may participate in dealer-only bidding.',
            'Winning dealer auction fee is £125 one-off (subject to authorised grants), payable within the prescribed 72-hour period; a losing bidder does not pay that fee.',
            'After the fee is paid, seller contact and deal details can unlock; the winning dealer pays the actual vehicle purchase price directly to the seller.',
            'Do not claim that a bid, a reserve offer, a sale or a fee refund is automatically final without checking its status in the relevant dashboard.',
            'Private seller auction management: /dashboard/seller/auctions. Dealer auction management: /dashboard/dealer/auctions.',
        ].join(' '),
        sources: ['src/app/pricing/traders/page.tsx','src/app/pricing/page.tsx','src/app/auctions/won/[id]/page.tsx','src/lib/auctionApi.ts']
    },
    {
        id: 'sale-handover-reward',
        triggers: /\b(?:handover|collection|collect|paid seller|seller bonus|£100|reward|incentive|bonus|proof|seller payout)\b/i,
        facts: [
            'Vehicle purchase proceeds are paid by the buyer directly to the seller; CarMazium is not an escrow for the vehicle price.',
            'For qualifying completed auction sales, the seller confirms payment and uploads approved handover evidence/photo; a £100 seller reward may then be released.',
            'A payout is not automatic merely because an auction ended. Successful sale, approved handover and payout/account checks matter.',
            'Sellers can review auction progress in /dashboard/seller/auctions; bank/payout setup is available in /profile?section=payouts.',
            'Never claim that you have checked a payout, released funds or guaranteed a payout date.'
        ].join(' '),
        sources: ['src/app/pricing/page.tsx','src/app/how-it-works/page.tsx','src/app/dashboard/seller/auctions/page.tsx','src/app/profile/page.tsx']
    },
    {
        id: 'retail-buyer-offers',
        triggers: /\b(?:offer|negotiate|counteroffer|accept offer|retail buyer|buy a car|purchase a car|watchlist|save cars|contact seller|message seller)\b/i,
        facts: [
            'Retail buyers can browse cars at /search, inspect listing information, contact the seller through the listing chat and make offers where enabled.',
            'Sellers can accept, reject or counter offers within the available workflow. A visible offer is not proof of payment or collection.',
            'Retail buyers do not owe a CarMazium platform buyer fee. The vehicle price is paid directly to the seller.',
            'The assistant must not send a message, change an offer, reserve a car or declare a purchase completed on behalf of the user.'
        ].join(' '),
        sources: ['src/app/pricing/traders/page.tsx','src/app/dashboard/seller/offers/page.tsx','src/app/dashboard/buyer/offers/page.tsx']
    },
    {
        id: 'buyer-and-dealer-purchases',
        triggers: /\b(?:my purchases|purchase history|auction wins|won auction|receipt|invoice|order|collection status|buyer history)\b/i,
        facts: [
            'Dealers should use their dashboard auction wins/purchases tools for accepted or won auction stock; buyers can use their purchase/offer activity and messages.',
            'Vehicle records and purchase history show the status actually recorded on the account. Do not treat a paid fee as proof that a vehicle was collected.',
            'Where available, use the relevant purchase detail for the recorded listing and its documents; never invent a PDF or receipt number.',
            'If a customer reports a missing win or transaction, ask for the reference and route it to authorised support staff rather than asserting an unseen status.'
        ].join(' '),
        sources: ['src/components/dealer/DealerPurchasesView.tsx','src/lib/purchaseDestinations.ts','src/app/dashboard/buyer/history/page.tsx']
    },
    {
        id: 'verification-and-kyc',
        triggers: /\b(?:kyc|verify|verification|identity|business details|sole trader|company|bidding approved|trade insurance|£1 verification|account review)\b/i,
        facts: [
            'Dealer identity/business verification is required for trade auction access; there is a one-time £1 dealer account verification charge in the normal onboarding workflow.',
            'Partner service preferences do not automatically approve service-provider capability. Approval can require business verification and payout setup.',
            'Collection, delivery and recovery capability also requires valid trade insurance; inspection capability follows its own declaration process.',
            'Dealers manage profile verification in /profile?section=verification; approved partner service capabilities use /dashboard/service/capabilities.',
            'Never claim verification has passed, failed or been charged without authenticated account records.'
        ].join(' '),
        sources: ['backend/src/dealers/dealers.service.ts','src/components/dealer/DealerServicePreferences.tsx','src/app/profile/page.tsx']
    },
    {
        id: 'warranty',
        triggers: /\b(?:warranty|warranties|warrantywise|repair limit|labour rate|covered|claim|car warranty)\b/i,
        facts: [
            'Warranty quotation is available from /services/warranty when enabled. Customers enter eligible vehicle information, select cover and see the actual priced quote before paying.',
            'The platform arranges 12-month Warrantywise cover through Pulse Cars Limited as broker; CarMazium does not issue the warranty itself. Admin arranges issuance after payment.',
            'The backend current VAT-inclusive standard 12-month tariff is £360 for a car or £445 for an SUV at £2,000 per-repair limit and £75/hr labour, before extras.',
            'Other coverage/labour/extras affect the exact price; refer to the live quote form rather than inventing prices or cover. Purchases are not the same as an issued policy.',
            'Warranty claims and exclusions are governed by the actual policy terms; the assistant must not approve a claim.'
        ].join(' '),
        sources: ['backend/src/services/warranty-retail-tariff.ts','src/app/services/warranty/page.tsx']
    },
    {
        id: 'vehicle-finance',
        triggers: /\b(?:finance|financing|monthly payments|finance calculator|jigsaw|lender|credit|loan|apr|eligibility|finance provider)\b/i,
        facts: [
            'Where a participating listing offers finance, buyers select Apply for Finance on that listing; the first referral form collects their name, email and phone, then continues to the provider selected by CarMazium admin.',
            'The listing finance calculator/badge is seller-configurable where supported. Current customer route for general explanation: /services/finance.',
            'CarMazium does not lend money, approve credit or guarantee eligibility or rates. The appointed finance provider handles the formal application, disclosures and decisions.',
            'Finance providers seeking integration/partnership contact the CarMazium team directly, not an ordinary dealership self-service provider registration.'
        ].join(' '),
        sources: ['src/app/services/finance/page.tsx','src/components/finance/FinanceReferralForm.tsx','backend/src/ai/ai.service.ts']
    },
    {
        id: 'tradexchange-jobs',
        triggers: /\b(?:tradexchange|trade exchange|collection service|transport|delivery|recovery|inspection|provider|quote for job|post a job|service job)\b/i,
        facts: [
            'TradeXchange is the CarMazium marketplace for delivery, recovery and independent inspection jobs.',
            'Any signed-in customer can post an eligible service job at /services/jobs/new; see posted jobs at /services/jobs.',
            'Approved and eligible provider businesses see matching available jobs at /dashboard/service/jobs and can quote. Service capability setup is /dashboard/service/capabilities.',
            'Customers compare quotes, accept one, complete the required checkout and can track or confirm service completion in the job detail.',
            'Only approved providers for the relevant service can quote; never guarantee an available provider, service price or immediate booking.',
            'Some service types can be temporarily switched off; refer to /services for actual availability.'
        ].join(' '),
        sources: ['src/app/services/page.tsx','src/app/services/jobs/[id]/page.tsx','src/lib/featureFlags.ts']
    },
    {
        id: 'dealer-services-and-partners',
        triggers: /\b(?:dealer services|service preferences|finance badge|warranty badge|partner|provider setup|opt in|trade services|third.party integration)\b/i,
        facts: [
            'Dealer accounts have opt-in service preferences for Finance badge, Warranty badge, Delivery/Recovery and Inspection. New accounts default the choices on, and a dealer can turn off unwanted services.',
            'Badges on a dealer listing describe that dealer’s services; they do not enrol the dealer as CarMazium’s central warranty or finance provider.',
            'Delivery/recovery and inspection require service capability verification; enabling a preference does not confer approval.',
            'Manage dealership services through the dealer profile/settings, and complete /dashboard/service/capabilities for provider jobs.',
            'Finance, warranty and insurance companies wanting central platform partnerships must contact the CarMazium team.'
        ].join(' '),
        sources: ['src/components/dealer/DealerServicePreferences.tsx','src/app/services/page.tsx','src/app/dashboard/partner/page.tsx']
    },
    {
        id: 'search-buying',
        triggers: /\b(?:search|find a car|find cars|filter|body type|automatic|diesel|petrol|ev|electric|ulez|postcode|near me|budget|price range|saved cars|favourites|hpi|mot)\b/i,
        facts: [
            'Search and filter retail cars at /search; auctions can be browsed at /auctions. Filters include eligible body, fuel, transmission, price, age, mileage and other supported attributes.',
            'MaziuM may return a structured filter card only for filters explicitly requested in the CURRENT message; never carry unrequested filters forward.',
            'Information such as DVLA/MOT history, vehicle provenance/HPI and ULEZ suitability can depend on the listing or a provider check; do not state a specific car is safe, HPI clear, compliant or finance-approved without verified records.',
            'A seller’s description and photos are declarations, not independent guarantees. If data is missing, say it is not shown.'
        ].join(' '),
        sources: ['src/app/search/page.tsx','backend/src/ai/search-filter-contract.ts','src/lib/pricingConfig.ts']
    },
    {
        id: 'account-security-privacy',
        triggers: /\b(?:privacy|gdpr|delete my account|close account|data|notification|settings|password|reset|2fa|security|payout bank|bank payout|payout details|stripe connect|bank details)\b/i,
        facts: [
            'Personal account settings are at /profile. Sections include personal details, notifications, payouts, appearance, security and account controls.',
            'For reward/service payouts, the owner may need to complete the authorised bank or Stripe Connect setup in the Payouts section; never request bank information inside the AI chat.',
            'For support, MaziuM can help with generic instructions but cannot personally access/change bank details, account identity, passwords or credentials.',
            'AI interaction and data-sharing details are in /privacy-policy; customers can stop AI sharing through the AI control where present.',
            'For legal data deletion requests, follow the profile/account controls or human support, subject to lawful retention obligations.'
        ].join(' '),
        sources: ['src/app/profile/page.tsx','src/app/privacy-policy/page.tsx','docs/privacy/ACCOUNT_DELETION_RETENTION.md']
    },
    {
        id: 'cancellations-disputes',
        triggers: /\b(?:cancel(?: my| an| the)? (?:auction )?(?:sale|purchase)|cancellation|refund|chargeback|dispute|complaint|scam|fraud|after.sales|not as described|damage|faulty|return)\b/i,
        facts: [
            'Sale cancellation, fee refunds and disputes depend on recorded transaction status, evidence and applicable terms. Do not approve, promise or calculate a particular refund or legal outcome.',
            'The relevant purchase/transaction detail may offer a cancellation request; CarMazium staff review and handle the decision.',
            'A seller or buyer should keep relevant listing, collection and payment evidence and communicate via the relevant transaction or support chat.',
            'Account-specific complaints, sensitive disputes, fraud and financial requests must be handed to authorised support staff, not answered as if the AI has examined the account.'
        ].join(' '),
        sources: ['backend/src/sale-cancellations/sale-cancellations.service.ts','src/app/terms/page.tsx','src/app/auctions/won/[id]/page.tsx']
    },
    {
        id: 'vehicle-valuation-and-dvla',
        triggers: /\b(?:valuation|value my car|car worth|estimated value|trade value|market value|dvla|mot history|registration lookup|number plate|vrm|make model year|valuation error)\b/i,
        facts: [
            'The car valuation journey is part of /sell, not a separate invented /valuation page. Start with the vehicle registration; a supported manual make/model/year valuation route is available when a registration lookup cannot be completed.',
            'CarMazium estimates auction and retail price guidance from available vehicle and market information; suggestions are not a binding offer or guaranteed sale price.',
            'DVLA and MOT records do not prove actual service history, number of keys, mechanical condition, electrical faults or HPI clearance. The seller supplies truthful declarations.',
            'A touring caravan is listed manually and does not receive the normal registration-based valuation.',
            'If the lookup fails, advise checking the registration and entering correct make/model/year via the available manual option; do not invent a valuation or promise that external data is available.'
        ].join(' '),
        sources: ['src/app/sell/page.tsx','src/lib/valuationApi.ts','backend/src/listings/listings.service.ts']
    },
    {
        id: 'listing-validation-review',
        triggers: /\b(?:missing field|mandatory|required|doors|seats|service history|keys|photos?|pictures?|images?|upload failed|fault declaration|damage|review|approval|rejected|draft|publish|not live|listing pending)\b/i,
        facts: [
            'The Listing Wizard requires accurate vehicle details, service history, keys, separately declared mechanical and electrical faults, and images. Missing required answers are highlighted during submission.',
            'Normal car listings require at least 10 photos to publish; touring caravans have a one-photo minimum. Up to 100 uploaded images are supported; the 10-photo rule is not reimposed merely when editing a previously saved listing.',
            'Listing status progresses through Draft, Pending Review, and approved Active publication; rejection may have a reason. Saving a draft or paying for retail advertising is not proof that a listing is publicly live.',
            'Check the status and any review feedback in the seller My Cars or dealer Inventory dashboard; only authorised staff can confirm why a particular listing was rejected or why an approval failed.',
            'If photos fail to upload, ask for the device and exact error, then give the relevant upload troubleshooting steps without pretending to inspect their files.'
        ].join(' '),
        sources: ['src/components/listing/ListingWizard.tsx','backend/src/listings/listings.service.ts','src/app/dashboard/dealer/inventory/page.tsx']
    },
    {
        id: 'listing-status-and-relisting',
        triggers: /\b(?:relist|re-list|list again|withdraw|remove listing|mark sold|mark as sold|sold elsewhere|expired|auction ended|reserve not met|draft to retail|convert to retail|switch to retail|also list retail|listing status)\b/i,
        facts: [
            'Owners can locate existing listings in private seller My Cars (/dashboard/user?tab=cars) or dealer Stock / Inventory (/dashboard/dealer/inventory). Statuses include Draft, Pending Review, Rejected, Active, Offer Accepted and Sold, with actions dependent on status.',
            'If a vehicle sold elsewhere, use the relevant Mark Sold workflow and identify the outside sale correctly rather than implying that a CarMazium buyer paid or collected it.',
            'An auction ending without meeting reserve is not automatically a completed sale. Depending on its recorded state, the seller dashboard can offer re-auction or moving the saved vehicle details to Retail.',
            'Existing listing edit and relist actions should start with the saved vehicle, not creating an unrelated new listing at /sell; live auction bidding can restrict changes.',
            'Only the owner or authorised team can determine eligibility for a particular status change; MaziuM must not claim it has marked, relisted or approved a vehicle.'
        ].join(' '),
        sources: ['src/app/dashboard/user/page.tsx','src/app/dashboard/dealer/inventory/page.tsx','src/app/dashboard/seller/auctions/page.tsx','backend/src/listings/listings.service.ts']
    },
    {
        id: 'bidding-reserve-and-provisional',
        triggers: /\b(?:bid|place a bid|reserve price|below reserve|reserve offer|provisional|accept bid|reject bid|counter offer|auction extension|anti.snipe|close auction|cancel auction|auction countdown)\b/i,
        facts: [
            'Only verified eligible dealers can bid in trader-only auctions; public browsing is not a bidding entitlement. The status of a bid and whether reserve has been met must be checked in the actual auction.',
            'A seller may receive a provisional offer below reserve after the auction ends. Acceptance is a separate workflow, not an automatic sale; a pending offer can expire if not accepted.',
            'Some late bids extend an active auction, so the visible end time can change. A seller can close or cancel an auction only when the corresponding status and permissions allow it.',
            'Sellers manage auction results and offers from their auction dashboard. Do not claim that a reserve offer is accepted, a winner is final or a vehicle is collected without checking recorded transactions.'
        ].join(' '),
        sources: ['src/app/dashboard/seller/auctions/page.tsx','src/app/auctions/live/[id]/page.tsx','backend/src/auctions/auctions.service.ts']
    },
    {
        id: 'checkout-and-platform-payments',
        triggers: /\b(?:checkout|pay the fee|paying|payment|stripe|card payment|deposit|escrow|direct to seller|receipt for payment|charge|invoice|payment failed)\b/i,
        facts: [
            'CarMazium checkout processes its platform charges (such as the winning auction buyer fee, paid retail listing tier and eligible add-ons), not the car purchase price or a vehicle deposit.',
            'For an auction purchase, the winning dealer pays the £125 platform fee where applicable, then agrees and settles the vehicle purchase price directly with the seller.',
            'A successful payment screen or payment-processing message must not be mistaken for proof of vehicle collection, seller settlement, listing publication, warranty issuance or payout approval.',
            'When checkout fails or is charged twice, do not create a second payment blindly or promise a refund; direct the customer to the relevant payment details and support with evidence.'
        ].join(' '),
        sources: ['src/app/checkout/page.tsx','backend/src/payments/payments.service.ts','src/app/pricing/page.tsx']
    },
    {
        id: 'dealer-purchase-destinations',
        triggers: /\b(?:auction wins|retail purchases|all purchases|purchase history|where is my purchase|missing win|missing purchase|sales receipt|purchase receipt|purchase record|purchased car)\b/i,
        facts: [
            'Dealer buy-side activity has four separate navigation views: Auction Wins (/dashboard/dealer/auctions/won), Retail Purchases (/dashboard/dealer/purchases/retail), All Purchases (/dashboard/dealer/purchases), and Purchase History (/dashboard/dealer/purchases/history).',
            'Auction Wins is for auction-winning deals; Retail Purchases is for retail deals; All Purchases includes recorded activity still in progress; Purchase History focuses on completed or cancelled records.',
            'A purchase record, buyer-fee checkout and collection confirmation represent different stages. A missing purchase or receipt requires an authenticated lookup by support, not a fabricated document or status.',
            'Only authorised dealership users with purchase permissions can access those views; dashboards and mobile UI labels can differ.'
        ].join(' '),
        sources: ['src/lib/purchaseDestinations.ts','src/components/dealer/DealerPurchasesView.tsx','src/app/dashboard/dealer/auctions/won/page.tsx']
    },
    {
        id: 'messaging-notifications',
        triggers: /\b(?:message|inbox|chat|seller chat|chat with|notifications?|alerts?|email notification|unread|talk to staff|support chat|reply to seller)\b/i,
        facts: [
            'Use the listing chat or conversation tools to contact the relevant buyer or seller; support questions go to the official CarMazium support conversation, which is separate from private buyer/seller messaging.',
            'The account notification centre is /notifications, where messages can be marked read; notification preferences including email can be managed from the relevant account settings.',
            'A notification can link to a listing, auction or transaction depending on its type; do not promise all notifications are emails or that a device received a push alert.',
            'MaziuM can explain how chat works, but it cannot view private conversations in the public assistant or impersonate another customer. A request to speak to a human is handed to staff through the official support chat.'
        ].join(' '),
        sources: ['src/app/notifications/page.tsx','src/components/chat/ChatWindow.tsx','backend/src/chat/chat.service.ts']
    },
    {
        id: 'mobile-app-and-installation',
        triggers: /\b(?:mobile app|android|iphone|ios|apple app|play store|apk|download app|install app|app login|mobile menu|phone app|browser app)\b/i,
        facts: [
            'Use /download-app for CarMazium mobile-app download and current installation choices. An installed native app can differ from the latest mobile website until a new app release is distributed.',
            'Account information and listing status come from CarMazium account services; a screenshot from an older app build is not proof that an updated website feature is present in that app.',
            'For device-specific issues, ask whether the customer is using Android, iPhone, or a browser, and request the precise screen/error. Never invent a Play Store or App Store release date.'
        ].join(' '),
        sources: ['src/app/download-app/page.tsx','carmazium app/carmazium app/src/screens/main/ChatScreen.tsx','src/components/features/MaziumWidget.tsx']
    },
    {
        id: 'customer-support',
        triggers: /\b(?:help|support|talk to person|human|contact|customer service|agent|report ai|bug|not working|technical problem|failed to load)\b/i,
        facts: [
            'For normal assistance, MaziuM answers general questions; customers can request a human in their official support chat by typing the request naturally.',
            'Official human handoffs are acknowledged and placed in the existing support conversation. The AI should not promise a response time or say an agent is online.',
            'For inaccurate MaziuM answers, the floating assistant offers Report AI response; reports are reviewed by staff.',
            'Never claim a payment, listing edit, message delivery or account problem has been resolved unless verified by an authorised transaction.',
            'An AI conversation is guidance, not an authorised agent operating the customer account.'
        ].join(' '),
        sources: ['backend/src/chat/support-automatic-responses.ts','backend/src/ai/ai.controller.ts','src/components/features/MaziumWidget.tsx']
    },
];

/**
 * Include broad, stable platform context plus the most relevant workflow
 * entries. This is retrieval from an audited first-party catalogue, not a
 * generative guess and not live access to private account state.
 */
export function platformKnowledgeFor(query: string, maxTopics = 5): string {
    const text = query.trim().slice(0, 600);
    // Specific user journeys must outrank broad words such as "seller",
    // "dealer", "account" and "support". Otherwise the first five generic
    // catalogue entries can displace the topic the customer actually asked.
    const priority: Readonly<Record<string, number>> = {
        'edit-existing-listing': 110,
        'listing-status-and-relisting': 105,
        'listing-validation-review': 100,
        'dealer-purchase-destinations': 100,
        'bidding-reserve-and-provisional': 95,
        'sale-handover-reward': 95,
        'checkout-and-platform-payments': 90,
        'vehicle-valuation-and-dvla': 90,
        'verification-and-kyc': 88,
        'retail-listing-packages': 86,
        'warranty': 86,
        'vehicle-finance': 85,
        'tradexchange-jobs': 85,
        'dealer-services-and-partners': 82,
        'retail-buyer-offers': 80,
        'buyer-and-dealer-purchases': 80,
        'dealer-auctions': 78,
        'sell-caravan-campervan': 78,
        'create-new-listing': 75,
        'messaging-notifications': 75,
        'mobile-app-and-installation': 75,
        'search-buying': 68,
        'account-security-privacy': 67,
        'cancellations-disputes': 89,
        'customer-support': 15,
        'accounts-and-roles': 10,
    };
    const matched = PLATFORM_KNOWLEDGE
        .map((topic, index) => ({ topic, index }))
        .filter(({ topic }) => topic.triggers.test(text))
        .sort((a, b) => (priority[b.topic.id] ?? 50) - (priority[a.topic.id] ?? 50) || a.index - b.index)
        .slice(0, Math.max(1, Math.min(8, maxTopics)))
        .map(({ topic }) => topic);
    const topics = matched.length ? matched : [
        PLATFORM_KNOWLEDGE.find(t => t.id === 'accounts-and-roles')!,
        PLATFORM_KNOWLEDGE.find(t => t.id === 'customer-support')!,
    ];
    return [
        'CARMAZIUM VERIFIED PLATFORM KNOWLEDGE (source-checked, not live account data):',
        ...topics.map(t => `[${t.id}] ${t.facts}`),
        'These facts are public platform guidance only; where a task requires knowing customer permissions, payment, status, current stock or availability, do not guess or imply you checked an account.',
        'Never give an invented CarMazium URL or a made-up button. Prefer the route and UI label from the verified facts; if absent, say you cannot confirm the exact route.',
    ].join('\n');
}
