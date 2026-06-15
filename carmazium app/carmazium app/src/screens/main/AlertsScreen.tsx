import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import {
  getNotifications, getUnreadCount, markNotificationRead, markAllRead,
  notifStyle, notifTimeAgo, type AppNotification,
} from '../../lib/notificationsApi';
import { useAuthStore } from '../../store/authStore';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─── Notification item ────────────────────────────────────────────────────────

const NotifItem: React.FC<{ notif: AppNotification; onPress: () => void }> = ({ notif, onPress }) => {
  const ns = notifStyle(notif.type);
  return (
    <TouchableOpacity
      style={[s.notifItem, !notif.isRead && s.notifItemUnread]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {!notif.isRead && <View style={s.unreadDot} />}
      <View style={[s.notifIcon, { backgroundColor: ns.bg }]}>
        <Ionicons name={ns.icon as any} size={18} color={ns.color} />
      </View>
      <View style={s.notifBody}>
        <Text style={s.notifTitle} numberOfLines={1}>{notif.title}</Text>
        <Text style={s.notifMsg} numberOfLines={2}>{notif.message}</Text>
        <Text style={s.notifTime}>{notifTimeAgo(notif.createdAt)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color="#404050" />
    </TouchableOpacity>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export const AlertsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { isAuthenticated } = useAuthStore();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      const [data, count] = await Promise.all([
        getNotifications(1, 40),
        getUnreadCount(),
      ]);
      setNotifications(data.notifications ?? []);
      setUnreadCount(count);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleNotifPress = async (notif: AppNotification) => {
    // Mark read locally
    if (!notif.isRead) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      try { await markNotificationRead(notif.id); } catch { /* non-fatal */ }
    }

    // Navigate based on type
    switch (notif.type) {
      case 'AUCTION_WON':
      case 'AUCTION_ENDED':
        if (notif.entityId) navigation.navigate('Tabs', { screen: 'Live' });
        break;
      case 'OFFER_RECEIVED':
      case 'OFFER_ACCEPTED':
      case 'OFFER_REJECTED':
      case 'OFFER_COUNTERED':
      case 'OFFER_WITHDRAWN':
      case 'DEAL_CLOSED':
        navigation.navigate('Tabs', { screen: 'Profile' });
        break;
      case 'MESSAGE_RECEIVED':
        navigation.navigate('Messages');
        break;
      default:
        break;
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* non-fatal */ } finally {
      setMarkingAll(false);
    }
  };

  const grouped = {
    today: notifications.filter(n => {
      const diff = Date.now() - new Date(n.createdAt).getTime();
      return diff < 24 * 3600 * 1000;
    }),
    earlier: notifications.filter(n => {
      const diff = Date.now() - new Date(n.createdAt).getTime();
      return diff >= 24 * 3600 * 1000;
    }),
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.03)', 'rgba(0,0,0,0)', '#0A0A0C']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {unreadCount > 0 && (
            <TouchableOpacity style={s.iconBtn} onPress={handleMarkAllRead} activeOpacity={0.7}>
              {markingAll
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              }
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => navigation.navigate('NotificationSettings' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {!isAuthenticated ? (
        <View style={s.centerState}>
          <Ionicons name="notifications-outline" size={40} color="#404050" />
          <Text style={s.centerTitle}>Sign in to see notifications</Text>
          <TouchableOpacity style={s.signInBtn} onPress={() => navigation.navigate('Login' as any)}>
            <Text style={s.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={s.skeletonList}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={`sk-${i}`} style={s.skeletonRow}>
              <Skeleton w={42} h={42} r={12} />
              <View style={s.skeletonContent}>
                <Skeleton w={160} h={14} r={6} />
                <Skeleton w={220} h={12} r={5} />
                <Skeleton w={60} h={10} r={5} />
              </View>
            </View>
          ))}
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="alert-circle-outline"
          title="No alerts"
          subtitle="Price drops and auction reminders will appear here."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
          }
        >
          {/* Mark all read hint */}
          {unreadCount > 0 && (
            <TouchableOpacity style={s.markAllRow} onPress={handleMarkAllRead} activeOpacity={0.7}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={s.markAllText}>Mark all {unreadCount} as read</Text>
            </TouchableOpacity>
          )}

          {/* Today */}
          {grouped.today.length > 0 && (
            <>
              <Text style={s.groupLabel}>TODAY</Text>
              {grouped.today.map(n => (
                <NotifItem key={n.id} notif={n} onPress={() => handleNotifPress(n)} />
              ))}
            </>
          )}

          {/* Earlier */}
          {grouped.earlier.length > 0 && (
            <>
              <Text style={[s.groupLabel, { marginTop: 20 }]}>EARLIER</Text>
              {grouped.earlier.map(n => (
                <NotifItem key={n.id} notif={n} onPress={() => handleNotifPress(n)} />
              ))}
            </>
          )}

          {/* Settings CTA */}
          <TouchableOpacity
            style={s.settingsCta}
            onPress={() => navigation.navigate('NotificationSettings' as any)}
            activeOpacity={0.8}
          >
            <View style={[s.notifIcon, { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
              <Ionicons name="settings-outline" size={18} color="#A0A0AB" />
            </View>
            <Text style={s.settingsCtaText}>Manage notification preferences</Text>
            <Ionicons name="chevron-forward" size={15} color="#404050" />
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: 18, color: '#FFFFFF' },
  unreadBadge: { backgroundColor: Colors.accent, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, minWidth: 22, alignItems: 'center' },
  unreadBadgeText: { fontFamily: FontFamily.bold, fontSize: 10, color: '#FFF' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },

  scrollContent: { paddingHorizontal: 18, paddingTop: 8 },

  markAllRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4, marginBottom: 8 },
  markAllText: { fontFamily: FontFamily.bold, fontSize: 12, color: '#10B981' },

  groupLabel: { fontFamily: FontFamily.bold, fontSize: 10, color: '#606070', letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },

  notifItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111116', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 14, marginBottom: 8, position: 'relative' },
  notifItemUnread: { borderColor: 'rgba(220,31,38,0.2)', backgroundColor: 'rgba(220,31,38,0.03)' },
  unreadDot: { position: 'absolute', top: 12, right: 12, width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent },
  notifIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifBody: { flex: 1 },
  notifTitle: { fontFamily: FontFamily.bold, fontSize: 14, color: '#FFFFFF', marginBottom: 3 },
  notifMsg: { fontFamily: FontFamily.regular, fontSize: 12, color: '#A0A0AB', lineHeight: 17, marginBottom: 5 },
  notifTime: { fontFamily: FontFamily.regular, fontSize: 10, color: '#606070' },

  settingsCta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111116', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 14, marginTop: 8 },
  settingsCtaText: { flex: 1, fontFamily: FontFamily.medium, fontSize: 13, color: '#A0A0AB' },

  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  centerTitle: { fontFamily: FontFamily.bold, fontSize: 18, color: '#FFFFFF', textAlign: 'center' },
  centerHint: { fontFamily: FontFamily.regular, fontSize: 13, color: '#606070', textAlign: 'center', lineHeight: 20 },
  signInBtn: { backgroundColor: Colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  signInBtnText: { fontFamily: FontFamily.bold, fontSize: 14, color: '#FFF' },
  skeletonList: { paddingHorizontal: 18, paddingTop: 8, gap: 8 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111116', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 14 },
  skeletonContent: { flex: 1, gap: 6 },
});
