import React, { useCallback, useState } from 'react';
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
  AppStats, ProblemReport, getAppStats, getProblemReports, setProblemReportStatus,
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

  const tiles = stats ? [
    { label: 'Android downloads', value: n(stats.apkDownloads), sub: 'Signed APK downloads', icon: 'logo-android' },
    { label: 'Android installs', value: n(stats.androidAppInstalls), sub: `${n(stats.androidAppInstalls30d)} in last 30 days`, icon: 'phone-portrait-outline' },
    { label: 'iPhone install guides', value: n(stats.downloadClicks.ios), sub: 'Opened Add to Home Screen', icon: 'logo-apple' },
    { label: 'Windows installs', value: n(stats.webInstalls.windows), sub: 'Installed from the browser', icon: 'desktop-outline' },
    { label: 'Download button taps', value: n(stats.downloadClicksTotal), sub: `${n(stats.downloadClicks30d)} in last 30 days`, icon: 'download-outline' },
    { label: 'Open problem reports', value: n(stats.problemReports.open), sub: `${n(stats.problemReports.total)} total`, icon: 'alert-circle-outline' },
  ] : [];

  const header = (
    <View>
      <Text style={styles.section}>APP DOWNLOADS</Text>
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
      <AdminHeader title="App & problem reports" subtitle="Downloads, installs and customer reports" onBack={() => navigation.goBack()} />
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
