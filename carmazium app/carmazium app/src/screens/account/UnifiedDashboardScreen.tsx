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
import { Ionicons } from '@/components/BrandIcon';
import { Logo } from '../../components/Logo';
import { HamburgerButton } from '../../components/HamburgerButton';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

// ─────────────────────────── types ───────────────────────────────

interface UnifiedDashboardData {
  buyer: {
    activeBids: number;
    watchlistCount: number;
    counteredOffersPending: number;
  };
  seller: {
    totalListings: number;
    activeListings: number;
    soldListings: number;
    totalViews: number;
    totalRevenue: number;
    incomingOffers: number;
  };
  unreadMessages: number;
}

interface UnifiedDashboardResponse {
  success: boolean;
  data: UnifiedDashboardData;
}

// ─────────────────────────── helpers ─────────────────────────────

const EMPTY: UnifiedDashboardData = {
  buyer: { activeBids: 0, watchlistCount: 0, counteredOffersPending: 0 },
  seller: {
    totalListings: 0,
    activeListings: 0,
    soldListings: 0,
    totalViews: 0,
    totalRevenue: 0,
    incomingOffers: 0,
  },
  unreadMessages: 0,
};

function formatViewCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function getInitials(firstName: string | null, lastName: string | null, email: string): string {
  if (firstName || lastName) {
    return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
  }
  return email.charAt(0).toUpperCase();
}

// ─────────────────────── skeleton block ──────────────────────────

const SkeletonBlock: React.FC<{ width?: number | string; height: number; borderRadius?: number }> = ({
  width = '100%',
  height,
  borderRadius = 6,
}) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ width: width as any, height, borderRadius, backgroundColor: 'rgba(255,255,255,0.05)', opacity }}
    />
  );
};

// ──────────────────────── sub-components ─────────────────────────

