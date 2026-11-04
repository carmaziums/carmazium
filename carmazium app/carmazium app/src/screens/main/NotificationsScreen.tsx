import React, { useState, useCallback } from 'react';
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
  Alert,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { FontFamily, FontSize } from '../../constants/typography';
import { Elevation, Spacing, Radius } from '../../constants/spacing';
import {
  AppNotification,
  getNotifications,
  markNotificationRead,
  markAllRead,
  notifStyle,
  notifTimeAgo,
} from '../../lib/notificationsApi';
import { resolveMobileNotificationTarget } from '../../lib/notificationRouting';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/authStore';

import { IconButton } from '../../components/IconButton';
import { Button } from '../../components/Button';
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
  const accountRole = useAuthStore((s) => s.accountRole);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const groups = groupByDate(notifications);

  // ── fetch ────────────────────────────────────────────────────────────────────

  const load = useCallback(async (isRefresh = false) => {
    try {
      const data = await getNotifications(1, 50);
      setNotifications(data.notifications);
      setTotal(data.total);
      setPage(1);
      setLoadError(null);
    } catch {
      setLoadError('Could not load notifications. Check your connection and try again.');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || notifications.length >= total) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await getNotifications(nextPage, 50);
      setNotifications(prev => {
        const seen = new Set(prev.map(item => item.id));
        return [...prev, ...data.notifications.filter(item => !seen.has(item.id))];
      });
      setTotal(data.total);
      setPage(nextPage);
      setLoadError(null);
    } catch {
      setLoadError('Could not load older notifications. Check your connection and try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, notifications.length, page, total]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  // ── actions ──────────────────────────────────────────────────────────────────

  const handleTap = useCallback(
    async (n: AppNotification) => {
      if (!n.isRead) {
        // Optimistic update — mark locally immediately
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
        );
        markNotificationRead(n.id).catch(() => {
          // Keep the unread badge truthful if the server could not save it.
          setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: false } : x));
        });
      }

      const target = await resolveMobileNotificationTarget(n, accountRole);
      if (target) {
        navigation?.navigate(target.screen as never, target.params as never);
      }
    },
    [navigation, accountRole],
  );

  const handleMarkAll = useCallback(async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {
      Alert.alert('Unable to mark notifications read', 'Your notifications are unchanged. Please try again.');
      await load();
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, unreadCount, load]);

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
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />

      {/* Subtle gradient */}
      <LinearGradient
        colors={[Colors.accentAlpha04, Colors.groundClear, Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
      />

      {/* Global website-like navigation owns safe-area top. */}
      <WebsiteTopBar />

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

      {/* Preserve the last known notifications and offer retry after a network error. */}
      {!!loadError && (
        <View style={styles.retryBanner}>
          <Ionicons name="alert-circle-outline" size={20} color={Colors.warning} />
          <Text style={styles.retryText}>{loadError}</Text>
          <Button label="Retry" onPress={() => void load()} variant="outline" size="sm" accessibilityLabel="Retry loading notifications" />
        </View>
      )}

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
          {loading ? renderSkeleton() : loadError ? null : renderEmpty()}
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
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            <View style={{ minHeight: 100, alignItems: 'center', justifyContent: 'center' }}>
              {loadingMore && <ActivityIndicator size="small" color={Colors.accent} />}
            </View>
          }
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

  retryBanner: { marginHorizontal: 20, marginBottom: 10, borderWidth: 1, borderRadius: Radius.inline, minHeight: 64, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bgCard, borderColor: Colors.warning, ...Elevation.card },
  retryText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  retryButtonText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.accent },
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 2,
    ...Elevation.card,
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
    color: Colors.onAccent,
  },
  markAllBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderHi,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 76,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 3,
    ...Elevation.card,
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
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 14,
    marginBottom: Spacing.itemGap,
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
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
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    ...Elevation.card,
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
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
