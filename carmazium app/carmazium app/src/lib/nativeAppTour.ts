/**
 * Native role-specific account tour, aligned to the website's guidedWebsiteTour.
 * Never submits a form, approves content, changes role/settings, bids or pays.
 * The native completion key intentionally differs from website completion state.
 */
export const NATIVE_APP_TOUR_VERSION = 2;
export const nativeTourStorageKey = (userId: string) =>
  `carmazium:native-app-tour:v${NATIVE_APP_TOUR_VERSION}:${userId}`;

export type NativeTourTab =
  'Home' | 'Search' | 'Live' | 'Saved' | 'Profile' | 'DealerHome' |
  'DealerStock' | 'DealerCustomers' | 'DealerBuyBid';

export type TourDestination =
  | { screen: 'Tabs'; tab: NativeTourTab }
  | { screen: string; params?: Record<string, unknown> };

export type NativeTourStep = {
  id: string;
  title: string;
  description: string;
  destination?: TourDestination;
  focus?: 'top' | 'bottom' | 'centre';
};

const step = (
  id: string, title: string, description: string,
  destination?: TourDestination, focus: NativeTourStep['focus'] = 'top',
): NativeTourStep => ({ id, title, description, ...(destination ? { destination } : {}), focus });

const tab = (name: NativeTourTab): TourDestination => ({ screen: 'Tabs', tab: name });
const page = (screen: string, params?: Record<string, unknown>): TourDestination => ({
  screen, ...(params ? { params } : {}),
});

const welcome = step(
  'welcome', 'Let’s explore CarMazium',
  'This walkthrough opens real app pages and highlights how to find their features. Use Next, Back, Jump to a topic or Skip at any time. Voice guidance is optional. Your account permissions still apply. No forms, bids, approvals or payments are submitted.',
);

const dashboard = step(
  'dashboard', 'Your dashboard',
  'Your dashboard brings together vehicle listings, purchases, offers and messages. Use the colourful cards and the account menu to reach the tools available to your account.',
  tab('Profile'),
);

const shared: NativeTourStep[] = [
  step('browse', 'Find a vehicle',
    'Search cars, caravans, campervans, bikes and commercial vehicles. Open the filter controls to narrow results by make, model, price and other details. Inspect photos and contact sellers from the vehicle listing.',
    tab('Search')),
  step('sell', 'Choose how to sell',
    'Choose auction or retail, then follow the native listing form. Auctions are free to list. Basic retail listings start at £1 until sold. Caravans use manual details rather than an automatic valuation.',
    page('SellLanding')),
  step('pricing', 'Listing packages',
    'Compare Basic, Standard and Premium retail packages before selecting. Payment and admin approval requirements still apply. The tour never buys a package.',
    page('Pricing')),
];

const dealer: NativeTourStep[] = [
  step('stock', 'Manage your stock',
    'Find your vehicle stock by registration, make or model. See Live, Under review, Rejected, Draft and Sold statuses. Choose a car to inspect available actions.', tab('DealerStock')),
  step('add', 'Add a vehicle',
    'Add Vehicle lets you choose Auction or Retail, declare faults, add photos and review the listing. Drafts let you return later. The tour does not submit a listing.', page('DealerListingMethod')),
  step('customers', 'Customer enquiries',
    'Vehicle enquiries stay linked to the listing. Record phone, walk-in and other customer interactions, then track follow-ups and their stages.', tab('DealerCustomers')),
  step('own-auctions', 'Your auctions',
    'Track auctions for your own vehicles, their schedules, bids, outcomes and handover requirements.', page('SellerAuctions')),
  step('live', 'Live dealer auctions',
    'Verified dealers can browse live auctions. Review the vehicle, next bid and end time before deciding whether to bid. The winning dealer pays a £125 buyer fee; vehicle funds go directly to the seller.',
    tab('DealerBuyBid')),
  step('bids', 'Your auction bids',
    'Open the Auctions tab and switch to Bids & offers to review live positions, including whether you are leading. A provisional result is still subject to the seller’s decision.',
    tab('DealerBuyBid')),
  step('retail-offers', 'Your retail offers',
    'Review offers you have made on retail vehicles, including current and historical responses.', page('DealerMyOffers')),
  step('offers-received', 'Offers on your stock',
    'Review offers received for your vehicle listings, including the buyer and amount, before taking any action.',
    page('DealerOffers')),
  step('saved', 'Saved vehicles',
    'Your shortlist has Auctions and Retail views. Saving a vehicle does not reserve or purchase it.', tab('Saved')),
  step('purchases', 'Purchases and handovers',
    'Review In progress, Completed and Cancelled purchases, with Auction and Retail filters. Confirm collection only after the vehicle is actually handed over.', page('DealerPurchases')),
  step('messages', 'Dealer messages',
    'Keep every buyer and seller conversation linked to its vehicle. Confirm the participant before replying.', page('Messages')),
  step('team', 'Your dealership team',
    'Review authorised team members and their permissions. This tour never sends an invitation or changes access.', page('DealerTeam')),
  step('finance-calculator', 'Platform finance calculator',
    'Choose whether the platform finance calculator appears on your own listings. This is separate from your own finance-offered badge.', page('DealerFinance')),
  step('analytics', 'Dealership performance',
    'Review recorded enquiries, listing performance and activity for your dealership.', page('DealerAnalytics')),
  step('earnings', 'Sales and earnings',
    'Review completed sales and eligible incentives. Vehicle asking prices are not amounts held by CarMazium.', page('DealerEarnings')),
];

