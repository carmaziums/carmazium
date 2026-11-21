import { DashboardCards } from '../../components/DashboardCards';
import { Button } from '../../components/Button';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@/components/BrandIcon';
import { apiClient } from '../../lib/apiClient';
import { fetchAllMyAuctions } from '../../lib/myAuctionsApi';
import { buildAttentionItems, type AttentionAuction, type AttentionItem } from '../../lib/dealerAttention';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

export type DealerHomeDestination =
  | 'add-vehicle' | 'customers' | 'buy-and-bid'
  | 'partner-services' | 'performance' | 'stock' | 'offers' | 'manage-auctions' | 'messages' | 'won-auctions';
interface DashboardSummary { isVerified?: boolean }
interface Props {
  userName: string;
  canManageInventory: boolean;
  canManageCrm: boolean;
  canManageOffers: boolean;
  canViewPurchases: boolean;
  canViewTrade: boolean;
  canViewAnalytics: boolean;
  onNavigate: (destination: DealerHomeDestination) => void;
  refreshToken?: number;
  accessLoading?: boolean;
}
interface Checks { pendingOffers: number; unread: number; won: AttentionAuction[]; mine: AttentionAuction[]; failed: boolean }
const icons: Record<AttentionItem['kind'], string> = {
  provisional: 'hammer-outline', fee: 'receipt-outline', offers: 'pricetag-outline', handovers: 'car-outline', messages: 'chatbubbles-outline',
};
const readCount = async (path: string) => {
  const response = await apiClient<{ data: { count: number } }>(path);
  const count = response?.data?.count;
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) throw Error('Count unavailable');
  return count;
};
export const DealerWebParityOverview: React.FC<Props> = ({
  userName, canManageInventory, canManageOffers, canViewPurchases, onNavigate, refreshToken = 0, accessLoading = false,
}) => {
  const navigation = useNavigation<any>();
  const sequence = useRef(0);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [checks, setChecks] = useState<Checks | null>(null);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setChecks(null);
    setSummary(null);
    const [identity, offers, won, mine, unread] = await Promise.allSettled([
      apiClient<{ data: DashboardSummary }>('/dashboard/dealer'),
      canManageOffers ? readCount('/offers/pending-count') : Promise.resolve(0),
      canViewPurchases ? fetchAllMyAuctions<AttentionAuction>('won') : Promise.resolve([]),
      canManageInventory ? fetchAllMyAuctions<AttentionAuction>('list') : Promise.resolve([]),
      readCount('/chat/unread'),
    ]);
    if (request !== sequence.current) return;
    setSummary(identity.status === 'fulfilled' ? identity.value?.data ?? null : null);
    setChecks({
      pendingOffers: offers.status === 'fulfilled' ? offers.value : 0,
      won: won.status === 'fulfilled' ? won.value : [],
      mine: mine.status === 'fulfilled' ? mine.value : [],
      unread: unread.status === 'fulfilled' ? unread.value : 0,
      failed: [offers, won, mine, unread].some(result => result.status === 'rejected'),
    });
  }, [canManageOffers, canViewPurchases, canManageInventory, refreshToken]);
  useFocusEffect(useCallback(() => {
    if (accessLoading) { setChecks(null); return; }
    void load();
    return () => { sequence.current += 1; };
  }, [load, accessLoading]));
  const items = checks ? buildAttentionItems({
    now: Date.now(), pendingOffers: checks.pendingOffers, unreadMessages: checks.unread,
    wonAuctions: checks.won, myAuctions: checks.mine, canManageOffers, canViewPurchases, canManageInventory,
  }) : [];
  const open = (item: AttentionItem) => {
    if (item.kind === 'provisional') navigation.navigate('AuctionDeepLink', { auctionId: item.href.split('/').pop() });
    else onNavigate(({ fee: 'won-auctions', offers: 'offers', handovers: 'manage-auctions', messages: 'messages' } as const)[item.kind]);
  };
  return <View style={styles.main}>
    <View style={styles.hero}>
      <View style={styles.heroHeading}>
        <View style={styles.heroIcon}><Ionicons name="business-outline" size={24} color={Colors.textPrimary} /></View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>DEALER COMMAND CENTRE</Text>
          <Text style={styles.heroSubtitle}>RUN YOUR DEALERSHIP FROM ONE PLACE, {userName}</Text>
          {summary?.isVerified === true && <View style={styles.verifiedLine}>
            <Ionicons name="shield-checkmark-outline" size={14} color={Colors.warning} />
            <Text style={styles.verifiedText}>Verified Dealer</Text>
          </View>}
        </View>
      </View>
    </View>
    <View style={styles.actionSection}>
      <Text style={styles.actionsTitle}>Needs your attention</Text>
      <Text style={styles.sectionHint}>Your to-do list, most urgent first.</Text>
      {!checks ? <ActivityIndicator accessibilityLabel="Checking your account" color={Colors.accent} /> : <>
        {checks.failed && <View accessibilityRole="alert" style={styles.warning}>
          <Text style={styles.sectionHint}>Some checks failed. The list below may be incomplete; your offers, auctions and messages remain available from the dashboard cards.</Text>
          <Button label="Retry checks" variant="outline" size="sm" onPress={() => void load()} />
        </View>}
        {items.map(item => <TouchableOpacity key={item.key} accessibilityRole="button" accessibilityLabel={item.title}
          onPress={() => open(item)} style={[styles.actionCard, item.urgent && styles.urgent]}>
          <Ionicons name={icons[item.kind] as any} size={22} color={item.urgent ? Colors.warning : Colors.accent} />
          <View style={styles.actionText}><Text style={styles.actionTitle}>{item.title}</Text><Text style={styles.actionDescription}>{item.detail}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>)}
        {!checks.failed && items.length === 0 && <Text style={styles.sectionHint}>You're all caught up. Nothing needs your attention right now.</Text>}
      </>}
    </View>
    <DashboardCards mode="dealer" />
  </View>;
};

