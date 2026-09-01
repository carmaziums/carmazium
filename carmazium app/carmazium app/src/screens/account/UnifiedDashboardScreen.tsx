import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { Logo } from '../../components/Logo';
import { HamburgerButton } from '../../components/HamburgerButton';
import { apiClient } from '../../lib/apiClient';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import {FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';

// ─────────────────────────── types ───────────────────────────────

interface UnifiedDashboardData {
  buyer: { activeBids: number; watchlistCount: number; counteredOffersPending: number };
  seller: { totalListings: number; activeListings: number; soldListings: number; totalViews: number; totalRevenue: number; incomingOffers: number };
  unreadMessages: number;
}

interface UnifiedDashboardResponse { success: boolean; data: UnifiedDashboardData }

const EMPTY: UnifiedDashboardData = {
  buyer: { activeBids: 0, watchlistCount: 0, counteredOffersPending: 0 },
  seller: { totalListings: 0, activeListings: 0, soldListings: 0, totalViews: 0, totalRevenue: 0, incomingOffers: 0 },
  unreadMessages: 0,
};

function getInitials(firstName: string | null, lastName: string | null, email: string) {
  if (firstName || lastName) return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
  return email.charAt(0).toUpperCase();
}

// ─────────────────────── skeleton ──────────────────────────────

const Skeleton: React.FC<{ w?: number | string; h: number; r?: number }> = ({ w = '100%', h, r = 6 }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const p = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
    p.start();
    return () => p.stop();
  }, [opacity]);
  return <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: Colors.whiteAlpha05, opacity }} />;
};

// ─────────────────────── tile component ──────────────────────────

interface TileProps {
  label: string;
  icon: string;
  iconLib?: 'ion' | 'mci';
  accentColor: string;
  badge?: number;
  sublabel?: string;
  onPress: () => void;
  wide?: boolean;
}

