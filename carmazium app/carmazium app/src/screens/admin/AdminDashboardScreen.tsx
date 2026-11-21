import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import { apiClient } from '../../lib/apiClient';
import { getAdminStats, getPendingHandovers, type AdminStats } from '../../lib/adminApi';
import { getAppStats, getOnlineNow, type AppStats, type OnlineNow } from '../../lib/appInsights';
import {
  ADMIN_DASHBOARD_CARDS, DEFAULT_ADMIN_CARD_IDS, getAdminCardValue,
  normalizeAdminCardIds, type AdminDashboardCard, type AdminDashboardCardId,
} from '../../lib/nativeAdminDashboard';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import { openAdminWeb } from './adminShared';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type MenuItem = { label: string; icon: string; screen?: string; webPath?: string };
type MenuGroup = { section: string; subtitle: string; items: MenuItem[] };

// The website's admin modules, ordered by responsibility. Unsupported native
// modules are labelled explicitly; the next parity block will replace links
// with native screens, never blank or fake controls.
const MENU: MenuGroup[] = [
  { section: 'Workspace', subtitle: 'Conversations and admin priorities',
    items: [{ label: 'Messages', icon: 'chatbubbles-outline', webPath: '/dashboard/admin/messages' }] },
  { section: 'Marketplace', subtitle: 'Listings, auctions, handovers and cancellations', items: [
    { label: 'Create Listing', icon: 'add-circle-outline', screen: 'SellLanding' },
    { label: 'Listings', icon: 'car-outline', screen: 'AdminListingsReview' },
    { label: 'Auctions', icon: 'hammer-outline', screen: 'AdminAuctions' },
    { label: 'Handovers', icon: 'hand-left-outline', screen: 'AdminHandovers' },
    { label: 'Sale Cancellations', icon: 'shield-checkmark-outline', webPath: '/dashboard/admin/cancellations' },
  ] },
  { section: 'Payments & reports', subtitle: 'Review platform charges and documents', items: [
    { label: 'Transactions', icon: 'receipt-outline', screen: 'AdminTransactions' },
    { label: 'Warranty Orders', icon: 'shield-checkmark-outline', webPath: '/dashboard/admin/warranty-orders' },
    { label: 'Vehicle History Reports', icon: 'document-text-outline', webPath: '/dashboard/admin/hpi' },
    { label: 'Free Listing Grants', icon: 'gift-outline', webPath: '/dashboard/admin/free-listings' },
  ] },
  { section: 'Accounts & partners', subtitle: 'Accounts, dealer KYC and service providers', items: [
    { label: 'Accounts', icon: 'people-outline', screen: 'AdminAccounts' },
    { label: 'All Dealers', icon: 'business-outline', webPath: '/dashboard/admin/dealers' },
    { label: 'Dealer KYC', icon: 'shield-outline', screen: 'AdminDealerKyc' },
    { label: 'Trade Services', icon: 'briefcase-outline', webPath: '/dashboard/admin/services' },
    { label: 'Finance Providers', icon: 'card-outline', webPath: '/dashboard/admin/finance-providers' },
  ] },
  { section: 'Content & insights', subtitle: 'Performance and website content', items: [
    { label: 'Online, App & Reports', icon: 'pulse-outline', screen: 'AdminAppInsights' },
    { label: 'Analytics', icon: 'trending-up-outline', webPath: '/dashboard/admin/analytics' },
    { label: 'AI Reports', icon: 'sparkles-outline', webPath: '/dashboard/admin/ai-reports' },
    { label: 'Marketing Popup', icon: 'megaphone-outline', webPath: '/dashboard/admin/marketing-popup' },
    { label: 'Blog', icon: 'newspaper-outline', webPath: '/dashboard/admin/blog' },
  ] },
];

const categoryColour = (category: AdminDashboardCard['category']) => ({
  blue: Colors.info, green: Colors.success, amber: Colors.warning,
  violet: Colors.brandNavy, red: Colors.accent,
})[category];

const categoryBackground = (category: AdminDashboardCard['category']) => ({
  blue: Colors.infoBlueAlpha10, green: Colors.successAlpha10,
  amber: Colors.warningAlpha10, violet: Colors.infoBlueAlpha06,
  red: Colors.accentAlpha10,
})[category];

