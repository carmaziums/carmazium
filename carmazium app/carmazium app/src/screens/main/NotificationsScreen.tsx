import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import {
  AppNotification,
  getNotifications,
  markNotificationRead,
  markAllRead,
  notifStyle,
  notifTimeAgo,
} from '../../lib/notificationsApi';
import { getAuction, auctionToListingParam } from '../../lib/auctionApi';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/authStore';

import { IconButton } from '../../components/IconButton';
// ─────────────────────────── helpers ──────────────────────────────────────────

function groupByDate(
  notifications: AppNotification[],
): { label: string; items: AppNotification[] }[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();

  const map = new Map<string, AppNotification[]>();
  for (const n of notifications) {
    const d = new Date(n.createdAt).toDateString();
    const key =
      d === todayStr
        ? 'Today'
        : d === yesterdayStr
        ? 'Yesterday'
        : new Date(n.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
          });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }

  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// ═══════════════════════════ COMPONENT ════════════════════════════════════════

export const NotificationsScreen: React.FC<{ navigation?: any }> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const groups = groupByDate(notifications);

  // ── fetch ────────────────────────────────────────────────────────────────────

  const load = useCallback(async (isRefresh = false) => {
    try {
      const data = await getNotifications(1, 60);
      setNotifications(data.notifications);
    } catch {
      // silently fail — show empty state
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── actions ──────────────────────────────────────────────────────────────────

  const handleTap = useCallback(
    async (n: AppNotification) => {
      if (!n.isRead) {
        // Optimistic update — mark locally immediately
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
        );
        markNotificationRead(n.id).catch(() => {});
      }

      // Deep-link to the relevant screen. Priority mirrors web's
      // NotificationBell.tsx: entityType/entityId first (works for any
      // AUCTION_* type uniformly — WON, ENDED, ENDING all carry the same
      // fields), then type-specific data (chat room id), then a plain
      // type-string fallback for everything else.
      // Case-insensitive — most backend services send entityType: 'AUCTION'
      // but WatchlistReminderService (WATCHLIST_ENDING_24H) sends 'auction'
      // lowercase. Handling both here rather than requiring a backend fix
      // for a display-only mismatch.
      if (n.entityType?.toUpperCase() === 'AUCTION' && n.entityId) {
        try {
          const auction = await getAuction(n.entityId);
          navigation?.navigate('LiveAuctionDetailed', { listing: auctionToListingParam(auction) });
        } catch {
          // Auction may be gone/inaccessible by tap time — fail silently
          // rather than block on an error the user can't act on.
        }
        return;
      }

      if (n.type === 'MESSAGE_RECEIVED' && n.data?.roomId) {
        navigation?.navigate('ChatScreen', { threadId: n.data.roomId });
        return;
      }

      switch (n.type) {
        case 'OUTBID':
        case 'BID_PLACED':
          navigation?.navigate('BuyerBids');
          break;

        case 'OFFER_RECEIVED':
        case 'OFFER_COUNTERED':
          if (role === 'seller' || role === 'dealer') {
            navigation?.navigate('SellerOffers');
          } else {
            navigation?.navigate('BuyerOffers');
          }
          break;

        case 'OFFER_ACCEPTED':
        case 'OFFER_REJECTED':
        case 'OFFER_WITHDRAWN':
          navigation?.navigate('BuyerOffers');
          break;

        case 'DEAL_CLOSED':
          navigation?.navigate('SellerOffers');
          break;

        case 'PAYOUT_FAILED':
          navigation?.navigate('Settings');
          break;

        // All other types: informational only, no actionable destination.
        default:
          break;
      }
    },
    [navigation, role],
  );

  const handleMarkAll = useCallback(async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllRead();
    } catch {
      // If it fails the local state is still updated; acceptable UX trade-off
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, unreadCount]);

  // ── render helpers ────────────────────────────────────────────────────────────

  const renderSkeleton = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <View key={`sk-${i}`} style={styles.skeletonRow}>
        <Skeleton w={44} h={44} r={13} />
        <View style={styles.skeletonContent}>
          <View style={styles.skeletonTitleRow}>
            <Skeleton w={160} h={13} r={6} />
            <Skeleton w={30} h={10} r={5} />
          </View>
          <Skeleton w={220} h={12} r={5} />
          <Skeleton w={180} h={12} r={5} />
        </View>
      </View>
    ));

  const renderEmpty = () => (
    <EmptyState
      icon="notifications-outline"
      title="You're all caught up"
      subtitle="New notifications will show up here."
    />
  );

  const renderRow = useCallback((n: AppNotification, isLast: boolean) => {
    const { icon, color, bg } = notifStyle(n.type);
    return (
      <TouchableOpacity
        key={n.id}
        style={[styles.notifRow, !isLast && styles.notifRowBorder]}
        activeOpacity={0.75}
        onPress={() => handleTap(n)}
      >
        {/* Unread indicator */}
        {!n.isRead && <View style={styles.unreadDot} />}

        {/* Notification icon */}
        <View style={[styles.notifIconWrap, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>

        {/* Text content */}
        <View style={styles.notifContent}>
          <View style={styles.notifTopRow}>
            <Text
              style={[
                styles.notifTitle,
                !n.isRead && styles.notifTitleUnread,
              ]}
              numberOfLines={1}
            >
              {n.title}
            </Text>
            <Text style={styles.notifTime}>{notifTimeAgo(n.createdAt)}</Text>
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>
            {n.message}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleTap]);

  const renderGroup = useCallback(({ item: group }: { item: (typeof groups)[number] }) => (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{group.label}</Text>
      <View style={styles.groupCard}>
        {group.items.map((n, idx) =>
          renderRow(n, idx === group.items.length - 1),
        )}
      </View>
    </View>
  ), [renderRow]);

  // ── main render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Subtle gradient */}
      <LinearGradient
        colors={[Colors.accentAlpha04, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
      />

      {/* Safe area top */}
      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.markAllBtn,
            (markingAll || unreadCount === 0) && styles.markAllBtnDisabled,
          ]}
          activeOpacity={0.7}
          onPress={handleMarkAll}
          disabled={markingAll || unreadCount === 0}
        >
          {markingAll ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Text
              style={[
                styles.markAllText,
                unreadCount === 0 && { opacity: 0.35 },
              ]}
            >
              Read all
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {loading || notifications.length === 0 ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        >
          {loading ? renderSkeleton() : renderEmpty()}
        </ScrollView>
      ) : (
        // FlatList (one row per date group, each group's card rendered exactly as
        // before) so the screen virtualizes instead of mounting every group at
        // once regardless of scroll position (mobile-audit.md P3).
        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          data={groups}
          keyExtractor={(group) => group.label}
          renderItem={renderGroup}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </View>
  );
};

// ═══════════════════════════ STYLES ═══════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenH,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: Spacing.iconBtn,
    height: Spacing.iconBtn,
    borderRadius: Spacing.iconBtn / 2,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.white,
  },
  markAllBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 76,
  },
  markAllBtnDisabled: {
    opacity: 0.7,
  },
  markAllText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.accent,
    letterSpacing: 0.2,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenH,
    paddingTop: 8,
  },

  // ── Skeleton ──
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 14,
    marginBottom: Spacing.itemGap,
  },
  skeletonContent: {
    flex: 1,
    gap: 6,
  },
  skeletonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ── Groups ──
  group: {
    marginBottom: 8,
  },
  groupLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },
  groupCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    overflow: 'hidden',
  },

  // ── Notification row ──
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
    position: 'relative',
  },
  notifRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteAlpha04,
  },
  unreadDot: {
    position: 'absolute',
    top: 21,
    left: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  notifIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
    minWidth: 0,
  },
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 5,
  },
  notifTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  notifTitleUnread: {
    color: Colors.white,
  },
  notifTime: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  notifMessage: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    lineHeight: 19,
  },
});
