/**
 * Native account tour. Keep this separate from pre-sign-in welcome slides and
 * websiteIntroductionV2: each client needs its own completion/replay state.
 */
export const NATIVE_APP_TOUR_VERSION = 1;
export const nativeTourStorageKey = (userId: string) =>
  `carmazium:native-app-tour:v${NATIVE_APP_TOUR_VERSION}:${userId}`;

export type TourDestination =
  | { screen: 'Tabs'; tab: 'Home' | 'Search' | 'Live' | 'Saved' | 'Profile' }
  | { screen: string; params?: Record<string, unknown> };

export type NativeTourStep = {
  id: string;
  title: string;
  description: string;
  destination?: TourDestination;
  focus?: 'top' | 'bottom' | 'centre';
};

const dashboard: NativeTourStep = {
  id: 'dashboard', title: 'Your dashboard',
  description: 'Your dashboard brings together your listings, purchases, offers and messages. Select a card to open its native screen. Each account sees the tools available to its role.',
  destination: { screen: 'Tabs', tab: 'Profile' }, focus: 'top',
};

const shared: NativeTourStep[] = [
  {
    id: 'browse', title: 'Find a vehicle',
    description: 'Browse cars, caravans, campervans and other vehicles. Apply search filters and open listings to review photographs, vehicle information and seller contact options.',
    destination: { screen: 'Tabs', tab: 'Search' }, focus: 'top',
  },
  {
    id: 'auctions', title: 'Explore live auctions',
    description: 'View auction vehicles and their details here. Only verified motor traders can place auction bids. Winning dealers pay the CarMazium auction buyer fee.',
    destination: { screen: 'Tabs', tab: 'Live' }, focus: 'top',
  },
  {
    id: 'sell', title: 'Auction or retail selling',
    description: 'Choose free auction listing or a retail listing, starting at £1 for Basic. The £100 auction seller reward applies only after a qualifying completed sale and approved handover. This tour never creates a listing.',
    destination: { screen: 'SellLanding' }, focus: 'top',
  },
  {
    id: 'pricing', title: 'Compare listing packages',
    description: 'Review Basic, Standard and Premium retail options and their current features before selecting a package. No payments are made during the tour.',
    destination: { screen: 'Pricing' }, focus: 'top',
  },
];

const dealer: NativeTourStep[] = [
  {
    id: 'inventory', title: 'Manage dealership stock',
    description: 'See live, draft, under-review and sold vehicles. Search your stock, add a vehicle and manage its status from the inventory screen.',
    destination: { screen: 'DealerInventory' }, focus: 'top',
  },
  {
    id: 'customers', title: 'Customer enquiries',
    description: 'Review enquiries linked to your vehicles and manage your follow-ups. Record phone calls and walk-in customers without losing the vehicle context.',
    destination: { screen: 'DealerLeads' }, focus: 'top',
  },
  {
    id: 'bids', title: 'Bids and retail offers',
    description: 'Track auction bids you have placed and offers made on retail vehicles. Review the amount and sale status before responding.',
    destination: { screen: 'DealerMyOffers' }, focus: 'top',
  },
  {
    id: 'purchases', title: 'Purchases and handovers',
    description: 'Review purchases in progress and completed or cancelled transactions. Confirm collection only after the actual vehicle handover.',
    destination: { screen: 'DealerPurchases' }, focus: 'top',
  },
  {
    id: 'services', title: 'Dealership services',
    description: 'Explore collection, delivery, recovery and inspection services. Approval, verification and payout requirements still apply before taking service jobs.',
    destination: { screen: 'ProviderOverview' }, focus: 'top',
  },
];

const personal: NativeTourStep[] = [
  {
    id: 'my-cars', title: 'Your vehicle listings',
    description: 'Manage your current listings and unfinished drafts here. Check review feedback and continue a listing whenever you are ready.',
    destination: { screen: 'MyListingDashboard' }, focus: 'top',
  },
  {
    id: 'saved', title: 'Saved vehicles',
    description: 'Keep interesting vehicles together and return to them later. Saving a vehicle does not reserve it or confirm a purchase.',
    destination: { screen: 'Tabs', tab: 'Saved' }, focus: 'top',
  },
  {
    id: 'purchases', title: 'Your purchases',
    description: 'Check your purchase history and follow your agreed purchase and collection arrangements. Vehicle payments go directly to the seller.',
    destination: { screen: 'BuyerPurchaseHistory' }, focus: 'top',
  },
  {
    id: 'messages', title: 'Messages and support',
    description: 'Talk to vehicle sellers and buyers in their relevant conversations. Check the vehicle and participant before sending information.',
    destination: { screen: 'Messages' }, focus: 'top',
  },
];

const partner: NativeTourStep[] = [
  {
    id: 'jobs', title: 'Service jobs',
    description: 'Check available and assigned delivery, recovery or inspection work. Only bid on or accept a job when your business is approved for that service.',
    destination: { screen: 'ProviderJobs' }, focus: 'top',
  },
];

const admin: NativeTourStep[] = [
  {
    id: 'admin', title: 'Admin dashboard',
    description: 'Use the admin dashboard to review operational tasks and jump into moderation, accounts, handovers and platform activity. The tour never approves or changes live records.',
    destination: { screen: 'AdminDashboard' }, focus: 'top',
  },
];

export function getNativeAppTourSteps(accountRole: string): NativeTourStep[] {
  const welcome: NativeTourStep = {
    id: 'welcome', title: 'Welcome to the CarMazium app',
    description: 'This guided tour takes you around real pages of the Android app. Use Next, Back or Skip at any time. Optional voice narration can read each explanation. No bids, listings or payments are submitted.',
  };
  const roleSteps = accountRole === 'dealer' ? dealer
    : accountRole === 'admin' ? admin
    : accountRole === 'contractor' ? partner
    : accountRole === 'finance_partner' || accountRole === 'insurance_partner' ? []
    : personal;
  const settings: NativeTourStep = {
    id: 'settings', title: 'Account settings and tour replay',
    description: 'Manage your personal details, account preferences and security. To see this guide again, open Account Settings, Personal details and choose Replay App Tour.',
    destination: { screen: 'Settings', params: { section: 'personal' } }, focus: 'top',
  };
  const usefulShared = accountRole === 'admin' ? shared.slice(0, 2) : shared;
  return [welcome, dashboard, ...usefulShared, ...roleSteps, settings];
}

type ReplayListener = () => void;
const replayListeners = new Set<ReplayListener>();

/** Local event, not account mutation. The Settings button triggers this. */
export function requestNativeAppTourReplay() {
  replayListeners.forEach(listener => listener());
}
export function subscribeNativeAppTourReplay(listener: ReplayListener) {
  replayListeners.add(listener);
  return () => { replayListeners.delete(listener); };
}
