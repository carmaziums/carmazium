import { DashboardCards } from '../../components/DashboardCards';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, StyleSheet, Text, TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { apiClient } from '../../lib/apiClient';
import { fetchAllMyAuctions } from '../../lib/myAuctionsApi';
import { useChat } from '../../context/ChatContext';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

// The dashboard home shows attention items and customisable navigation cards.
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
}

export const DealerWebParityOverview: React.FC<Props> = ({
  userName, canManageInventory, canManageCrm, canManageOffers, canViewPurchases, canViewTrade, canViewAnalytics,
  onNavigate, refreshToken = 0,
}) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [pendingOffers, setPendingOffers] = useState<number | null>(null);
  const [offersError, setOffersError] = useState(false);
  const [handoverCount, setHandoverCount] = useState<number | null>(null);
  const [provisionalCount, setProvisionalCount] = useState<number | null>(null);
  const [feeDueCount, setFeeDueCount] = useState<number | null>(null);
  const { unreadCount } = useChat();

  useEffect(() => {
    let cancelled = false;
    // Same authenticated read-only endpoint as the website's dealer Home.
    apiClient<{ data?: DashboardSummary }>('/dashboard/dealer')
      .then(result => {
        if (cancelled) return;
        if (!result?.data || typeof result.data !== 'object') {
          throw new Error('Dashboard response unavailable');
        }
        setSummary(result.data);
      })
      .catch(() => { if (!cancelled) setSummary(null); });
    return () => { cancelled = true; };
  }, [refreshToken]);

  useEffect(() => {
    if (!canManageOffers) { setPendingOffers(null); setOffersError(false); return; }
    let cancelled = false;
    setPendingOffers(null);
    setOffersError(false);
    apiClient<{ data?: { count?: number } }>('/offers/pending-count')
      .then(response => {
        if (cancelled) return;
        const count = response?.data?.count;
        if (typeof count !== 'number' || !Number.isFinite(count)) throw new Error('Pending offers unavailable');
        setPendingOffers(count);
      })
      .catch(() => { if (!cancelled) setOffersError(true); });
    return () => { cancelled = true; };
  }, [canManageOffers, refreshToken]);
  useEffect(() => {
    if (!canManageInventory) { setHandoverCount(null); setProvisionalCount(null); return; }
    let cancelled = false;
    setHandoverCount(null);
    setProvisionalCount(null);
    fetchAllMyAuctions<{
      id: string; status: string; winnerId?: string | null; buyerRefusedAt?: string | null;
      sellerBonusReleased?: boolean; sellerFundsConfirmedAt?: string | null;
      handoverSubmittedAt?: string | null; handoverRejectedAt?: string | null;
      provisionalOfferBidId?: string | null; provisionalOfferedAt?: string | null;
    }>('list').then(auctions => {
      if (cancelled) return;
      const now = Date.now();
      setProvisionalCount(auctions.filter(a => a.status === 'ENDED' && !a.winnerId
        && !!a.provisionalOfferBidId && !!a.provisionalOfferedAt
        && Number.isFinite(new Date(a.provisionalOfferedAt).getTime())
        && now < new Date(a.provisionalOfferedAt).getTime() + 72 * 60 * 60 * 1000).length);
      setHandoverCount(auctions.filter(a => a.status === 'ENDED' && !!a.winnerId
        && !a.buyerRefusedAt && !a.sellerBonusReleased
        && (!a.sellerFundsConfirmedAt || !a.handoverSubmittedAt || !!a.handoverRejectedAt)).length);
    }).catch(() => { if (!cancelled) { setHandoverCount(null); setProvisionalCount(null); } });
    return () => { cancelled = true; };
  }, [canManageInventory, refreshToken]);
  useEffect(() => {
    if (!canViewPurchases) { setFeeDueCount(null); return; }
    let cancelled = false;
    setFeeDueCount(null);
    apiClient<{ data?: { data?: Array<{
      id: string; status: string; buyerFeePaid?: boolean; buyerRefusedAt?: string | null;
      buyerFeeDeadlineAt?: string | null;
    }> } | Array<{
      id: string; status: string; buyerFeePaid?: boolean; buyerRefusedAt?: string | null;
      buyerFeeDeadlineAt?: string | null;
    }> } >('/auctions/my/won?page=1&limit=50').then(response => {
      if (cancelled) return;
      const payload = response?.data;
      const auctions = Array.isArray(payload) ? payload : payload?.data;
      if (!Array.isArray(auctions)) throw new Error('Won auctions unavailable');
      setFeeDueCount(auctions.filter(a => a.status === 'ENDED' && !a.buyerFeePaid
        && !a.buyerRefusedAt && !!a.buyerFeeDeadlineAt).length);
    }).catch(() => { if (!cancelled) setFeeDueCount(null); });
    return () => { cancelled = true; };
  }, [canViewPurchases, refreshToken]);
  return (
    <View style={styles.main}>
      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <View style={styles.heroIcon}>
            <Ionicons name="business-outline" size={24} color={Colors.textPrimary} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>DEALER COMMAND CENTRE</Text>
            <Text style={styles.heroSubtitle}>RUN YOUR DEALERSHIP FROM ONE PLACE, {userName}</Text>
            {summary?.isVerified === true && (
              <View style={styles.verifiedLine}>
                <Ionicons name="shield-checkmark-outline" size={14} color={Colors.warning} />
                <Text style={styles.verifiedText}>Verified Dealer</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.actionSection}>
        <Text style={styles.actionsTitle}>Needs your attention</Text>
        <Text style={styles.sectionHint}>Your to-do list, most urgent first.</Text>
        {canManageOffers && pendingOffers === null && !offersError && <ActivityIndicator color={Colors.accent} />}
        {offersError && <Text style={styles.sectionHint}>We couldn't check your offers just now. Your offers are still available from the dashboard cards.</Text>}
        {canViewPurchases && feeDueCount !== null && feeDueCount > 0 && (
          <TouchableOpacity accessibilityRole="button" onPress={() => onNavigate('won-auctions')} style={styles.actionCard}>
            <Ionicons name="receipt-outline" size={22} color={Colors.warning} />
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>{feeDueCount} won {feeDueCount === 1 ? 'auction has' : 'auctions have'} a buyer fee due</Text>
              <Text style={styles.actionDescription}>Review your £125 auction buyer fee and payment deadline.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
        {canManageInventory && provisionalCount !== null && provisionalCount > 0 && (
          <TouchableOpacity accessibilityRole="button" onPress={() => onNavigate('manage-auctions')} style={styles.actionCard}>
            <Ionicons name="alert-circle-outline" size={22} color={Colors.warning} />
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>{provisionalCount} provisional {provisionalCount === 1 ? 'offer needs' : 'offers need'} a decision</Text>
              <Text style={styles.actionDescription}>Review the highest below-reserve bids before their 72-hour deadlines.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
        {canManageOffers && pendingOffers !== null && pendingOffers > 0 && (
          <TouchableOpacity accessibilityRole="button" onPress={() => onNavigate('offers')}
            style={styles.actionCard}>
            <Ionicons name="pricetag-outline" size={22} color={Colors.accent} />
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>{pendingOffers} buyer {pendingOffers === 1 ? 'offer is' : 'offers are'} waiting for your reply</Text>
              <Text style={styles.actionDescription}>Accept, decline or counter each offer.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
        {canManageInventory && handoverCount !== null && handoverCount > 0 && (
          <TouchableOpacity accessibilityRole="button" onPress={() => onNavigate('manage-auctions')}
            style={styles.actionCard}>
            <Ionicons name="car-outline" size={22} color={Colors.accent} />
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>{handoverCount} sold {handoverCount === 1 ? 'auction may' : 'auctions may'} need your next step</Text>
              <Text style={styles.actionDescription}>Review payment confirmation and handover proof in My Auctions.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
        {unreadCount > 0 && (
          <TouchableOpacity accessibilityRole="button" onPress={() => onNavigate('messages')} style={styles.actionCard}>
            <Ionicons name="chatbubble-outline" size={22} color={Colors.accent} />
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>{unreadCount} unread {unreadCount === 1 ? 'message' : 'messages'}</Text>
              <Text style={styles.actionDescription}>Customers and CarMazium support.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
        {!offersError && (!canManageOffers || pendingOffers === 0)
          && (!canManageInventory || (provisionalCount === 0 && handoverCount === 0))
          && (!canViewPurchases || feeDueCount === 0) && unreadCount === 0 && (
          <Text style={styles.sectionHint}>You're all caught up. Nothing needs your attention right now.</Text>
        )}
      </View>
      <DashboardCards mode="dealer" />
    </View>
  );
};

const styles = StyleSheet.create({
  main: { paddingHorizontal: 20, paddingTop: 12, gap: 18 },
  hero: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderSubtle,
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
  actionSection: { gap: 10 },
  actionsTitle: { fontFamily: FontFamily.extraBold, fontSize: 19,
    color: Colors.textPrimary, textTransform: 'uppercase' },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 13,
    minHeight: 82, padding: 16, borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 16, backgroundColor: Colors.bgCard },
  actionIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.accentAlpha15,
    backgroundColor: Colors.accentAlpha10, borderRadius: 12 },
  actionText: { flex: 1, gap: 4 },
  actionTitle: { fontFamily: FontFamily.bold, color: Colors.textPrimary, fontSize: 14 },
  actionDescription: { fontFamily: FontFamily.regular, color: Colors.textMuted,
    fontSize: 12, lineHeight: 18 },
});
