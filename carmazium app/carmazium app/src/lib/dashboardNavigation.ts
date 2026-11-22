import type { MainStackParamList } from '../navigation/MainStackNavigator';
import type { TabParamList } from '../navigation/TabNavigator';
import type { DealerPermission } from './dealerAccessApi';

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  iconLib: 'ion' | 'mci';
  tabName?: keyof TabParamList;
  tabParams?: { initialSection: 'live' | 'bids' };
  /** Params for a tab screen, e.g. DealerStock's status filter. */
  tabStackParams?: Record<string, unknown>;
  stackScreen?: keyof MainStackParamList;
  /** Params for `stackScreen` (e.g. CreateServiceJob's serviceType). */
  stackParams?: Record<string, unknown>;
  action?: 'alert';
  alertTitle?: string;
  alertMsg?: string;
  requiredPermission?: DealerPermission;
  /**
   * Menu group heading. Public items use the website header's dropdown
   * groups (Buy Cars / Sell Cars / TradeXchange); account items use the
   * website DashboardSidebar sections, in the same order.
   */
  section?: string;
}

// Website provider sidebar (DashboardSidebar.tsx `provider` links).
export const PROVIDER_ITEMS: MenuItem[] = [
  { id: 'provider-home', section: 'Services', label: 'TradeXchange', icon: 'briefcase-outline', iconLib: 'ion', stackScreen: 'PartnerDashboard' },
  { id: 'provider-messages', section: 'Account', label: 'Messages', icon: 'chatbubbles-outline', iconLib: 'ion', stackScreen: 'ProviderMessages' },
  { id: 'provider-settings', section: 'Account', label: 'Account Settings', icon: 'settings-outline', iconLib: 'ion', stackScreen: 'Settings' },
];

// Website DashboardSidebar `unifiedLinks` — buyer and seller share one
// dashboard. Same sections, labels and order.
export const USER_ITEMS: MenuItem[] = [
  { id: 'user-dashboard', section: 'Dashboard', label: 'Home', icon: 'grid-outline', iconLib: 'ion', tabName: 'Profile' },
  { id: 'user-cars', section: 'Selling', label: 'My Cars', icon: 'car-outline', iconLib: 'ion', stackScreen: 'MyCars' },
  { id: 'user-enquiries', section: 'Selling', label: 'Guest Enquiries', icon: 'mail-outline', iconLib: 'ion', stackScreen: 'GuestEnquiries' },
  { id: 'user-incoming-offers', section: 'Selling', label: 'Offers Received', icon: 'pricetag-outline', iconLib: 'ion', stackScreen: 'SellerOffers' },
  { id: 'user-earnings', section: 'Selling', label: 'Sales & Earnings', icon: 'wallet-outline', iconLib: 'ion', stackScreen: 'Earnings' },
  { id: 'user-performance', section: 'Selling', label: 'Listing Performance', icon: 'bar-chart-outline', iconLib: 'ion', stackScreen: 'SellerPerformance' },
  { id: 'user-sent-offers', section: 'Buying', label: 'My Offers', icon: 'hammer-outline', iconLib: 'ion', stackScreen: 'BuyerOffers' },
  { id: 'user-auction-bids', section: 'Buying', label: 'My Auction Bids', icon: 'gavel', iconLib: 'mci', stackScreen: 'BuyerBids' },
  { id: 'user-watchlist', section: 'Buying', label: 'Saved Cars', icon: 'heart-outline', iconLib: 'ion', tabName: 'Saved' },
  { id: 'user-purchases', section: 'Buying', label: 'Purchases', icon: 'receipt-outline', iconLib: 'ion', stackScreen: 'BuyerPurchaseHistory' },
  { id: 'user-service-jobs', section: 'Services', label: 'Delivery & Inspections', icon: 'briefcase-outline', iconLib: 'ion', stackScreen: 'CustomerServiceJobs' },
  { id: 'user-deliveries', section: 'Services', label: 'Seller Delivery Requests', icon: 'car-outline', iconLib: 'ion', stackScreen: 'BuyerDeliveryRequests' },
  { id: 'user-warranties', section: 'Services', label: 'Warranty Orders', icon: 'shield-checkmark-outline', iconLib: 'ion', stackScreen: 'WarrantyOrders' },
  { id: 'user-cancellations', section: 'Account', label: 'Sale Cancellations', icon: 'shield-checkmark-outline', iconLib: 'ion', stackScreen: 'SaleCancellations' },
  { id: 'user-messages', section: 'Account', label: 'Messages', icon: 'chatbubbles-outline', iconLib: 'ion', stackScreen: 'Messages' },
  { id: 'user-settings', section: 'Account', label: 'Account Settings', icon: 'settings-outline', iconLib: 'ion', stackScreen: 'Settings' },
];

