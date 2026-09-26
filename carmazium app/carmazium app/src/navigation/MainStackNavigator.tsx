import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import { TabNavigator, TabParamList } from './TabNavigator';
import { VehicleDetailScreen } from '../screens/vehicle/VehicleDetailScreen';
import { AuctionDetailScreen } from '../screens/vehicle/AuctionDetailScreen';
import { VehicleDeepLinkScreen } from '../screens/vehicle/VehicleDeepLinkScreen';
import { AuctionDeepLinkScreen } from '../screens/vehicle/AuctionDeepLinkScreen';
import { MessagesScreen } from '../screens/main/MessagesScreen';
import { ChatScreen } from '../screens/main/ChatScreen';
import { CompareScreen } from '../screens/main/CompareScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { DealerAnalyticsScreen } from '../screens/main/DealerAnalyticsScreen';
import { DealerInventoryScreen } from '../screens/main/DealerInventoryScreen';
import { DealerLeadsScreen } from '../screens/main/DealerLeadsScreen';
import { DealerKYCScreen } from '../screens/main/DealerKYCScreen';
// Gates the dealer feature screens behind KYC. Applied here rather than inside
// each screen so every entry path is covered — drawer, deep link and
// notification tap alike, not just the ones that go through a menu.
import { withDealerGate } from '../components/DealerGate';
import { DealerTeamScreen } from '../screens/main/DealerTeamScreen';
import { DealerOnboardingScreen } from '../screens/main/DealerOnboardingScreen';
import { DealerOffersScreen } from '../screens/main/DealerOffersScreen';
import { DealerMyOffersScreen } from '../screens/main/DealerMyOffersScreen';
import { DealerPurchasesScreen } from '../screens/main/DealerPurchasesScreen';
import { DealerEarningsScreen } from '../screens/main/DealerEarningsScreen';
import { DealerFinanceScreen } from '../screens/main/DealerFinanceScreen';
import { ServicesScreen } from '../screens/main/ServicesScreen';
import { CustomerServiceJobsScreen } from '../screens/main/CustomerServiceJobsScreen';
import { CustomerServiceJobDetailScreen } from '../screens/main/CustomerServiceJobDetailScreen';
import { PartnerDashboardScreen } from '../screens/main/PartnerDashboardScreen';
import { ProviderCapabilitiesScreen } from '../screens/main/ProviderCapabilitiesScreen';
import { ProviderVerificationScreen } from '../screens/main/ProviderVerificationScreen';
import { ProviderMatchingScreen } from '../screens/main/ProviderMatchingScreen';
import { ProviderJobsScreen } from '../screens/main/ProviderJobsScreen';
import { ProviderJobDetailScreen } from '../screens/main/ProviderJobDetailScreen';
import { ProviderLeadsScreen } from '../screens/main/ProviderLeadsScreen';
import { ProviderLeadDetailScreen } from '../screens/main/ProviderLeadDetailScreen';
import { ProviderMessagesScreen } from '../screens/main/ProviderMessagesScreen';
import { TermsScreen } from '../screens/main/TermsScreen';
import { PrivacyPolicyScreen } from '../screens/main/PrivacyPolicyScreen';
import { HowItWorksScreen } from '../screens/main/HowItWorksScreen';
import { AboutScreen } from '../screens/main/AboutScreen';
import { ContactScreen } from '../screens/main/ContactScreen';
import { PricingScreen } from '../screens/main/PricingScreen';
import { ReviewsScreen } from '../screens/main/ReviewsScreen';
import { FinanceScreen } from '../screens/main/FinanceScreen';
import { AuctionCompleteScreen } from '../screens/main/AuctionCompleteScreen';
import { NotificationSettingsScreen } from '../screens/main/NotificationSettingsScreen';
import { NotificationsScreen } from '../screens/main/NotificationsScreen';
import { MyListingDashboardScreen } from '../screens/sell/MyListingDashboardScreen';
import { PurchaseFlowScreen } from '../screens/main/PurchaseFlowScreen';
import { SellCarFlowScreen } from '../screens/sell/SellCarFlowScreen';
import { BuyerDashboardScreen } from '../screens/buyer/BuyerDashboardScreen';
import { SellerDashboardScreen } from '../screens/seller/SellerDashboardScreen';
import { UnifiedDashboardScreen } from '../screens/account/UnifiedDashboardScreen';
import { SellerOffersScreen } from '../screens/seller/SellerOffersScreen';
import { BuyerOffersScreen } from '../screens/buyer/BuyerOffersScreen';
import { BuyerBidsScreen } from '../screens/buyer/BuyerBidsScreen';
import { BuyerPurchaseHistoryScreen } from '../screens/buyer/BuyerPurchaseHistoryScreen';
import { BuyerDeliveryRequestsScreen } from '../screens/buyer/BuyerDeliveryRequestsScreen';
import { EarningsScreen } from '../screens/seller/EarningsScreen';
import { SellerProfileScreen } from '../screens/seller/SellerProfileScreen';
import { SellerPerformanceScreen } from '../screens/seller/SellerPerformanceScreen';
import { PaymentHistoryScreen } from '../screens/account/PaymentHistoryScreen';
import { SaleCancellationsScreen } from '../screens/account/SaleCancellationsScreen';
import { SellerListingsScreen } from '../screens/seller/SellerListingsScreen';
import { SellerAuctionsScreen } from '../screens/seller/SellerAuctionsScreen';
import { AcceptInviteScreen } from '../screens/main/AcceptInviteScreen';
import { CarListing } from '../data/listings';
import { Colors } from '../constants/colors';