/** Badge pill (count in a small circle) */
const Badge: React.FC<{ count: number; color?: string }> = ({
  count,
  color = Colors.accent,
}) => {
  if (count <= 0) return null;
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

/** Section eyebrow label */
const SectionEyebrow: React.FC<{ label: string }> = ({ label }) => (
  <Text style={styles.sectionEyebrow}>{label}</Text>
);

/** A single activity row inside a card list */
interface ActivityRowProps {
  icon: string;
  tone: string;
  label: string;
  sublabel: string;
  isLast?: boolean;
  badgeCount?: number;
  badgeColor?: string;
  showChevron?: boolean;
  onPress?: () => void;
}

const ActivityRow: React.FC<ActivityRowProps> = ({
  icon,
  tone,
  label,
  sublabel,
  isLast = false,
  badgeCount = 0,
  badgeColor = Colors.accent,
  showChevron = true,
  onPress,
}) => (
  <TouchableOpacity
    style={[styles.activityRow, !isLast && styles.activityRowBorder]}
    activeOpacity={0.75}
    onPress={onPress}
  >
    <View style={[styles.activityIcon, { backgroundColor: `${tone}1A` }]}>
      <Ionicons name={icon as any} size={17} color={tone} />
    </View>
    <View style={styles.activityTextCol}>
      <Text style={styles.activityLabel}>{label}</Text>
      <Text style={styles.activitySublabel} numberOfLines={1}>{sublabel}</Text>
    </View>
    {badgeCount > 0 ? (
      <Badge count={badgeCount} color={badgeColor} />
    ) : showChevron ? (
      <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
    ) : null}
  </TouchableOpacity>
);

// ═══════════════════════════ COMPONENT ════════════════════════════

export const UnifiedDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, role, logout } = useAuthStore();
  const [data, setData] = useState<UnifiedDashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);

  // ── fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const [dashRes] = await Promise.allSettled([
          apiClient<UnifiedDashboardResponse>('/dashboard/unified'),
        ]);

        if (!mounted) return;

        if (dashRes.status === 'fulfilled' && dashRes.value?.success) {
          setData(dashRes.value.data);
        }
      } catch {
        // silently fail — show zeros
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, []);

  // ── derived ────────────────────────────────────────────────────
  const { buyer, seller, unreadMessages } = data;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const email = user?.email || '';
  const initials = getInitials(user?.firstName ?? null, user?.lastName ?? null, email);
  const isDealer = role === 'dealer';
  const isSeller = role === 'seller';

  // ── sign-out ───────────────────────────────────────────────────
  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  // ────────────────────────── render ────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Gradient backdrop */}
      <LinearGradient
        colors={['rgba(220,31,38,0.05)', 'rgba(59,130,246,0.03)', '#0A0A0C']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* top spacer for status bar */}
      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Logo size="sm" />
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.bellBtn}
            activeOpacity={0.75}
            onPress={() => navigation?.navigate('NotificationSettings')}
          >
            {unreadMessages > 0 && <View style={styles.bellDot} />}
            <Ionicons name="notifications-outline" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <HamburgerButton />
        </View>
      </View>

      {/* ── Scrollable body ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Profile card ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            {/* Avatar + badge */}
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
              <View style={styles.avatarCheck}>
                <Ionicons name="checkmark" size={11} color="#FFFFFF" />
              </View>
            </View>

            {/* Name / email / role */}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{fullName}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
              <View style={[
                styles.roleBadge,
                isDealer ? styles.roleBadgeAmber : isSeller ? styles.roleBadgeBlue : styles.roleBadgeGreen,
              ]}>
                <Text style={[
                  styles.roleBadgeText,
                  isDealer ? styles.roleBadgeTextAmber : isSeller ? styles.roleBadgeTextBlue : styles.roleBadgeTextGreen,
                ]}>
                  {isDealer ? 'VERIFIED DEALER' : isSeller ? 'VERIFIED SELLER' : 'VERIFIED BUYER'}
                </Text>
              </View>
            </View>

            {/* Settings gear */}
            <TouchableOpacity
              style={styles.gearBtn}
              activeOpacity={0.75}
              onPress={() => navigation?.navigate('AccountProfile')}
            >
              <Ionicons name="settings-outline" size={17} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2. Stats strip ── */}
        <View style={styles.statsCard}>
          {/* INVENTORY */}
          <View style={styles.statCol}>
            {loading ? <SkeletonBlock width={30} height={20} /> : <Text style={styles.statValue}>{String(seller.activeListings)}</Text>}
            <Text style={styles.statLabel}>INVENTORY</Text>
          </View>
          <View style={styles.statDivider} />

          {/* SAVED */}
          <View style={styles.statCol}>
            {loading ? <SkeletonBlock width={30} height={20} /> : <Text style={styles.statValue}>{String(buyer.watchlistCount)}</Text>}
            <Text style={styles.statLabel}>SAVED</Text>
          </View>
          <View style={styles.statDivider} />

          {/* VIEWS */}
          <View style={styles.statCol}>
            {loading ? <SkeletonBlock width={30} height={20} /> : <Text style={styles.statValue}>{formatViewCount(seller.totalViews)}</Text>}
            <Text style={styles.statLabel}>VIEWS</Text>
          </View>
          <View style={styles.statDivider} />

          {/* UNREAD */}
          <View style={styles.statCol}>
            {loading
              ? <SkeletonBlock width={30} height={20} />
              : <Text style={[styles.statValue, unreadMessages > 0 && styles.statValueRed]}>{String(unreadMessages)}</Text>}
            <Text style={styles.statLabel}>UNREAD</Text>
          </View>
        </View>

        {/* ── 3. SELLING section ── */}
        <View style={styles.section}>
          <SectionEyebrow label="SELLING ACTIVITY" />
          <View style={styles.activityCard}>
            {/* My Inventory */}
            <ActivityRow
              icon="car-outline"
              tone={Colors.success}
              label="My Inventory"
              sublabel={`${seller.activeListings} active listing${seller.activeListings !== 1 ? 's' : ''}`}
              badgeCount={seller.activeListings}
              badgeColor={Colors.success}
              onPress={() => navigation?.navigate('SellerDashboard')}
            />
            {/* Incoming Offers */}
            <ActivityRow
              icon="pricetag-outline"
              tone={Colors.warning}
              label="Incoming Offers"
              sublabel={`${seller.incomingOffers} pending review`}
              badgeCount={seller.incomingOffers}
              badgeColor={Colors.warning}
              onPress={() => navigation?.navigate('SellerOffers')}
            />
            {/* Earnings */}
            <ActivityRow
              icon="wallet-outline"
              tone={Colors.success}
              label="Earnings"
              sublabel={`£${seller.totalRevenue.toLocaleString('en-GB')} total`}
              onPress={() => navigation?.navigate('Earnings')}
            />
            {/* Create Listing */}
            <ActivityRow
              icon="add-circle-outline"
              tone={Colors.accent}
              label="Create new listing"
              sublabel="List your car for free"
              isLast
              showChevron={false}
              onPress={() => navigation?.navigate('SellCars')}
            />
          </View>
        </View>

        {/* ── 4. BUYING section ── */}
        <View style={styles.section}>
          <SectionEyebrow label="BUYING ACTIVITY" />
          <View style={styles.activityCard}>
            {/* Auction Bids */}
            <ActivityRow
              icon="hammer-outline"
              tone="#3B82F6"
              label="Auction Bids"
              sublabel={`${data.buyer.activeBids} active bid${data.buyer.activeBids !== 1 ? 's' : ''}`}
              badgeCount={data.buyer.activeBids}
              badgeColor="#3B82F6"
              onPress={() => navigation?.navigate('BuyerBids')}
            />
            {/* Purchase History */}
            <ActivityRow
              icon="receipt-outline"
              tone="#22C55E"
              label="Purchase History"
              sublabel="Completed vehicle purchases"
              onPress={() => navigation?.navigate('BuyerPurchaseHistory')}
            />
            {/* My Sent Offers */}
            <ActivityRow
              icon="document-text-outline"
              tone={Colors.warning}
              label="My Sent Offers"
              sublabel={
                `${buyer.activeBids} active` +
                (buyer.counteredOffersPending > 0
                  ? ` · ${buyer.counteredOffersPending} counter-offer${buyer.counteredOffersPending !== 1 ? 's' : ''} waiting`
                  : '')
              }
              badgeCount={buyer.counteredOffersPending > 0 ? buyer.counteredOffersPending : buyer.activeBids}
              badgeColor={buyer.counteredOffersPending > 0 ? Colors.accent : Colors.textMuted}
              onPress={() => navigation?.navigate('BuyerOffers')}
            />
            {/* Watchlist */}
            <ActivityRow
              icon="heart-outline"
              tone={Colors.accent}
              label="Watchlist"
              sublabel={`${buyer.watchlistCount} saved car${buyer.watchlistCount !== 1 ? 's' : ''}`}
              onPress={() => navigation?.navigate('Tabs', { screen: 'Saved' })}
            />
            {/* Live Auctions */}
            <ActivityRow
              icon="hammer-outline"
              tone="#3B82F6"
              label="Live Auctions"
              sublabel="Bid in real-time"
              isLast
              onPress={() => navigation?.navigate('Tabs', { screen: 'Live' })}
            />
          </View>
        </View>

        {/* ── 5. ACCOUNT section ── */}
        <View style={styles.section}>
          <SectionEyebrow label="ACCOUNT" />
          <View style={styles.activityCard}>
            {/* Messages */}
            <ActivityRow
              icon="chatbubble-ellipses-outline"
              tone="#3B82F6"
              label="Messages"
              sublabel={unreadMessages > 0 ? `${unreadMessages} unread` : 'No new messages'}
              badgeCount={unreadMessages}
              badgeColor={Colors.accent}
              onPress={() => navigation?.navigate('Messages')}
            />
            {/* Notifications */}
            <ActivityRow
              icon="notifications-outline"
              tone={Colors.warning}
              label="Notifications"
              sublabel="Manage your preferences"
              onPress={() => navigation?.navigate('NotificationSettings')}
            />
            {/* Settings & Profile */}
            <ActivityRow
              icon="person-outline"
              tone={Colors.textSecondary}
              label="Profile & Settings"
              sublabel="Verification, payment methods, help"
              isLast
              onPress={() => navigation?.navigate('AccountProfile')}
            />
          </View>
        </View>

        {/* ── 6. Sign out ── */}
        <TouchableOpacity style={styles.signOutCard} activeOpacity={0.75} onPress={handleSignOut}>
          <View style={[styles.activityIcon, { backgroundColor: 'rgba(220,31,38,0.12)' }]}>
            <Ionicons name="log-out-outline" size={17} color={Colors.accent} />
          </View>
          <Text style={styles.signOutLabel}>Sign out</Text>
        </TouchableOpacity>

        {/* Bottom spacer */}
        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════ STYLES ════════════════════════════════