// ADMIN accounts: "Admin Control Panel" is the website user-dropdown label.
export const ADMIN_ITEMS: MenuItem[] = [
  { id: 'admin-dashboard', label: 'Admin Control Panel', icon: 'shield-checkmark', iconLib: 'ion', stackScreen: 'AdminDashboard' },
];

// Website dealer sidebar (src/config/dealerRouteConfig.ts + DashboardSidebar
// "More" sheet): Dashboard › Sell › Buy › Business › Services, same labels and
// order. Permissions are filtered before rendering, so staff never gain access.
export const DEALER_ITEMS: MenuItem[] = [
  { id: 'dealer-home', section: 'Dashboard', label: 'Home', icon: 'grid-outline', iconLib: 'ion', tabName: 'DealerHome' },
  { id: 'dealer-stock', section: 'Sell', label: 'Stock', icon: 'car-outline', iconLib: 'ion', requiredPermission: 'VIEW_INVENTORY', tabName: 'DealerStock' },
  { id: 'dealer-customers', section: 'Sell', label: 'Customers', icon: 'people-outline', iconLib: 'ion', requiredPermission: 'MANAGE_CRM', tabName: 'DealerCustomers' },
  { id: 'dealer-enquiries', section: 'Sell', label: 'Guest Enquiries', icon: 'mail-outline', iconLib: 'ion', requiredPermission: 'MANAGE_CRM', stackScreen: 'GuestEnquiries' },
  { id: 'dealer-auctions', section: 'Sell', label: 'My Auctions', icon: 'gavel', iconLib: 'mci', requiredPermission: 'VIEW_TRADE', stackScreen: 'SellerAuctions' },
  { id: 'dealer-offers', section: 'Sell', label: 'Offers received', icon: 'pricetag-outline', iconLib: 'ion', requiredPermission: 'MANAGE_OFFERS', stackScreen: 'DealerOffers' },
  { id: 'dealer-live', section: 'Buy', label: 'Live Auctions', icon: 'gavel', iconLib: 'mci', requiredPermission: 'VIEW_TRADE', tabName: 'DealerBuyBid', tabParams: { initialSection: 'live' } },
  { id: 'dealer-wishlist', section: 'Buy', label: 'Saved', icon: 'heart-outline', iconLib: 'ion', stackScreen: 'DealerSaved' },
  { id: 'dealer-bids', section: 'Buy', label: 'Bids & Offers', icon: 'pricetag-outline', iconLib: 'ion', requiredPermission: 'VIEW_TRADE', tabName: 'DealerBuyBid', tabParams: { initialSection: 'bids' } },
  { id: 'dealer-offers-only', section: 'Buy', label: 'Bids & Offers', icon: 'pricetag-outline', iconLib: 'ion', requiredPermission: 'MANAGE_OFFERS', stackScreen: 'DealerMyOffers' },
  { id: 'dealer-purchases', section: 'Buy', label: 'Purchases', icon: 'bag-outline', iconLib: 'ion', requiredPermission: 'VIEW_PURCHASES', stackScreen: 'DealerPurchases' },
  { id: 'dealer-messages', section: 'Business', label: 'Messages', icon: 'chatbubble-outline', iconLib: 'ion', stackScreen: 'Messages' },
  { id: 'dealer-team', section: 'Business', label: 'Team', icon: 'people-outline', iconLib: 'ion', requiredPermission: 'MANAGE_TEAM', stackScreen: 'DealerTeam' },
  { id: 'dealer-settings', section: 'Business', label: 'Account Settings', icon: 'settings-outline', iconLib: 'ion', stackScreen: 'Settings', stackParams: { section: 'business' } },
  { id: 'dealer-finance', section: 'Business', label: 'Finance Calculator', icon: 'cash-outline', iconLib: 'ion', stackScreen: 'DealerFinance' },
  { id: 'dealer-analytics', section: 'Business', label: 'Analytics', icon: 'bar-chart-outline', iconLib: 'ion', requiredPermission: 'VIEW_ANALYTICS', stackScreen: 'DealerAnalytics' },
  { id: 'dealer-earnings', section: 'Business', label: 'Earnings', icon: 'receipt-outline', iconLib: 'ion', requiredPermission: 'VIEW_ANALYTICS', stackScreen: 'DealerEarnings' },
  { id: 'dealer-partner', section: 'Services', label: 'TradeXchange', icon: 'briefcase-outline', iconLib: 'ion', stackScreen: 'PartnerDashboard' },
  { id: 'dealer-warranties', section: 'Services', label: 'Warranty Orders', icon: 'shield-checkmark-outline', iconLib: 'ion', stackScreen: 'WarrantyOrders' },
];