const admin: NativeTourStep[] = [
  step('admin-overview', 'Admin Command Centre',
    'Review live activity, outstanding work and platform-wide performance. Nothing is approved or published during this guide.', page('AdminDashboard')),
  step('admin-listings', 'Listing moderation',
    'Review photographs, seller declarations and approval status before making a moderation decision.', page('AdminListingsReview')),
  step('admin-dealers', 'Dealer verification',
    'Review business and account verification. Existing dealer verification is reused when checking eligible service applications.', page('AdminDealerKyc')),
  step('admin-users', 'Account management',
    'Search for the correct user before inspecting their details or permissions. This tour does not alter accounts.', page('AdminAccounts')),
  step('admin-auctions', 'Auction management',
    'Inspect auction vehicles, seller details, reserves and bid history. No winner is assigned and no bid or reserve is changed here.', page('AdminAuctions')),
  step('admin-transactions', 'Transactions',
    'Review recorded payment statuses. Buyers pay vehicle sellers directly; platform listing fees and service payments are separate.', page('AdminTransactions')),
  step('admin-handovers', 'Vehicle handovers',
    'Review collection evidence and required confirmations before any eligible seller incentive is approved.', page('AdminHandovers')),
  step('admin-analytics', 'Online activity and app installs',
    'View recent visitor signals and reported first opens of the Android and web apps. These do not prove completed vehicle sales.', page('AdminAppInsights')),
];

const personal: NativeTourStep[] = [
  step('my-cars', 'Your vehicle listings',
    'My cars contains your retail and auction listings, drafts and review statuses. Continue unfinished listings and check feedback before publishing.', page('MyCars')),
  step('offers-received', 'Offers you receive',
    'Review offers made on your vehicles and any counter-offers. An accepted offer is not proof that vehicle funds have arrived.', page('SellerOffers')),
  step('earnings', 'Sales and earnings',
    'Track sales and eligible incentives. The seller receives vehicle payment directly from the buyer, followed by any qualifying handover confirmation.', page('Earnings')),
  step('performance', 'Listing performance',
    'See recorded vehicle views and enquiries in the listing-performance report.', page('SellerPerformance')),
  step('offers-made', 'Offers you make',
    'Track offers made on retail vehicles and the seller’s responses. Dealer-auction bidding remains restricted to verified dealers.', page('BuyerOffers')),
  step('saved', 'Saved vehicles',
    'Return to saved cars and check their current availability. Saving a car does not reserve it.', tab('Saved')),
  step('purchases', 'Your purchases',
    'Review vehicles you agreed to buy, payment arrangements and collection. Check the seller and vehicle before proceeding.', page('BuyerPurchaseHistory')),
  step('messages', 'Your messages',
    'Read conversations in their vehicle context. Check the recipient and listing before sending a message.', page('Messages')),
  step('warranties', 'Warranty purchases',
    'Review warranties and their terms and claim limits. A dealership warranty badge is not the same as a CarMazium warranty order.', page('WarrantyOrders')),
  step('services', 'Delivery requests',
    'Review delivery requests and their progress. Confirm vehicle and provider details before accepting a quote. The tour does not request or pay for delivery.', page('BuyerDeliveryRequests')),
  step('cancellations', 'Sale cancellations',
    'View cancellation requests and their status. Submitting a request alone does not cancel a sale.', page('SaleCancellations')),
];