const quickActions: MenuItem[] = [
  { label: 'Review listings', icon: 'car-outline', screen: 'AdminListingsReview' },
  { label: 'Vehicle history reports', icon: 'document-text-outline', webPath: '/dashboard/admin/hpi' },
  { label: 'Dealer verification', icon: 'shield-outline', screen: 'AdminDealerKyc' },
  { label: 'Pending handovers', icon: 'hand-left-outline', screen: 'AdminHandovers' },
];

const number = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('en-GB');

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const bottomPad = useTabBarClearance();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [online, setOnline] = useState<OnlineNow | null>(null);
  const [installs, setInstalls] = useState<AppStats | null>(null);
  const [pendingHandovers, setPendingHandovers] = useState<number | null>(null);
  const [visibleIds, setVisibleIds] = useState<AdminDashboardCardId[]>([...DEFAULT_ADMIN_CARD_IDS]);
  const [draftIds, setDraftIds] = useState<AdminDashboardCardId[]>([...DEFAULT_ADMIN_CARD_IDS]);
  const [cardEditorOpen, setCardEditorOpen] = useState(false);
  const [savingCards, setSavingCards] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    const results = await Promise.allSettled([
      getAdminStats(),
      getPendingHandovers(),
      getOnlineNow(),
      getAppStats(),
      apiClient<{ data: { preferences?: { adminDashboardCardIds?: unknown } } }>('/users/me'),
    ] as const);

    if (results[0].status === 'fulfilled') setStats(results[0].value);
    else setError('Could not load admin statistics. Use Refresh data to retry.');
    setPendingHandovers(results[1].status === 'fulfilled' ? results[1].value.length : null);
    setOnline(results[2].status === 'fulfilled' ? results[2].value : null);
    setInstalls(results[3].status === 'fulfilled' ? results[3].value : null);
    if (results[4].status === 'fulfilled') {
      setVisibleIds(normalizeAdminCardIds(results[4].value.data?.preferences?.adminDashboardCardIds));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  // The website refreshes recent visitor signals every 30 seconds. Keep the
  // timer active only while an admin is viewing this screen.
  useFocusEffect(useCallback(() => {
    void load();
    let active = true;
    const timer = setInterval(() => {
      void getOnlineNow().then(result => {
        if (active) setOnline(result);
      }).catch(() => { if (active) setOnline(null); });
    }, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [load]));

  const openItem = (item: MenuItem) => {
    if (item.screen) {
      navigation.navigate(item.screen as never);
    } else if (item.webPath) {
      void openAdminWeb(item.webPath);
    }
  };

  const openCard = (card: AdminDashboardCard) => {
    openItem({ label: card.label, icon: card.icon, screen: card.route, webPath: card.webPath });
  };

  const openEditor = () => {
    setDraftIds([...visibleIds]);
    setSaveError(null);
    setCardEditorOpen(true);
  };

  const saveCards = async () => {
    setSavingCards(true);
    setSaveError(null);
    try {
      await apiClient('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ preferences: { adminDashboardCardIds: draftIds } }),
      });
      setVisibleIds([...draftIds]);
      setCardEditorOpen(false);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save dashboard cards.');
    } finally {
      setSavingCards(false);
    }
  };

  return <View style={styles.screen}>
    <WebsiteTopBar />
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={Colors.accent} />}
    >
      <LinearGradient
        colors={[Colors.brandNavy, Colors.brandNavy, Colors.brandNavy]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroBadges}>
          <Text style={styles.heroBadge}>ADMIN COMMAND CENTRE</Text>
          <Text style={styles.liveBadge}>Live systems</Text>
        </View>
        <Text style={styles.heroTitle}>Control the whole platform from one place.</Text>
        <Text style={styles.heroDescription}>Live platform totals, priority actions and every admin tool — organised for fast decisions.</Text>
        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.refreshButton} accessibilityRole="button" accessibilityLabel="Refresh admin data" onPress={() => void load(true)} disabled={refreshing}>
            <Ionicons name="refresh-outline" size={18} color={Colors.onAccent} />
            <Text style={styles.heroActionText}>{refreshing ? 'Refreshing…' : 'Refresh data'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} accessibilityRole="button" accessibilityLabel="Create listing" onPress={() => navigation.navigate('SellLanding')}>
            <Ionicons name="add-outline" size={18} color={Colors.onAccent} />
            <Text style={styles.heroActionText}>Create listing</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {error && <ErrorBanner message={error} onRetry={() => void load(true)} />}

      <View style={styles.telemetryCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionEyebrow}>RECENTLY ACTIVE (ESTIMATED)</Text>
          <Text style={styles.smallNote}>Last 2 min · updates every 30s</Text>
        </View>
        <Text style={styles.metricLabel}>Active visitor signals</Text>
        <Text style={styles.metricNumber}>{number(online?.total)}</Text>
        <Text style={styles.smallNote}>{online ? number(online.web.signedIn + online.app.signedIn) + ' verified signed-in accounts (per website/app)' : 'Current signals unavailable'}</Text>
        <View style={styles.telemetrySplit}>
          <View style={styles.telemetryColumn}>
            <Text style={styles.metricLabel}>On the website</Text>
            <Text style={[styles.metricNumber, { color: Colors.success }]}>{number(online?.web.total)}</Text>
            <Text style={styles.smallNote}>{online ? `${online.web.desktop} desktop · ${online.web.mobile} mobile · ${online.web.installed} installed` : '—'}</Text>
          </View>
          <View style={styles.telemetryColumn}>
            <Text style={styles.metricLabel}>In the app</Text>
            <Text style={[styles.metricNumber, { color: Colors.success }]}>{number(online?.app.total)}</Text>
            <Text style={styles.smallNote}>{online ? `${online.app.android} Android · ${online.app.ios} iPhone` : '—'}</Text>
          </View>
        </View>
        <Text style={styles.smallNote}>Recent website/app heartbeats, not guaranteed live connections; signed-in identities are deduplicated per surface.</Text>
      </View>

      <TouchableOpacity style={styles.telemetryCard} accessibilityRole="button" accessibilityLabel="View app downloads and first opens"
        onPress={() => navigation.navigate('AdminAppInsights')}>
        <Text style={styles.sectionEyebrow}>APP DOWNLOADS & FIRST OPENS</Text>
        <View style={styles.telemetrySplit}>
          <View style={styles.telemetryColumn}>
            <Text style={styles.metricLabel}>Android native first opens</Text>
            <Text style={styles.metricNumber}>{number(installs?.installs.androidApp)}</Text>
          </View>
          <View style={styles.telemetryColumn}>
            <Text style={styles.metricLabel}>APK downloads</Text>
            <Text style={styles.metricNumber}>{number(installs?.apkDownloads)}</Text>
          </View>
        </View>
        <View style={styles.telemetrySplit}>
          <View style={styles.telemetryColumn}>
            <Text style={styles.metricLabel}>Android web-app first opens</Text>
            <Text style={styles.metricNumber}>{number(installs?.installs.androidWebApp)}</Text>
          </View>
          <View style={styles.telemetryColumn}>
            <Text style={styles.metricLabel}>iPhone web-app first opens</Text>
            <Text style={styles.metricNumber}>{number(installs?.installs.iosWebApp)}</Text>
          </View>
        </View>
        <Text style={styles.smallNote}>All time · iPhone native first opens: {number(installs?.installs.iosApp)} · Windows web-app first opens: {number(installs?.installs.windows)}. Downloads do not prove installation; first opens are reported events.</Text>
      </TouchableOpacity>

      {pendingHandovers != null && pendingHandovers > 0 && (
        <TouchableOpacity style={styles.priorityBanner} onPress={() => navigation.navigate('AdminHandovers')} accessibilityRole="button">
          <Ionicons name="warning-outline" size={25} color={Colors.warning} />
          <View style={styles.flex}>
            <Text style={styles.priorityTitle}>{pendingHandovers} handover{pendingHandovers === 1 ? '' : 's'} need review</Text>
            <Text style={styles.smallNote}>Approve or deny the submitted proof.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      <View style={styles.sectionHeaderRow}>
        <View style={styles.flex}>
          <Text style={styles.sectionEyebrow}>LIVE PLATFORM DATA</Text>
          <Text style={styles.sectionTitle}>At a glance</Text>
          <Text style={styles.smallNote}>Choose the cards that are most useful to you.</Text>
        </View>
        <TouchableOpacity style={styles.configureButton} onPress={openEditor} accessibilityRole="button" accessibilityLabel="Customize admin dashboard cards">
          <Ionicons name="options-outline" size={16} color={Colors.textPrimary} />
          <Text style={styles.configureText}>Customize cards</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.statGrid}>
        {visibleIds.length === 0 ? (
          <TouchableOpacity style={styles.empty} onPress={openEditor} accessibilityRole="button">
            <Ionicons name="grid-outline" size={24} color={Colors.textMuted} />
            <Text style={styles.cardLabel}>No cards selected. Tap to add cards.</Text>
          </TouchableOpacity>
        ) : visibleIds.map((id) => {
          const card = ADMIN_DASHBOARD_CARDS.find(c => c.id === id);
          if (!card) return null;
          const accent = categoryColour(card.category);
          return <TouchableOpacity key={id} style={[styles.statCard, { backgroundColor: categoryBackground(card.category), borderColor: accent }]}
            accessibilityRole="button" accessibilityLabel={`Open ${card.label} admin page`}
            onPress={() => openCard(card)}>
            <View style={styles.statCardTop}>
              <View style={[styles.statIcon, { backgroundColor: accent }]}>
                <Ionicons name={card.icon as any} size={20} color={Colors.onAccent} />
              </View>
              <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
            </View>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit>{loading && !stats ? '…' : getAdminCardValue(id, stats, pendingHandovers)}</Text>
          </TouchableOpacity>;
        })}
      </View>

      <Text style={styles.sectionEyebrow}>FAST ACCESS</Text>
      <Text style={styles.sectionTitle}>Quick actions</Text>
      <Text style={styles.smallNote}>The tools used most often, one tap away.</Text>
      <View style={styles.actionsGrid}>
        {quickActions.map((item) => <TouchableOpacity key={item.label} style={styles.quickAction}
          onPress={() => openItem(item)} accessibilityRole="button"
          accessibilityLabel={item.webPath ? `${item.label}, opens the website` : item.label}>
          <Ionicons name={item.icon as any} size={22} color={Colors.accent} />
          <Text style={styles.quickText}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={17} color={Colors.textMuted} />
        </TouchableOpacity>)}
      </View>

      <Text style={styles.sectionEyebrow}>SYSTEM MODULES</Text>
      <Text style={styles.sectionTitle}>All admin tools</Text>
      <Text style={styles.smallNote}>Every existing admin function, organised by job.</Text>
      {MENU.map((group) => <View key={group.section} style={styles.moduleGroup}>
        <View style={styles.moduleHeading}>
          <Text style={styles.moduleTitle}>{group.section}</Text>
          <Text style={styles.smallNote}>{group.subtitle}</Text>
        </View>
        {group.items.map((item) => <TouchableOpacity key={item.label} style={styles.moduleRow}
          onPress={() => openItem(item)} accessibilityRole="button"
          accessibilityLabel={item.webPath ? `${item.label}, opens the website` : item.label}>
          <Ionicons name={item.icon as any} size={22} color={Colors.accent} />
          <Text style={styles.quickText}>{item.label}</Text>
          {item.webPath && <Text style={styles.websiteTag}>Website</Text>}
          <Ionicons name={item.webPath ? 'open-outline' : 'chevron-forward'} size={15} color={Colors.textMuted} />
        </TouchableOpacity>)}
      </View>)}
    </ScrollView>
    <Modal visible={cardEditorOpen} animationType="slide" transparent onRequestClose={() => { if (!savingCards) setCardEditorOpen(false); }}>
      <View style={styles.modalBackdrop}>
        <View style={styles.editor}>
          <Text style={styles.sectionTitle}>Customize admin dashboard</Text>
          <Text style={styles.smallNote}>Select the metrics and shortcuts to display. Your selection is shared with the website account.</Text>
          <ScrollView style={styles.editorList}>
            {ADMIN_DASHBOARD_CARDS.map(card => {
              const checked = draftIds.includes(card.id);
              return <TouchableOpacity key={card.id} accessibilityRole="checkbox"
                accessibilityState={{ checked }} style={styles.editorRow}
                onPress={() => setDraftIds(ids => checked ? ids.filter(id => id !== card.id) : [...ids, card.id])}>
                <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={21} color={checked ? Colors.accent : Colors.textMuted} />
                <Text style={styles.quickText}>{card.label}</Text>
              </TouchableOpacity>;
            })}
          </ScrollView>
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          <View style={styles.editorActions}>
            <TouchableOpacity style={styles.editorSecondary} onPress={() => setDraftIds([...DEFAULT_ADMIN_CARD_IDS])} disabled={savingCards}>
              <Text style={styles.quickText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editorSecondary} onPress={() => setCardEditorOpen(false)} disabled={savingCards}>
              <Text style={styles.quickText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editorPrimary} onPress={() => void saveCards()} disabled={savingCards}>
              {savingCards ? <ActivityIndicator color={Colors.onAccent} /> : <Text style={styles.heroActionText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { gap: 15, paddingHorizontal: 16, paddingTop: 24 },
  flex: { flex: 1 },
  hero: { borderRadius: 26, padding: 24, gap: 14, overflow: 'hidden' },
  heroBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroBadge: { color: Colors.onAccent, fontFamily: FontFamily.extraBold, fontSize: FontSize.xs, letterSpacing: 1.4, borderWidth: 1, borderColor: Colors.onAccentMuted, borderRadius: Radius.pill, padding: 9 },
  liveBadge: { color: Colors.onAccent, fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, borderWidth: 1, borderColor: Colors.success, borderRadius: Radius.pill, padding: 9 },
  heroTitle: { color: Colors.onAccent, fontFamily: FontFamily.extraBold, fontSize: FontSize['2xl'], lineHeight: 32 },
  heroDescription: { color: Colors.onAccentMuted, fontFamily: FontFamily.regular, fontSize: FontSize.base, lineHeight: 22 },
  heroActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  refreshButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.onAccentMuted, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12 },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12 },
  heroActionText: { color: Colors.onAccent, fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  telemetryCard: { padding: 20, borderRadius: 21, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionEyebrow: { color: Colors.textMuted, fontFamily: FontFamily.extraBold, fontSize: FontSize.xs, letterSpacing: 1.4 },
  sectionTitle: { fontFamily: FontFamily.extraBold, color: Colors.textPrimary, fontSize: FontSize.xl },
  smallNote: { color: Colors.textMuted, fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 18 },
  metricLabel: { color: Colors.textSecondary, fontFamily: FontFamily.semiBold, fontSize: FontSize.sm },
  metricNumber: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize['2xl'] },
  telemetrySplit: { flexDirection: 'row', gap: 16, paddingVertical: 4 },
  telemetryColumn: { flex: 1, gap: 4 },
  priorityBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 17, backgroundColor: Colors.warningAlpha10, borderRadius: 16, borderWidth: 1, borderColor: Colors.warning },
  priorityTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textPrimary },
  configureButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, padding: 10, minHeight: 44 },
  configureText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontFamily: FontFamily.bold },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%', flexGrow: 1, borderRadius: 21, borderWidth: 1, padding: 16, gap: 10, minHeight: 145 },
  statCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statIcon: { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  cardLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontFamily: FontFamily.extraBold, letterSpacing: 1 },
  cardValue: { color: Colors.textPrimary, fontSize: FontSize.xl, fontFamily: FontFamily.extraBold },
  empty: { width: '100%', padding: 26, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 16 },
  actionsGrid: { gap: 10 },
  quickAction: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, padding: 18, minHeight: 64 },
  quickText: { flex: 1, fontFamily: FontFamily.semiBold, color: Colors.textPrimary, fontSize: FontSize.base },
  moduleGroup: { borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  moduleHeading: { backgroundColor: Colors.infoBlueAlpha10, paddingHorizontal: 18, paddingVertical: 15, gap: 4 },
  moduleTitle: { fontFamily: FontFamily.bold, color: Colors.textPrimary, fontSize: FontSize.lg },
  moduleRow: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 12 },
  websiteTag: { color: Colors.textMuted, fontFamily: FontFamily.bold, fontSize: FontSize.xs, letterSpacing: 0.8 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.blackAlpha75 },
  editor: { maxHeight: '83%', backgroundColor: Colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 9 },
  editorList: { flexGrow: 0, marginTop: 10 },
  editorRow: { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  editorActions: { flexDirection: 'row', gap: 8, paddingTop: 10 },
  editorSecondary: { flex: 1, borderRadius: 11, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', padding: 12 },
  editorPrimary: { flex: 1, borderRadius: 11, backgroundColor: Colors.accent, alignItems: 'center', padding: 12 },
  errorText: { color: Colors.error, fontSize: FontSize.sm },
});
