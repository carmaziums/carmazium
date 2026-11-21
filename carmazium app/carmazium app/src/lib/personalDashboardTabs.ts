/**
 * The website uses a four-shortcut personal dashboard bottom bar.
 * It is separate from the general marketplace tabs (Home / Buy / Auctions / Saved).
 * Reference: src/components/dashboard/DashboardSidebar.tsx.
 */
export type PersonalDashboardRole = 'buyer' | 'seller';
export type PersonalDashboardRoute = 'Profile' | 'MyCars' | 'SellerOffers' | 'BuyerOffers' | 'BuyerPurchaseHistory' | 'Messages';
export type PersonalDashboardTab = {
  label: string;
  icon: string;
  route: PersonalDashboardRoute;
};

const sellerTabs: readonly PersonalDashboardTab[] = [
  { label: 'Home', icon: 'grid-outline', route: 'Profile' },
  { label: 'My cars', icon: 'car-outline', route: 'MyCars' },
  { label: 'Offers Received', icon: 'pricetag-outline', route: 'SellerOffers' },
  { label: 'Messages', icon: 'chatbubble-outline', route: 'Messages' },
];
const buyerTabs: readonly PersonalDashboardTab[] = [
  { label: 'Home', icon: 'grid-outline', route: 'Profile' },
  { label: 'My Offers', icon: 'hammer-outline', route: 'BuyerOffers' },
  { label: 'Purchases', icon: 'receipt-outline', route: 'BuyerPurchaseHistory' },
  { label: 'Messages', icon: 'chatbubble-outline', route: 'Messages' },
];

export const getPersonalDashboardTabs = (role: PersonalDashboardRole): readonly PersonalDashboardTab[] =>
  role === 'seller' ? sellerTabs : buyerTabs;

export const isPersonalDashboardRoute = (routeName: string): boolean =>
  ['MyCars', 'SellerListings', 'SellerOffers', 'BuyerOffers', 'BuyerPurchaseHistory', 'Messages'].includes(routeName);

export function personalTabIsActive(route: PersonalDashboardRoute, activeRoute: string): boolean {
  if (route === 'MyCars') return activeRoute === 'MyCars' || activeRoute === 'SellerListings';
  return route === activeRoute;
}
