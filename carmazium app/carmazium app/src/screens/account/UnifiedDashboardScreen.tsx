import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DashboardCards } from '../../components/DashboardCards';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Button } from '../../components/Button';
import { Ionicons } from '../../components/BrandIcon';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../lib/apiClient';
import { fetchAllMyAuctions } from '../../lib/myAuctionsApi';
import { getReceivedDeliveryRequests } from '../../lib/deliveryApi';
import { buildUserAttentionItems, type UserAttentionItem } from '../../lib/userAttention';
import type { AttentionAuction } from '../../lib/dealerAttention';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

interface Summary {
  buyer: { counteredOffersPending: number };
  seller: { incomingOffers: number };
  unreadMessages: number;
}
interface Checks { summary: Summary | null; auctions: AttentionAuction[]; deliveries: number; failed: boolean }
const EMPTY: Checks = { summary: null, auctions: [], deliveries: 0, failed: false };
const icons: Record<UserAttentionItem['kind'], string> = {
  provisional: 'hammer-outline', handover: 'car-outline', incomingOffers: 'pricetag-outline',
  counterOffers: 'repeat-outline', deliveryRequests: 'car-outline', messages: 'chatbubbles-outline',
};

/** The website has one personal home for buyers AND sellers. Keep all entry
 * points on this screen so a buyer who lists a car never loses seller tasks. */
export const UnifiedDashboardScreen: React.FC<{ navigation?: any }> = () => {
  const navigation = useNavigation<any>();
  const userId = useAuthStore(s => s.user?.id);
  const clearance = useTabBarClearance();
  const sequence = useRef(0);
  const [checks, setChecks] = useState<Checks>(EMPTY);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setChecks(EMPTY);
    const [summary, auctions, deliveries] = await Promise.allSettled([
      apiClient<{ success: boolean; data: Summary }>('/dashboard/unified').then(result => {
        const data = result?.data;
        if (!result?.success || !data?.buyer || !data?.seller ||
          ![data.buyer.counteredOffersPending, data.seller.incomingOffers, data.unreadMessages]
            .every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)) {
          throw Error('Dashboard checks unavailable');
        }
        return data;
      }),
      fetchAllMyAuctions<AttentionAuction>('list'),
      getReceivedDeliveryRequests(),
    ]);
    if (request !== sequence.current) return;
    setChecks({
      summary: summary.status === 'fulfilled' ? summary.value : null,
      auctions: auctions.status === 'fulfilled' ? auctions.value : [],
      deliveries: deliveries.status === 'fulfilled' ? deliveries.value.filter(d => d.status === 'PENDING').length : 0,
      failed: [summary, auctions, deliveries].some(result => result.status === 'rejected'),
    });
    setLoading(false);
  }, [userId]);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { sequence.current += 1; };
  }, [load]));

  const items = buildUserAttentionItems({
    now: Date.now(), myAuctions: checks.auctions,
    incomingOffers: checks.summary?.seller.incomingOffers ?? 0,
    counterOffersAwaitingMe: checks.summary?.buyer.counteredOffersPending ?? 0,
    pendingDeliveryRequests: checks.deliveries, unreadMessages: checks.summary?.unreadMessages ?? 0,
  });
  const open = (item: UserAttentionItem) => {
    switch (item.kind) {
      case 'provisional': navigation.navigate('AuctionDeepLink', { auctionId: item.href.split('/').pop() }); break;
      case 'handover': navigation.navigate('SellerAuctions'); break;
      case 'incomingOffers': navigation.navigate('SellerOffers'); break;
      case 'counterOffers': navigation.navigate('BuyerOffers'); break;
      case 'deliveryRequests': navigation.navigate('BuyerDeliveryRequests'); break;
      case 'messages': navigation.navigate('Messages'); break;
    }
  };
  return <View style={styles.screen}>
    <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
    <WebsiteTopBar />
    <ScrollView contentContainerStyle={{ paddingBottom: clearance }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={Colors.accent} />}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>My Dashboard</Text>
        <Text style={styles.subtitle}>Everything you need to buy, sell and manage your cars in one place.</Text>
      </View>
      <View style={styles.attention}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Needs your attention</Text>
        <Text style={styles.hint}>Your to-do list, most urgent first.</Text>
        {loading ? <ActivityIndicator accessibilityLabel="Checking your account" color={Colors.accent} /> : <>
          {checks.failed && <View accessibilityRole="alert" style={styles.warning}>
            <Text style={styles.body}>Some checks failed. This list may be incomplete. Open your offers, auctions or messages to check them directly.</Text>
            <Button label="Retry checks" size="sm" variant="outline" onPress={() => void load()} />
          </View>}
          {!items.length && !checks.failed && checks.summary && <View style={styles.clear}>
            <Ionicons name="checkmark-circle-outline" size={22} color={Colors.success} />
            <Text style={[styles.body, styles.flex]}>You're all caught up. Nothing needs your attention right now.</Text>
          </View>}
          {items.map(item => <TouchableOpacity key={item.key} accessibilityRole="button" accessibilityLabel={item.title}
            onPress={() => open(item)} style={[styles.task, item.urgent && styles.urgent]} activeOpacity={0.8}>
            <Ionicons name={icons[item.kind] as any} size={22} color={item.urgent ? Colors.warning : Colors.accent} />
            <View style={styles.flex}><Text style={styles.taskTitle}>{item.title}</Text><Text style={styles.hint}>{item.detail}</Text></View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>)}
        </>}
      </View>
      <DashboardCards mode="personal" />
    </ScrollView>
  </View>;
};
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  heading: { padding: 20, gap: 6 },
  title: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.textPrimary, textTransform: 'uppercase' },
  subtitle: { fontSize: 14, lineHeight: 22, color: Colors.textSecondary },
  attention: { marginHorizontal: 20, marginBottom: 32, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, gap: 12 },
  sectionTitle: { fontSize: 18, fontFamily: FontFamily.bold, color: Colors.textPrimary, textTransform: 'uppercase' },
  hint: { fontSize: 13, lineHeight: 20, color: Colors.textSecondary },
  body: { fontSize: 14, lineHeight: 22, color: Colors.textPrimary },
  flex: { flex: 1, gap: 4 },
  task: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 16 },
  urgent: { backgroundColor: Colors.warningAlpha10, borderColor: Colors.warningAlpha30 },
  taskTitle: { fontSize: 14, lineHeight: 22, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  warning: { padding: 14, gap: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.warningAlpha30 },
  clear: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: Colors.successAlpha06 },
});
