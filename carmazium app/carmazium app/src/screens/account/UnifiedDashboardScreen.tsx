import React, { useEffect, useRef, useState } from 'react';
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
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

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
  return <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: 'rgba(255,255,255,0.05)', opacity }} />;
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
    <Text style={styles.tileLabel}>{label}</Text>
    {sublabel ? <Text style={styles.tileSublabel} numberOfLines={1}>{sublabel}</Text> : null}
  </TouchableOpacity>
);

// ══════════════════════════ COMPONENT ════════════════════════════

export const UnifiedDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, role, logout } = useAuthStore();
  const [data, setData] = useState<UnifiedDashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiClient<UnifiedDashboardResponse>('/dashboard/unified');
        if (mounted && res?.success) setData(res.data);
      } catch { /* show zeros */ }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const { buyer, seller, unreadMessages } = data;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const email = user?.email || '';
  const initials = getInitials(user?.firstName ?? null, user?.lastName ?? null, email);
  const isDealer = role === 'dealer';
  const isSeller = role === 'seller' || isDealer;

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
        colors={['rgba(220,31,38,0.06)', 'rgba(59,130,246,0.03)', '#0A0A0C']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Logo size="sm" />
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.bellBtn} activeOpacity={0.75} onPress={() => nav('NotificationSettings')}>
            {unreadMessages > 0 && <View style={styles.bellDot} />}
            <Ionicons name="notifications-outline" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <HamburgerButton />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]} showsVerticalScrollIndicator={false}>

        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, isDealer && styles.avatarDealer, isSeller && !isDealer && styles.avatarSeller]}>
            <Text style={styles.avatarText}>{initials}</Text>
            <View style={styles.avatarCheck}>
              <Ionicons name="checkmark" size={10} color="#FFF" />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>{fullName}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
          </View>
          <View style={[styles.rolePill, isDealer ? styles.rolePillAmber : isSeller ? styles.rolePillBlue : styles.rolePillGreen]}>
            <Text style={[styles.rolePillText, isDealer ? { color: '#F59E0B' } : isSeller ? { color: '#3B82F6' } : { color: '#22C55E' }]}>
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
            accentColor="#22C55E"
            sublabel={isSeller ? `${seller.activeListings} active` : 'Sell a car'}
            onPress={() => isSeller ? nav('SellerDashboard') : nav('SellCarFlow')}
          />
          <Tile
            label="Auctions"
            icon="gavel"
            iconLib="mci"
            accentColor="#3B82F6"
            sublabel={`${buyer.activeBids} bid${buyer.activeBids !== 1 ? 's' : ''}`}
            onPress={() => navTab('Live')}
          />

          {/* Row 2: Offers + My Offers */}
          <Tile
            label="Offers"
            icon="pricetag-outline"
            accentColor="#F59E0B"
            badge={isSeller ? seller.incomingOffers : undefined}
            sublabel={isSeller ? `${seller.incomingOffers} incoming` : 'No offers yet'}
            onPress={() => isSeller ? nav('SellerOffers') : nav('BuyerOffers')}
          />
          <Tile
            label="My Offers"
            icon="document-text-outline"
            accentColor="#DC1F26"
            badge={buyer.counteredOffersPending || undefined}
            sublabel={buyer.counteredOffersPending > 0 ? `${buyer.counteredOffersPending} pending` : `${buyer.activeBids} active`}
            onPress={() => nav('BuyerOffers')}
          />

          {/* Row 3: Watchlist + Stats */}
          <Tile
            label="Watchlist"
            icon="heart-outline"
            accentColor="#EC4899"
            badge={buyer.watchlistCount || undefined}
            sublabel={`${buyer.watchlistCount} saved`}
            onPress={() => navTab('Saved')}
          />
          <Tile
            label="Stats"
            icon="bar-chart-outline"
            accentColor="#A855F7"
            sublabel={`${seller.totalViews > 0 ? seller.totalViews.toLocaleString('en-GB') + ' views' : 'Performance'}`}
            onPress={() => nav('SellerPerformance')}
          />

          {/* Row 4: Messages + Earnings */}
          <Tile
            label="Messages"
            icon="chatbubble-ellipses-outline"
            accentColor="#06B6D4"
            badge={unreadMessages || undefined}
            sublabel={unreadMessages > 0 ? `${unreadMessages} unread` : 'All caught up'}
            onPress={() => nav('Messages')}
          />
          <Tile
            label="Earnings"
            icon="wallet-outline"
            accentColor="#10B981"
            sublabel={isSeller ? `£${seller.totalRevenue.toLocaleString('en-GB')}` : 'N/A'}
            onPress={() => isSeller ? nav('Earnings') : nav('BuyerPurchaseHistory')}
          />

          {/* Row 5: Settings (wide) */}
          <Tile
            label="Settings"
            icon="settings-outline"
            accentColor="#6B7280"
            sublabel="Profile, verification & preferences"
            wide
            onPress={() => nav('AccountProfile')}
          />

        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity style={styles.signOutRow} activeOpacity={0.75} onPress={handleSignOut}>
          <View style={styles.signOutIcon}>
            <Ionicons name="log-out-outline" size={17} color={Colors.accent} />
          </View>
          <Text style={styles.signOutText}>Sign out</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

