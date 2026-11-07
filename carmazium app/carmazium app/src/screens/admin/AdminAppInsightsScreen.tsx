import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Colors } from '../../constants/colors';
import { Elevation, Radius } from '../../constants/spacing';
import { FontFamily, FontSize } from '../../constants/typography';
import {
  AppStats, OnlineNow, ProblemReport, getAppStats, getOnlineNow, getProblemReports, setProblemReportStatus,
} from '../../lib/appInsights';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import { AdminHeader, fmtDateTime } from './adminShared';

type Props = NativeStackScreenProps<MainStackParamList, 'AdminAppInsights'>;

const CATEGORY_LABEL: Record<string, string> = {
  not_working: 'Something isn’t working', sign_in: 'Signing in / account', payments: 'Payments',
  listings: 'Listings / selling', auctions: 'Auctions / bids', messages: 'Messages / notifications', other: 'Other',
};

const n = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('en-GB'));

/** Admin › App downloads & problem reports (website: /dashboard/admin/app). */
export const AdminAppInsightsScreen: React.FC<Props> = ({ navigation }) => {
  const [stats, setStats] = useState<AppStats | null>(null);
  const [reports, setReports] = useState<ProblemReport[]>([]);
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [online, setOnline] = useState<OnlineNow | null>(null);

  // Online now refreshes every 30 seconds while this screen is open.
  useEffect(() => {
    let alive = true;
    const refresh = () => { getOnlineNow().then(o => { if (alive) setOnline(o); }).catch(() => {}); };
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const load = useCallback(async (which = filter) => {
    setError(null);
    try {
      const [s, r] = await Promise.all([getAppStats(), getProblemReports(which)]);
      setStats(s);
      setReports(r.reports);
    } catch (err: any) {
      setError(err?.message || 'Could not load app statistics.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const toggle = async (r: ProblemReport) => {
    setBusyId(r.id);
    try {
      await setProblemReportStatus(r.id, r.payload.status === 'resolved' ? 'new' : 'resolved');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not update the report.');
    } finally {
      setBusyId(null);
    }
  };

  // One number per platform, all time — these only ever go up.
  // Downloads are not verified installations. Keep event types separate.
  const tiles = stats ? [
    { label: 'Android native first opens', value: n(stats.installs.androidApp), sub: 'Reported first-open IDs', icon: 'logo-android' },
    { label: 'APK downloads', value: n(stats.apkDownloads), sub: 'Downloads, not confirmed installs', icon: 'download-outline' },
    { label: 'Android web-app opens', value: n(stats.installs.androidWebApp), sub: 'Standalone website launches', icon: 'logo-android' },
    { label: 'iPhone web-app opens', value: n(stats.installs.iosWebApp), sub: 'Home Screen website launches', icon: 'logo-apple' },
    { label: 'iPhone native first opens', value: n(stats.installs.iosApp), sub: 'Reported first-open IDs', icon: 'logo-apple' },
    { label: 'Windows web-app opens', value: n(stats.installs.windows), sub: 'Standalone website launches', icon: 'desktop-outline' },
    { label: 'Open problem reports', value: n(stats.problemReports.open), sub: `${n(stats.problemReports.total)} in total`, icon: 'alert-circle-outline' },
  ] : [];

  const header = (
    <View>
      <Text style={styles.section}>ONLINE NOW</Text>
      <View style={styles.onlineCard}>
        <View style={styles.onlineCol}>
          <Text style={styles.onlineValue}>{n(online?.web.total)}</Text>
          <Text style={styles.tileLabel}>On the website</Text>
          <Text style={styles.tileSub}>{online ? `${online.web.desktop} desktop · ${online.web.mobile} mobile · ${online.web.installed} installed` : '—'}</Text>
        </View>
        <View style={styles.onlineDivider} />
        <View style={styles.onlineCol}>
          <Text style={styles.onlineValue}>{n(online?.app.total)}</Text>
          <Text style={styles.tileLabel}>In the app</Text>
          <Text style={styles.tileSub}>{online ? `${online.app.android} Android · ${online.app.ios} iPhone` : '—'}</Text>
        </View>
      </View>
      <Text style={styles.onlineNote}>
        {online ? `${n(online.total)} recent visitor signals · ${n(online.web.signedIn + online.app.signedIn)} verified signed-in (per platform) · 2-minute window` : 'Loading…'}
      </Text>

      <Text style={styles.section}>INSTALLS (ALL TIME)</Text>
      <View style={styles.grid}>
        {tiles.map(t => (
          <View key={t.label} style={styles.tile}>
            <Ionicons name={t.icon} size={18} color={Colors.accent} />
            <Text style={styles.tileValue}>{t.value}</Text>
            <Text style={styles.tileLabel}>{t.label}</Text>
            <Text style={styles.tileSub}>{t.sub}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.section}>PROBLEM REPORTS</Text>
      <View style={styles.filters}>
        {(['open', 'resolved'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filter, filter === f && styles.filterOn]}
            onPress={() => { setFilter(f); setLoading(true); void load(f); }}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextOn]}>{f === 'open' ? 'Open' : 'Resolved'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
    </View>
  );

  const renderItem = ({ item }: { item: ProblemReport }) => {
    const p = item.payload;
    const who = item.user
      ? `${[item.user.firstName, item.user.lastName].filter(Boolean).join(' ') || item.user.email} (${item.user.role ?? 'user'})`
      : 'Guest';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.category}>{CATEGORY_LABEL[p.category] ?? p.category}</Text>
          <Text style={styles.date}>{fmtDateTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.message}>{p.message}</Text>
        <Text style={styles.meta}>{who}{p.contactEmail ? ` · ${p.contactEmail}` : ''}</Text>
        <Text style={styles.meta}>{[p.platform, p.appVersion && `v${p.appVersion}`, p.device, p.screen].filter(Boolean).join(' · ')}</Text>
        <Button
          label={p.status === 'resolved' ? 'Reopen' : 'Mark resolved'}
          size="sm"
          variant={p.status === 'resolved' ? 'outline' : 'primary'}
          onPress={() => void toggle(item)}
          loading={busyId === item.id}
          disabled={busyId === item.id}
          style={{ marginTop: 10, alignSelf: 'flex-start' }}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AdminHeader title="App & problem reports" subtitle="Recent activity, downloads and customer reports" onBack={() => navigation.goBack()} />
      <FlatList
        data={reports}
        keyExtractor={r => r.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={Colors.accent} />}
        ListEmptyComponent={loading ? null : (
          <EmptyState icon="checkmark-done-outline" title={filter === 'open' ? 'No open problem reports' : 'No resolved reports yet'} subtitle="Customer reports from the app and website appear here." />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  list: { paddingHorizontal: 16, paddingBottom: 48, gap: 12 },
  onlineCard: {
    flexDirection: 'row', padding: 16, borderRadius: Radius.card, backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border, ...Elevation.card,
  },
  onlineCol: { flex: 1 },
  onlineDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 14 },
  onlineValue: { fontFamily: FontFamily.mono, fontSize: FontSize['3xl'], color: Colors.success },
  onlineNote: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 8 },
  section: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, letterSpacing: 1.4, color: Colors.textMuted, marginTop: 12, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%', flexGrow: 1, padding: 14, borderRadius: Radius.card, backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border, ...Elevation.card,
  },
  tileValue: { fontFamily: FontFamily.mono, fontSize: FontSize['2xl'], color: Colors.textPrimary, marginTop: 6 },
  tileLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: 2 },
  tileSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  filter: { paddingHorizontal: 16, minHeight: 38, justifyContent: 'center', borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border },
  filterOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textSecondary },
  filterTextOn: { color: Colors.onAccent },
  card: { padding: 14, borderRadius: Radius.card, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, ...Elevation.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  category: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textPrimary },
  date: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted },
  message: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 21, marginTop: 8 },
  meta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 6 },
});
