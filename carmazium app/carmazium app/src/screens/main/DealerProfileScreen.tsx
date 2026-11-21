import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, RefreshControl } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { DealerWebParityOverview, type DealerHomeDestination } from './DealerWebParityOverview';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { apiClient } from '../../lib/apiClient';
import { useDealerAccess } from '../../hooks/useDealerAccess';
import { useAuthStore } from '../../store/authStore';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';

type NavProp = NativeStackNavigationProp<MainStackParamList>;
export const DealerProfileScreen: React.FC = () => {
  const tabBarClearance = useTabBarClearance();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();
  const { access, hasPermission, loading: accessLoading } = useDealerAccess(true);
  const [overviewRefreshToken, setOverviewRefreshToken] = useState(0);
  const canManageInventory = hasPermission('MANAGE_INVENTORY');
  const canManageCrm = hasPermission('MANAGE_CRM');
  const canManageOffers = hasPermission('MANAGE_OFFERS');
  const canViewPurchases = hasPermission('VIEW_PURCHASES');
  const canViewTrade = hasPermission('VIEW_TRADE');
  const canViewAnalytics = hasPermission('VIEW_ANALYTICS');
  // Web blocks the whole dealer dashboard with a non-dismissable modal until
  // a verified dealer sets a contact phone (DealerPhoneGate). Mobile uses a
  // softer, dismissible-but-recurring banner instead — a full-screen block
  // is a heavier interruption than anything else in this app and risks
  // firing at an awkward moment (e.g. a deep link into a specific screen).
  // Dismissal is local-state only (no persisted "seen" flag), so it comes
  // back next session until the dealer actually sets a phone (mobile-
  // production-readiness-plan.md F19). Without this, phone-less dealer
  // listings show no contact number to buyers (per F7's gating) with
  // nothing on mobile telling the dealer why.
  const [dealerPhone, setDealerPhone] = useState<string | null>(null);
  const [phoneCheckDone, setPhoneCheckDone] = useState(false);
  const [phoneBannerDismissed, setPhoneBannerDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient<{ success: boolean; data: any }>('/users/me');
        if (res?.success) setDealerPhone(res.data?.dealerProfile?.phone ?? null);
      } catch { /* fail open — don't nag if we can't tell */ }
      finally { setPhoneCheckDone(true); }
    })();
  }, []);

  const showPhoneBanner =
    phoneCheckDone
    && access?.isOwner === true
    && !dealerPhone
    && !phoneBannerDismissed;


  const openMainAction = (destination: DealerHomeDestination) => {
    switch (destination) {
      case 'add-vehicle': if (canManageInventory) navigation.navigate('SellCarFlow'); break;
      case 'customers': if (canManageCrm) navigation.navigate('DealerLeads'); break;
      case 'buy-and-bid': if (canViewTrade) navigation.navigate('Tabs', { screen: 'DealerBuyBid' }); break;
      case 'partner-services': navigation.navigate('PartnerDashboard'); break;
      case 'performance': if (canViewAnalytics) navigation.navigate('DealerAnalytics'); break;
      case 'stock': if (hasPermission('VIEW_INVENTORY')) navigation.navigate('DealerInventory'); break;
      case 'offers': if (canManageOffers) navigation.navigate('DealerOffers'); break;
      case 'manage-auctions': if (canManageInventory) navigation.navigate('SellerAuctions'); break;
      case 'messages': navigation.navigate('Messages'); break;
      case 'won-auctions': if (canViewPurchases) navigation.navigate('DealerPurchases', { channel: 'auction' }); break;
    }
  };
  const dealerDisplayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return <View style={styles.container}>
    <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
    <WebsiteTopBar />
    <ScrollView contentContainerStyle={{ paddingTop: 32, paddingBottom: tabBarClearance }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => setOverviewRefreshToken(token => token + 1)} tintColor={Colors.accent} />}>
        {showPhoneBanner && (
          <TouchableOpacity
            style={styles.phoneBanner}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Settings' as any)}
          >
            <Ionicons name="call-outline" size={18} color={Colors.warning} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.phoneBannerTitle}>Add a contact phone</Text>
              <Text style={styles.phoneBannerSub}>Buyers can't see a number to call you until you set one in Settings.</Text>
            </View>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); setPhoneBannerDismissed(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Dismiss"
            >
              <Ionicons name="close" size={16} color={Colors.iconMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

      <DealerWebParityOverview accessLoading={accessLoading} userName={dealerDisplayName || 'Dealer'}
        canManageInventory={canManageInventory} canManageCrm={canManageCrm}
        canManageOffers={canManageOffers} canViewPurchases={canViewPurchases}
        canViewTrade={canViewTrade} canViewAnalytics={canViewAnalytics}
        onNavigate={openMainAction} refreshToken={overviewRefreshToken} />
    </ScrollView>
  </View>;
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  phoneBanner: { marginHorizontal: 20, marginBottom: 16, padding: 14, borderRadius: 14, backgroundColor: Colors.warningAlpha08, borderWidth: 1, borderColor: Colors.warningAlpha15, flexDirection: 'row', alignItems: 'center' },
  phoneBannerTitle: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: 14 },
  phoneBannerSub: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
});
