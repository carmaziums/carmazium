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
import { Colors } from '../../constants/colors';
import { useNativeAppearance } from '../../theme/NativeAppearanceProvider';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { FontFamily, FontSize } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';
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
  const { palette, resolvedAppearance } = useNativeAppearance();
  const themed = useNotificationsThemeStyles();
  const accountRole = useAuthStore((s) => s.accountRole);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const groups = groupByDate(notifications);

  // ── fetch ────────────────────────────────────────────────────────────────────

  const load = useCallback(async (isRefresh = false) => {
    try {
      const data = await getNotifications(1, 60);
      setNotifications(data.notifications);
      setLoadError(null);
    } catch {
      setLoadError('Could not load notifications. Check your connection and try again.');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

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
      <View key={`sk-${i}`} style={themed.skeletonRow}>
        <Skeleton w={44} h={44} r={13} />
        <View style={themed.skeletonContent}>
          <View style={themed.skeletonTitleRow}>
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
        style={[themed.notifRow, !isLast && styles.notifRowBorder]}
        activeOpacity={0.75}
        onPress={() => handleTap(n)}
      >
        {/* Unread indicator */}
        {!n.isRead && <View style={themed.unreadDot} />}

        {/* Notification icon */}
        <View style={[themed.notifIconWrap, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>

        {/* Text content */}
        <View style={themed.notifContent}>
          <View style={themed.notifTopRow}>
            <Text
              style={[
                styles.notifTitle,
                !n.isRead && styles.notifTitleUnread,
              ]}
              numberOfLines={1}
            >
              {n.title}
            </Text>
            <Text style={themed.notifTime}>{notifTimeAgo(n.createdAt)}</Text>
          </View>
          <Text style={themed.notifMessage} numberOfLines={2}>
            {n.message}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleTap]);

  const renderGroup = useCallback(({ item: group }: { item: (typeof groups)[number] }) => (
    <View style={themed.group}>
      <Text style={themed.groupLabel}>{group.label}</Text>
      <View style={themed.groupCard}>
        {group.items.map((n, idx) =>
          renderRow(n, idx === group.items.length - 1),
        )}
      </View>
    </View>
  ), [renderRow]);

  // ── main render ──────────────────────────────────────────────────────────────

  return (
    <View style={themed.container}>
      <StatusBar barStyle={resolvedAppearance === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor={palette.bgBody} />

      {/* Subtle gradient */}
      <LinearGradient
        colors={[Colors.accentAlpha04, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
      />

      {/* Global website-like navigation owns safe-area top. */}
      <WebsiteTopBar />

      {/* ── Header ── */}
      <View style={themed.header}>
        <IconButton style={themed.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />

        <View style={themed.headerCenter}>
          <Text style={themed.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={themed.unreadBadge}>
              <Text style={themed.unreadBadgeText}>
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
        <View style={themed.retryBanner}>
          <Ionicons name="alert-circle-outline" size={20} color={Colors.warning} />
          <Text style={themed.retryText}>{loadError}</Text>
          <TouchableOpacity style={themed.retryButton} onPress={() => void load()} accessibilityRole="button" accessibilityLabel="Retry loading notifications">
            <Text style={themed.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Content ── */}
      {loading || notifications.length === 0 ? (
        <ScrollView
          style={themed.scroll}
          contentContainerStyle={themed.scrollContent}
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
          style={themed.scroll}
          contentContainerStyle={themed.scrollContent}
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

  retryBanner: { marginHorizontal: 20, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderHi, borderRadius: Radius.inline, backgroundColor: Colors.bgCardSolid, minHeight: 64, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: Radius.inline,
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
    borderRadius: Radius.card,
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
    backgroundColor: Colors.bgCardSolid,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
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
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});

function useNotificationsThemeStyles() {
  const { palette } = useNativeAppearance();
  return React.useMemo(() => ({
    ...styles,
    container: [styles.container, { backgroundColor: palette.bgBody }],
    retryBanner: [styles.retryBanner, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    retryText: [styles.retryText, { color: palette.textSecondary }],
    retryButton: [styles.retryButton, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    retryButtonText: [styles.retryButtonText, { color: palette.textPrimary }],
    header: [styles.header, { backgroundColor: palette.bgHeader, borderBottomColor: palette.borderDefault }],
    backBtn: [styles.backBtn, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    headerTitle: [styles.headerTitle, { color: palette.textPrimary }],
    markAllBtn: [styles.markAllBtn, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    markAllText: [styles.markAllText, { color: palette.textSecondary }],
    groupLabel: [styles.groupLabel, { color: palette.textMuted }],
    groupCard: [styles.groupCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    notifRow: [styles.notifRow, { backgroundColor: palette.bgCard }],
    notifRowBorder: [styles.notifRowBorder, { borderBottomColor: palette.borderDefault }],
    notifIconWrap: [styles.notifIconWrap, { backgroundColor: palette.bgInput }],
    notifTitle: [styles.notifTitle, { color: palette.textPrimary }],
    notifTime: [styles.notifTime, { color: palette.textMuted }],
    notifMessage: [styles.notifMessage, { color: palette.textSecondary }],
    skeletonRow: [styles.skeletonRow, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
  }), [palette]);
}