// Hoisted to module scope on purpose. Calling withDealerGate(...) inline in the
// JSX below would produce a NEW component type on every render of this
// navigator, and React Navigation treats a changed `component` identity as a
// different screen — remounting it and discarding its state on every parent
// render.

const GatedDealerAnalyticsScreen = withDealerGate(DealerAnalyticsScreen, 'VIEW_ANALYTICS');
const GatedDealerInventoryScreen = withDealerGate(DealerInventoryScreen, 'VIEW_INVENTORY');
const GatedDealerLeadsScreen = withDealerGate(DealerLeadsScreen, 'MANAGE_CRM');
const GatedDealerKYCScreen = withDealerGate(DealerKYCScreen, 'MANAGE_KYC', true);
const GatedDealerTeamScreen = withDealerGate(DealerTeamScreen, 'MANAGE_TEAM');
const GatedDealerOffersScreen = withDealerGate(DealerOffersScreen, 'MANAGE_OFFERS');
const GatedDealerMyOffersScreen = withDealerGate(DealerMyOffersScreen, 'MANAGE_OFFERS');
const GatedDealerPurchasesScreen = withDealerGate(DealerPurchasesScreen, 'VIEW_PURCHASES');
const GatedDealerEarningsScreen = withDealerGate(DealerEarningsScreen, 'VIEW_ANALYTICS');
const GatedDealerFinanceScreen = withDealerGate(DealerFinanceScreen);

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  VehicleDetail: { listing: CarListing };
  VehicleDeepLink: { slug: string };
  AuctionDeepLink: { auctionId: string };
  // `auctionId` is what `AuctionDetailScreen` actually reads to find its auction
  // (`AuctionDetailScreen.tsx:261`), but the param was typed as a bare
  // CarListing, so every caller reached it through an `as any` cast
  // (`auctionToListingParam` returns `CarListing & { auctionId }` and casts).
  // Typed honestly now that search also routes here (BUY-017).
  LiveAuctionDetailed: { listing: CarListing & { auctionId?: string } };
  Search: undefined;
  Messages: undefined;
  ChatScreen: { threadId: string };
  Compare: { initialListing?: CarListing } | undefined;
  Settings: undefined;
  DealerAnalytics: undefined;
  DealerInventory: undefined;
  DealerLeads: undefined;
  DealerKYC: {
    businessType?: 'PRIVATE_LIMITED' | 'SOLE_PROPRIETORSHIP';
    reverify?: boolean;
  } | undefined;
  DealerTeam: undefined;
  DealerOnboarding: undefined;
  DealerOffers: undefined;
  DealerMyOffers: undefined;
  DealerPurchases: undefined;
  DealerEarnings: undefined;
  DealerFinance: undefined;
  Services: undefined;
  CustomerServiceJobs: undefined;
  CustomerServiceJobDetail: { jobId: string };
  PartnerDashboard: undefined;
  ProviderCapabilities: undefined;
  ProviderVerification: { capabilityId: string };
  ProviderMatching: { capabilityId: string };
  ProviderJobs: undefined;
  ProviderJobDetail: { jobId: string };
  ProviderLeads: undefined;
  ProviderLeadDetail: { leadId: string };
  ProviderMessages: undefined;
  Terms: undefined;
  PrivacyPolicy: undefined;
  HowItWorks: undefined;
  About: undefined;
  Contact: undefined;
  Pricing: undefined;
  Reviews: undefined;
  Finance: undefined;
  AuctionComplete: {
    listingId: string;
    auctionId: string;
    hammerPrice: number;
    buyerFee?: number;
    bidCount?: number;
    lotNumber?: string;
    listingTitle: string;
    listingImage?: string;
    paymentDeadline?: string;
  } | undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  MyListingDashboard: undefined;
  PurchaseFlow: {
    listingId: string;
    salePrice: number;
    buyerFee?: number;
    listingTitle: string;
    listingImage?: string;
    sellerName?: string;
    paymentType?: 'COMMISSION';
    auctionId?: string;
  } | undefined;
  SellCarFlow: { listingId?: string } | undefined;
  SellerListings: undefined;
  SellerAuctions: { preselectListingId?: string } | undefined;
  BuyerDashboard: undefined;
  SellerDashboard: undefined;
  UnifiedDashboard: undefined;
  SellerOffers: undefined;
  BuyerOffers: undefined;
  BuyerBids: undefined;
  BuyerPurchaseHistory: undefined;
  BuyerDeliveryRequests: undefined;
  Earnings: undefined;
  SellerProfile: { sellerId: string };
  SellerPerformance: undefined;
  PaymentHistory: undefined;
  SaleCancellations: undefined;
  // Was `undefined`, which is why the invite link could not be routed and the
  // screen asked the user to paste it instead (AUTH-030).
  AcceptInvite: { token?: string } | undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export const MainStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: Colors.bgPrimary },
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="VehicleDeepLink"
        component={VehicleDeepLinkScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="AuctionDeepLink"
        component={AuctionDeepLinkScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="VehicleDetail"
        component={VehicleDetailScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="LiveAuctionDetailed"
        component={AuctionDetailScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="ChatScreen"
        component={ChatScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Compare"
        component={CompareScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerAnalytics"
        component={GatedDealerAnalyticsScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerInventory"
        component={GatedDealerInventoryScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerLeads"
        component={GatedDealerLeadsScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerKYC"
        component={GatedDealerKYCScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerTeam"
        component={GatedDealerTeamScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerOnboarding"
        component={DealerOnboardingScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerOffers"
        component={GatedDealerOffersScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerMyOffers"
        component={GatedDealerMyOffersScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerPurchases"
        component={GatedDealerPurchasesScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerEarnings"
        component={GatedDealerEarningsScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerFinance"
        component={GatedDealerFinanceScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Services" component={ServicesScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="CustomerServiceJobs" component={CustomerServiceJobsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="CustomerServiceJobDetail" component={CustomerServiceJobDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PartnerDashboard" component={PartnerDashboardScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProviderCapabilities" component={ProviderCapabilitiesScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProviderVerification" component={ProviderVerificationScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProviderMatching" component={ProviderMatchingScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProviderJobs" component={ProviderJobsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProviderJobDetail" component={ProviderJobDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProviderLeads" component={ProviderLeadsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProviderLeadDetail" component={ProviderLeadDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProviderMessages" component={ProviderMessagesScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="HowItWorks" component={HowItWorksScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Contact" component={ContactScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Pricing" component={PricingScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Finance" component={FinanceScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="AuctionComplete"
        component={AuctionCompleteScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="MyListingDashboard"
        component={MyListingDashboardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="PurchaseFlow"
        component={PurchaseFlowScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="SellCarFlow"
        component={SellCarFlowScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="SellerListings" component={SellerListingsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SellerAuctions" component={SellerAuctionsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="BuyerDashboard"
        component={BuyerDashboardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="SellerDashboard"
        component={SellerDashboardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="UnifiedDashboard"
        component={UnifiedDashboardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="SellerOffers"
        component={SellerOffersScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="BuyerOffers"
        component={BuyerOffersScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen name="BuyerBids" component={BuyerBidsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="BuyerPurchaseHistory" component={BuyerPurchaseHistoryScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="BuyerDeliveryRequests" component={BuyerDeliveryRequestsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SellerPerformance" component={SellerPerformanceScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SaleCancellations" component={SaleCancellationsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AcceptInvite" component={AcceptInviteScreen} options={{ animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
};