const partner: NativeTourStep[] = [
  step('services', 'Service-provider overview',
    'Review your approved services, job activity and released earnings. Preferences alone do not grant service approval.', page('ProviderOverview')),
  step('capabilities', 'Service setup and verification',
    'Review verification, payout information and service permissions. Collection, delivery and recovery require trade insurance; vehicle inspection does not require inspection documents.', page('ProviderCapabilities')),
  step('jobs', 'Available service jobs',
    'Review jobs matching your approved service categories, and quote only when eligible.', page('ProviderJobs', { initialTab: 'open' })),
  step('my-work', 'Your assigned jobs',
    'Review the jobs assigned to you and their payment and completion requirements.', page('ProviderJobs', { initialTab: 'assigned' })),
  step('messages', 'Service messages',
    'Check provider conversations and job details before responding.', page('ProviderMessages')),
];

const specialist: NativeTourStep[] = [
  step('specialist-home', 'Your partner workspace',
    'Review the account-specific partner tools and integration status available for your specialist role.', tab('Profile')),
  step('messages', 'Messages',
    'Check support conversations and relevant job context before replying.', page('Messages')),
];

const settings = (
  id: string, title: string, description: string, section: string,
): NativeTourStep => step(id, title, description, page('Settings', { section }));

const commonSettings: NativeTourStep[] = [
  settings('settings-personal', 'Personal details',
    'Keep your name, contact information and location current. Review any change before saving.', 'personal'),
  settings('settings-notifications', 'Notifications & privacy',
    'Choose supported notification and public-profile preferences. Essential transaction messages still apply.', 'notifications'),
  settings('settings-payouts', 'Payouts & bank account',
    'Check your payout connection and bank details. Buyers pay sellers directly. Service payouts require verified details.', 'payouts'),
  settings('settings-appearance', 'Appearance',
    'Switch between light and dark mode. Your selected theme is applied across native screens.', 'appearance'),
  settings('settings-security', 'Password and security',
    'Manage your account security. Deletion is permanent and this tour never changes security settings.', 'security'),
  settings('settings-reviews', 'Ratings and reviews',
    'Review the feedback you received and the reviews you have given.', 'reviews'),
  settings('settings-account', 'Account type',
    'Review the account type and available options. Changing roles can affect your permissions and features.', 'account'),
];

export function getNativeAppTourSteps(accountRole: string): NativeTourStep[] {
  const roleSteps = accountRole === 'admin' ? admin
    : accountRole === 'dealer' ? dealer
    : accountRole === 'contractor' ? partner
    : ['finance_partner', 'insurance_partner'].includes(accountRole) ? specialist
    : personal;
  const dealerOrContractor = accountRole === 'dealer' || accountRole === 'contractor';
  const specialistRole = accountRole === 'finance_partner' || accountRole === 'insurance_partner';
  const detailSettings = commonSettings.filter(s => !specialistRole || s.id !== 'settings-payouts');
  const businessSettings = dealerOrContractor ? [
    settings('settings-business', 'Business services',
      'Manage your business and service preferences, including finance and warranty listing badges and collection, delivery and inspection switches.', 'business'),
    settings('settings-verification', 'Business verification',
      'Review account verification and approval requirements. Your original dealer verification is not charged again for services.', 'verification'),
  ] : [];
  const roleShared = accountRole === 'admin' ? [] : shared;
  const roleDashboard = accountRole === 'admin' ? [] : [dashboard];

  return [
    welcome, ...roleDashboard, ...roleShared, ...roleSteps,
    ...businessSettings, ...detailSettings,
    step('finish', 'Replay whenever you need',
      'Open Account Settings, Personal details, and choose the red Replay App Tour button to start this guided walkthrough again. Voice guidance is optional.',
      page('Settings', { section: 'personal' })),
  ];
}

type ReplayListener = () => void;
const replayListeners = new Set<ReplayListener>();
export function requestNativeAppTourReplay() { replayListeners.forEach(listener => listener()); }
export function subscribeNativeAppTourReplay(listener: ReplayListener) {
  replayListeners.add(listener);
  return () => { replayListeners.delete(listener); };
}