const styles = StyleSheet.create({
  main: { paddingTop: 12, gap: 18 },
  hero: { marginHorizontal: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 16, padding: 20, overflow: 'hidden' },
  heroHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroIcon: { width: 46, height: 46, backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { fontFamily: FontFamily.extraBold, fontSize: 22,
    lineHeight: 27, letterSpacing: -0.6, color: Colors.textPrimary },
  heroSubtitle: { fontFamily: FontFamily.bold, fontSize: 10, letterSpacing: 1.1,
    lineHeight: 17, color: Colors.textMuted, marginTop: 4 },
  verifiedLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  verifiedText: { fontFamily: FontFamily.bold, fontSize: 11, color: Colors.warning },
  sectionHint: { color: Colors.textMuted, fontFamily: FontFamily.regular,
    fontSize: 12, lineHeight: 19 },
  actionSection: { marginHorizontal: 20, padding: 20, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, backgroundColor: Colors.bgCard, gap: 10 },
  actionsTitle: { fontFamily: FontFamily.extraBold, fontSize: 19,
    color: Colors.textPrimary, textTransform: 'uppercase' },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 13,
    minHeight: 82, padding: 16, borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 16, backgroundColor: Colors.bgCard },
  warning: { padding: 12, borderWidth: 1, borderColor: Colors.warningAlpha30, borderRadius: 12, gap: 10 },
  urgent: { backgroundColor: Colors.warningAlpha10, borderColor: Colors.warningAlpha30 },
  actionIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.accentAlpha15,
    backgroundColor: Colors.accentAlpha10, borderRadius: 12 },
  actionText: { flex: 1, gap: 4 },
  actionTitle: { fontFamily: FontFamily.bold, color: Colors.textPrimary, fontSize: 14 },
  actionDescription: { fontFamily: FontFamily.regular, color: Colors.textMuted,
    fontSize: 12, lineHeight: 18 },
});
