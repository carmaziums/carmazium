import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import { TabNavigator, TabParamList } from './TabNavigator';
import { VehicleDetailScreen } from '../screens/vehicle/VehicleDetailScreen';
import { AuctionDetailScreen } from '../screens/vehicle/AuctionDetailScreen';
import { MessagesScreen } from '../screens/main/MessagesScreen';
import { ChatScreen } from '../screens/main/ChatScreen';
import { CompareScreen } from '../screens/main/CompareScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { DealerAnalyticsScreen } from '../screens/main/DealerAnalyticsScreen';
import { DealerInventoryScreen } from '../screens/main/DealerInventoryScreen';
import { DealerLeadsScreen } from '../screens/main/DealerLeadsScreen';
import { DealerKYCScreen } from '../screens/main/DealerKYCScreen';
import { DealerTeamScreen } from '../screens/main/DealerTeamScreen';
import { DealerOnboardingScreen } from '../screens/main/DealerOnboardingScreen';
import { DealerOffersScreen } from '../screens/main/DealerOffersScreen';
import { DealerMyOffersScreen } from '../screens/main/DealerMyOffersScreen';
import { DealerPurchasesScreen } from '../screens/main/DealerPurchasesScreen';
import { DealerEarningsScreen } from '../screens/main/DealerEarningsScreen';
import { DealerFinanceScreen } from '../screens/main/DealerFinanceScreen';
import { ServicesScreen } from '../screens/main/ServicesScreen';
import { TermsScreen } from '../screens/main/TermsScreen';
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
import { SellerListingsScreen } from '../screens/seller/SellerListingsScreen';
import { SellerAuctionsScreen } from '../screens/seller/SellerAuctionsScreen';
import { AcceptInviteScreen } from '../screens/main/AcceptInviteScreen';
import { WatchlistScreen } from '../screens/main/WatchlistScreen';
import { CarListing } from '../data/listings';
import { Colors } from '../constants/colors';

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  VehicleDetail: { listing: CarListing };
  LiveAuctionDetailed: { listing: CarListing };
  Search: undefined;
  Messages: undefined;
  ChatScreen: { threadId: string };
  Compare: { initialListing?: CarListing } | undefined;
  Settings: undefined;
  DealerAnalytics: undefined;
  DealerInventory: undefined;
  DealerLeads: undefined;
  DealerKYC: undefined;
  DealerTeam: undefined;
  DealerOnboarding: undefined;
  DealerOffers: undefined;
  DealerMyOffers: undefined;
  DealerPurchases: undefined;
  DealerEarnings: undefined;
  DealerFinance: undefined;
  Services: undefined;
  Terms: undefined;
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
    paymentType?: 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION';
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
  AcceptInvite: undefined;
  Watchlist: undefined;
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
        component={DealerAnalyticsScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerInventory"
        component={DealerInventoryScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerLeads"
        component={DealerLeadsScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerKYC"
        component={DealerKYCScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerTeam"
        component={DealerTeamScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerOnboarding"
        component={DealerOnboardingScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerOffers"
        component={DealerOffersScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerMyOffers"
        component={DealerMyOffersScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerPurchases"
        component={DealerPurchasesScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerEarnings"
        component={DealerEarningsScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DealerFinance"
        component={DealerFinanceScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Services" component={ServicesScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ animation: 'slide_from_right' }} />
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
      <Stack.Screen name="AcceptInvite" component={AcceptInviteScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Watchlist" component={WatchlistScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
};