const Tile: React.FC<TileProps> = ({ label, icon, iconLib = 'ion', accentColor, badge, sublabel, onPress, wide }) => (
  <TouchableOpacity
    style={[styles.tile, wide && styles.tileWide]}
    activeOpacity={0.75}
    onPress={onPress}
  >
    <View style={[styles.tileIconWrap, { backgroundColor: `${accentColor}18` }]}>
      {iconLib === 'mci'
        ? <MaterialCommunityIcons name={icon} size={20} color={accentColor} />
        : <Ionicons name={icon as any} size={20} color={accentColor} />}
      {badge != null && badge > 0 && (
        <View style={[styles.tileBadge, { backgroundColor: accentColor }]}>
          <Text style={styles.tileBadgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
        </View>
      )}
    </View>
    {wide ? (
      <View style={styles.tileTextWrap}>
        <Text style={styles.tileLabel}>{label}</Text>
        {sublabel ? <Text style={styles.tileSublabel}>{sublabel}</Text> : null}
      </View>
    ) : (
      <>
        <Text style={styles.tileLabel}>{label}</Text>
        {sublabel ? <Text style={styles.tileSublabel} numberOfLines={1}>{sublabel}</Text> : null}
      </>
    )}
    {wide && <Ionicons name="chevron-forward" size={16} color={Colors.borderMuted} accessibilityElementsHidden importantForAccessibility="no" />}
  </TouchableOpacity>
);

// ══════════════════════════ COMPONENT ════════════════════════════

export const UnifiedDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, role, accountRole, logout } = useAuthStore();
  const [data, setData] = useState<UnifiedDashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  // Three states, not two. `loading` covers the fetch; `error` covers a
  // failure; and no error with zeroed data means the account genuinely has
  // nothing yet, which must still render as zeros (CROSS-023 / DASH-047).
  // Previously the catch swallowed everything into `/* show zeros */`, so a
  // dead network rendered as a confident, wrong dashboard.
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient<UnifiedDashboardResponse>('/dashboard/unified');
      if (res?.success) setData(res.data);
    } catch (err: any) {
      // Reset to EMPTY as well as flagging: leaving the previous render's
      // numbers on screen under an error banner is its own kind of lie.
      setData(EMPTY);
      setError(err?.message === 'REQUEST_TIMEOUT'
        ? 'Timed out loading your dashboard.'
        : 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const { buyer, seller, unreadMessages } = data;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const email = user?.email || '';
  const initials = getInitials(user?.firstName ?? null, user?.lastName ?? null, email);
  const isDealer = role === 'dealer';
  const isSeller = role === 'seller' || isDealer;
  // Real account status, independent of the "preview as buyer" toggle
  // (DealerProfileScreen's "VIEW MY PROFILE" flips `role` to 'buyer' without
  // changing what the account actually is) — used only where routing
  // depends on the real account, not the buyer/seller/dealer preview
  // currently being shown (mobile-production-readiness-plan.md F38).
  const isDealerAccount = accountRole === 'dealer';
  const isSellerAccount = accountRole === 'seller' || isDealerAccount;

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  const nav = (screen: string) => navigation?.navigate(screen);
  const navTab = (tab: string) => navigation?.navigate('Tabs', { screen: tab });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha06, Colors.infoBlueAlpha03, Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Logo size="sm" />
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.bellBtn} activeOpacity={0.75} onPress={() => nav('NotificationSettings')} accessibilityLabel="Notifications" accessibilityRole="button" hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}>
            {unreadMessages > 0 && <View style={styles.bellDot} />}
            <Ionicons name="notifications-outline" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <HamburgerButton />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]} showsVerticalScrollIndicator={false}>

        {error ? (
          <View style={{ marginBottom: 16 }}>
            <ErrorBanner message={error} onRetry={load} />
          </View>
        ) : null}

        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, isDealer && styles.avatarDealer, isSeller && !isDealer && styles.avatarSeller]}>
            <Text style={styles.avatarText}>{initials}</Text>
            <View style={styles.avatarCheck}>
              <Ionicons name="checkmark" size={10} color={Colors.white} />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>{fullName}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
          </View>
          <View style={[styles.rolePill, isDealer ? styles.rolePillAmber : isSeller ? styles.rolePillBlue : styles.rolePillGreen]}>
            <Text style={[styles.rolePillText, isDealer ? { color: Colors.warning } : isSeller ? { color: Colors.infoBlue } : { color: Colors.success }]}>
              {isDealer ? 'DEALER' : isSeller ? 'SELLER' : 'BUYER'}
            </Text>
          </View>
        </View>

        {/* ── Overview stats strip ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>OVERVIEW</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            {loading ? <Skeleton w={32} h={22} /> : <Text style={styles.statValue}>{seller.activeListings}</Text>}
            <Text style={styles.statName}>Listings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            {loading ? <Skeleton w={32} h={22} /> : <Text style={styles.statValue}>{buyer.watchlistCount}</Text>}
            <Text style={styles.statName}>Saved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            {loading ? <Skeleton w={40} h={22} /> : <Text style={styles.statValue}>{seller.totalViews >= 1000 ? `${(seller.totalViews / 1000).toFixed(1)}k` : seller.totalViews}</Text>}
            <Text style={styles.statName}>Views</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            {loading ? <Skeleton w={32} h={22} /> : <Text style={[styles.statValue, unreadMessages > 0 && { color: Colors.accent }]}>{unreadMessages}</Text>}
            <Text style={styles.statName}>Unread</Text>
          </View>
        </View>

        {/* ── 10-section tile grid ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>MY DASHBOARD</Text>
        </View>
        <View style={styles.tileGrid}>

          {/* Row 1: Inventory + Auctions */}
          <Tile
            label="Inventory"
            icon="car-outline"
            accentColor={Colors.success}
            sublabel={isSellerAccount ? `${seller.activeListings} active` : 'Sell a car'}
            onPress={() =>
              isDealerAccount ? nav('DealerInventory')
              : isSellerAccount ? nav('SellerListings')
              : nav('SellCarFlow')
            }
          />
          <Tile
            label="Auctions"
            icon="gavel"
            iconLib="mci"
            accentColor={Colors.infoBlue}
            sublabel={`${buyer.activeBids} bid${buyer.activeBids !== 1 ? 's' : ''}`}
            onPress={() => navTab('Live')}
          />

          {/* Row 2: Offers + My Offers */}
          <Tile
            label="Offers"
            icon="pricetag-outline"
            accentColor={Colors.warning}
            badge={isSeller ? seller.incomingOffers : undefined}
            sublabel={isSeller ? `${seller.incomingOffers} incoming` : 'No offers yet'}
            onPress={() => isSeller ? nav('SellerOffers') : nav('BuyerOffers')}
          />
          <Tile
            label="My Offers"
            icon="document-text-outline"
            accentColor={Colors.accent}
            badge={buyer.counteredOffersPending || undefined}
            sublabel={buyer.counteredOffersPending > 0 ? `${buyer.counteredOffersPending} pending` : `${buyer.activeBids} active`}
            onPress={() => nav('BuyerOffers')}
          />

          {/* Row 3: Watchlist + Stats */}
          <Tile
            label="Watchlist"
            icon="heart-outline"
            accentColor={Colors.lightPink}
            badge={buyer.watchlistCount || undefined}
            sublabel={`${buyer.watchlistCount} saved`}
            onPress={() => navTab('Saved')}
          />
          <Tile
            label="Stats"
            icon="bar-chart-outline"
            accentColor={Colors.lightPurple}
            sublabel={`${seller.totalViews > 0 ? seller.totalViews.toLocaleString('en-GB') + ' views' : 'Performance'}`}
            onPress={() => nav('SellerPerformance')}
          />

          {/* Row 4: Messages + Earnings */}
          <Tile
            label="Messages"
            icon="chatbubble-ellipses-outline"
            accentColor={Colors.midTeal_06b6d4}
            badge={unreadMessages || undefined}
            sublabel={unreadMessages > 0 ? `${unreadMessages} unread` : 'All caught up'}
            onPress={() => nav('Messages')}
          />
          <Tile
            label="Earnings"
            icon="wallet-outline"
            accentColor={Colors.accentGreen}
            sublabel={isSeller ? `£${seller.totalRevenue.toLocaleString('en-GB')}` : 'N/A'}
            onPress={() => isSeller ? nav('Earnings') : nav('BuyerPurchaseHistory')}
          />

          {/* Row 5: Settings (wide) */}
          <Tile
            label="Settings"
            icon="settings-outline"
            accentColor={Colors.midBlue_6b7280}
            sublabel="Profile, password, payouts & bank details"
            wide
            onPress={() => nav('Settings')}
          />

        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity style={styles.signOutRow} activeOpacity={0.75} onPress={handleSignOut}>
          <View style={styles.signOutIcon}>
            <Ionicons name="log-out-outline" size={17} color={Colors.accent} />
          </View>
          <Text style={styles.signOutText}>Sign out</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

