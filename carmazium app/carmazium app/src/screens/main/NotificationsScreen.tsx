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
  getUnreadCount,
  notifStyle,
  notifTimeAgo,
} from '../../lib/notificationsApi';
import { resolveMobileNotificationTarget } from '../../lib/notificationRouting';
import { getVisibleNotifications, buildEmailNotificationPreferences } from '../../lib/nativeNotificationParity';
import { apiClient } from '../../lib/apiClient';
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
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [profilePreferences, setProfilePreferences] = useState<Record<string, unknown>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const visibleNotifications = getVisibleNotifications(notifications, filter);
  const groups = groupByDate(visibleNotifications);

  // ── fetch ────────────────────────────────────────────────────────────────────

  const load = useCallback(async (isRefresh = false) => {
    setPreferencesReady(false);
    try {
      // Preference/profile failures must never prevent the notification inbox
      // from loading. The website keeps its list visible in that situation too.
      const [data, count, me] = await Promise.allSettled([
        getNotifications(1, 50),
        getUnreadCount(),
        apiClient<{ data?: { preferences?: Record<string, unknown> } }>('/users/me'),
      ] as const);
      if (data.status !== 'fulfilled') throw Error('Notifications unavailable');
      setNotifications(data.value.notifications);
      setTotal(data.value.total);
      setUnreadTotal(Math.max(
        count.status === 'fulfilled' ? count.value : 0,
        data.value.notifications.filter(n => !n.isRead).length,
      ));
      if (me.status === 'fulfilled') {
        const preferences = me.value.data?.preferences ?? {};
        setProfilePreferences(preferences);
        const prefs = preferences.notifications;
        const notificationPrefs = prefs && typeof prefs === 'object' && !Array.isArray(prefs)
          ? prefs as Record<string, unknown> : {};
        setEmailEnabled(notificationPrefs.email !== false);
        setPreferencesReady(true);
      }
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
        setUnreadTotal(count => Math.max(0, count - 1));
        markNotificationRead(n.id).catch(() => {
          setUnreadTotal(count => count + 1);
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
    if (markingAll || unreadTotal === 0) return;
    setMarkingAll(true);
    try {
      await markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadTotal(0);
    } catch {
      Alert.alert('Unable to mark notifications read', 'Your notifications are unchanged. Please try again.');
      await load();
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, unreadTotal, load]);

  // ── render helpers ────────────────────────────────────────────────────────────

  const handleToggleEmail = useCallback(async () => {
    if (emailSaving || !preferencesReady) return;
    const previous = emailEnabled;
    const next = !previous;
    setEmailSaving(true);
    setEmailEnabled(next);
    try {
      const preferences = buildEmailNotificationPreferences(profilePreferences, next);
      await apiClient('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ preferences }),
      });
      setProfilePreferences(preferences);
    } catch {
      setEmailEnabled(previous);
      Alert.alert('Preference not saved', 'Could not save your email notification preference. Please try again.');
    } finally {
      setEmailSaving(false);
    }
  }, [emailEnabled, emailSaving, profilePreferences, preferencesReady]);

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
          {unreadTotal > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadTotal > 99 ? '99+' : unreadTotal}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.markAllBtn,
            (markingAll || unreadTotal === 0) && styles.markAllBtnDisabled,
          ]}
          activeOpacity={0.7}
          onPress={handleMarkAll}
          disabled={markingAll || unreadTotal === 0}
        >
          {markingAll ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Text
              style={[
                styles.markAllText,
                unreadTotal === 0 && { opacity: 0.35 },
              ]}
            >
              Mark all read
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.websiteControls}>
        <Text style={styles.statusSummary}>{unreadTotal > 0 ? `${unreadTotal} unread` : "You're all caught up"}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh notifications"
          onPress={() => void load(true)} disabled={loading || refreshing} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={17} color={Colors.textSecondary} />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
        <View style={styles.filtersRow} accessibilityRole="tablist">
          {(['all', 'unread'] as const).map(tab => <TouchableOpacity key={tab}
            accessibilityRole="tab" accessibilityState={{ selected: filter === tab }}
            onPress={() => setFilter(tab)}
            style={[styles.filterButton, filter === tab && styles.filterActive]}>
            <Text style={[styles.filterLabel, filter === tab && styles.filterActiveLabel]}>{tab === 'all' ? 'All' : 'Unread'}</Text>
          </TouchableOpacity>)}
        </View>
        <TouchableOpacity accessibilityRole="switch" accessibilityLabel="Email notifications"
          accessibilityState={{ checked: emailEnabled, disabled: emailSaving || !preferencesReady }}
          disabled={emailSaving || !preferencesReady} onPress={() => void handleToggleEmail()} style={styles.emailRow}>
          <Ionicons name="mail-outline" size={21} color={Colors.accent} />
          <View style={styles.emailTextWrap}>
            <Text style={styles.emailTitle}>Email notifications</Text>
            <Text style={styles.emailHint}>{!preferencesReady ? 'Preference unavailable' : emailEnabled ? 'On' : 'Off'}</Text>
          </View>
          <View style={[styles.emailSwitch, emailEnabled && styles.emailSwitchOn]}>
            <View style={[styles.emailKnob, emailEnabled && styles.emailKnobOn]} />
          </View>
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
      {loading || visibleNotifications.length === 0 ? (
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
  websiteControls: { marginHorizontal: 20, marginBottom: 8, padding: 16, gap: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, borderRadius: 18 },
  statusSummary: { color: Colors.textSecondary, fontSize: FontSize.sm, fontFamily: FontFamily.medium },
  refreshButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.inputBg, paddingHorizontal: 15, alignSelf: 'flex-start' },
  refreshText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary },
  filtersRow: { alignSelf: 'flex-start', flexDirection: 'row', gap: 6, padding: 5, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.inputBg, borderRadius: 12 },
  filterButton: { minHeight: 42, paddingHorizontal: 17, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: Colors.accent },
  filterLabel: { color: Colors.textSecondary, fontSize: FontSize.base, fontFamily: FontFamily.bold },
  filterActiveLabel: { color: Colors.onAccent },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 65, padding: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.inputBg, borderRadius: 13 },
  emailTextWrap: { flex: 1, gap: 3 },
  emailTitle: { color: Colors.textPrimary, fontSize: FontSize.base, fontFamily: FontFamily.bold },
  emailHint: { color: Colors.textMuted, fontSize: FontSize.sm },
  emailSwitch: { width: 48, height: 27, borderRadius: 15, backgroundColor: Colors.border, padding: 3, justifyContent: 'center' },
  emailSwitchOn: { backgroundColor: Colors.accent },
  emailKnob: { width: 21, height: 21, borderRadius: 12, backgroundColor: Colors.onAccent, alignSelf: 'flex-start' },
  emailKnobOn: { alignSelf: 'flex-end' },
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