// ═══════════════════════════ STYLES ════════════════════════════════

const CARD_BG = '#111115';
const BORDER = 'rgba(255,255,255,0.07)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },

  // Profile card
  profileCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 20, backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, gap: 14 },
  avatar: { width: 50, height: 50, borderRadius: 14, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarDealer: { backgroundColor: '#B8860B', borderWidth: 1.5, borderColor: '#F59E0B' },
  avatarSeller: { backgroundColor: '#1D4ED8', borderWidth: 1.5, borderColor: '#3B82F6' },
  avatarText: { fontFamily: FontFamily.bold, fontSize: 20, color: '#FFF' },
  avatarCheck: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#0A0A0C' },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: FontFamily.bold, fontSize: 16, color: '#FFF', marginBottom: 2 },
  profileEmail: { fontFamily: FontFamily.regular, fontSize: 12, color: '#A0A0AB' },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  rolePillAmber: { backgroundColor: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.3)' },
  rolePillBlue: { backgroundColor: 'rgba(59,130,246,0.10)', borderColor: 'rgba(59,130,246,0.3)' },
  rolePillGreen: { backgroundColor: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.3)' },
  rolePillText: { fontFamily: FontFamily.bold, fontSize: 9, letterSpacing: 1 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 },
  sectionLabel: { fontFamily: FontFamily.bold, fontSize: 10, color: '#606070', letterSpacing: 1.6 },

  // Overview stats
  statsRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 24, backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: BORDER, paddingVertical: 18 },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: FontFamily.extraBold, fontSize: 22, color: '#FFF', marginBottom: 2 },
  statName: { fontFamily: FontFamily.medium, fontSize: 10, color: '#606070', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 30, backgroundColor: BORDER },

  // Tile grid
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 20 },
  tile: { width: '47%', backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, gap: 8 },
  tileWide: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14 },
  tileIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tileBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#0A0A0C' },
  tileBadgeText: { fontFamily: FontFamily.bold, fontSize: 9, color: '#FFF' },
  tileLabel: { fontFamily: FontFamily.bold, fontSize: 14, color: '#FFF' },
  tileSublabel: { fontFamily: FontFamily.regular, fontSize: 11, color: '#606070' },

  // Sign out
  signOutRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: 'rgba(220,31,38,0.07)', borderWidth: 1, borderColor: 'rgba(220,31,38,0.2)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  signOutIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(220,31,38,0.12)', alignItems: 'center', justifyContent: 'center' },
  signOutText: { flex: 1, fontFamily: FontFamily.bold, fontSize: 14, color: Colors.accent },
});