// ═══════════════════════════ STYLES ════════════════════════════════

const CARD_BG = Colors.bgSecondary;
const BORDER = Colors.whiteAlpha07;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: { width: 38, height: 38, borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha05, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },

  // Profile card
  profileCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 20, backgroundColor: CARD_BG, borderRadius: Radius.card, borderWidth: 1, borderColor: BORDER, padding: 16, gap: 14 },
  avatar: { width: 50, height: 50, borderRadius: 14, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarDealer: { backgroundColor: Colors.midOrange_b8860b, borderWidth: 1.5, borderColor: Colors.warning },
  avatarSeller: { backgroundColor: Colors.midBlue_1d4ed8, borderWidth: 1.5, borderColor: Colors.infoBlue },
  avatarText: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.white },
  avatarCheck: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.bgPrimary },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white, marginBottom: 2 },
  profileEmail: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textSecondary },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  rolePillAmber: { backgroundColor: Colors.warningAlpha10, borderColor: Colors.warningAlpha30 },
  rolePillBlue: { backgroundColor: Colors.infoBlueAlpha10, borderColor: Colors.infoBlueAlpha30 },
  rolePillGreen: { backgroundColor: Colors.successAlpha10, borderColor: 'rgba(34,197,94,0.3)' },
  rolePillText: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, letterSpacing: 1 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 },
  sectionLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.iconMuted, letterSpacing: 1.6 },

  // Overview stats
  statsRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 24, backgroundColor: CARD_BG, borderRadius: Radius.card, borderWidth: 1, borderColor: BORDER, paddingVertical: 18 },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: FontFamily.extraBold, fontSize: FontSize.size22, color: Colors.white, marginBottom: 2 },
  statName: { fontFamily: FontFamily.medium, fontSize: FontSize.size10, color: Colors.iconMuted, letterSpacing: 0.5 },
  statDivider: { width: 1, height: 30, backgroundColor: BORDER },

  // Tile grid
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 20 },
  tile: { width: '47%', backgroundColor: CARD_BG, borderRadius: Radius.card, borderWidth: 1, borderColor: BORDER, padding: 16, gap: 8 },
  tileWide: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14 },
  tileTextWrap: { flex: 1, gap: 3 },
  tileIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tileBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: Colors.bgPrimary },
  tileBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.white },
  tileLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.white },
  tileSublabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted },

  // Sign out
  signOutRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: Colors.accentAlpha06, borderWidth: 1, borderColor: Colors.accentAlpha20, borderRadius: Radius.inline, paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  signOutIcon: { width: 34, height: 34, borderRadius: Radius.inline, backgroundColor: Colors.accentAlpha12, alignItems: 'center', justifyContent: 'center' },
  signOutText: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.accent },
});