const CARD_BG = '#111115';
const CARD_BORDER = 'rgba(255,255,255,0.06)';

const styles = StyleSheet.create({
  // ── base ──
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },

  // ── header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    borderWidth: 1.5,
    borderColor: Colors.bgPrimary,
    zIndex: 1,
  },

  // ── profile card ──
  profileCard: {
    marginHorizontal: 24,
    marginBottom: 22,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  // avatar
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: Colors.white,
    letterSpacing: 1,
  },
  avatarCheck: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
  },

  // profile info
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  profileEmail: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.textMuted,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  roleBadgeGreen: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.30)',
  },
  roleBadgeAmber: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.30)',
  },
  roleBadgeBlue: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.30)',
  },
  roleBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  roleBadgeTextGreen: {
    color: Colors.success,
  },
  roleBadgeTextAmber: {
    color: Colors.warning,
  },
  roleBadgeTextBlue: {
    color: '#3B82F6',
  },

  // gear button
  gearBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── stats strip ──
  statsCard: {
    marginHorizontal: 24,
    marginBottom: 26,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: 18,
    flexDirection: 'row',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: '70%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  statValueRed: {
    color: Colors.accent,
  },
  statLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // ── section ──
  section: {
    paddingHorizontal: 24,
    marginBottom: 26,
  },
  sectionEyebrow: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },

  // ── activity card ──
  activityCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },
  activityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityTextCol: {
    flex: 1,
    gap: 2,
  },
  activityLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  activitySublabel: {
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
    color: Colors.textMuted,
  },

  // ── badge ──
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.white,
    lineHeight: 14,
  },

  // ── sign out ──
  signOutCard: {
    marginHorizontal: 24,
    marginBottom: 10,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(220,31,38,0.18)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  signOutLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
});
