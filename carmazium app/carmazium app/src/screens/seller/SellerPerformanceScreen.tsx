import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

interface Performance {
  totalListings: number;
  conversionRate: number;
  avgResponseHours: number | null;
  sellerRating: number | null;
  totalReviews: number;
  recentListingViews: { id: string; title: string; views: number }[];
}
export const SellerPerformanceScreen = () => {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const [data, setData] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      const res = await apiClient<{ data: Performance }>('/listings/performance?scope=personal');
      if (!res.data || !Number.isFinite(res.data.totalListings) || !Number.isFinite(res.data.conversionRate) || !Array.isArray(res.data.recentListingViews)) throw Error('Invalid performance response');
      if (request === generation.current) setData(res.data);
    } catch {
      if (request === generation.current) { setData(null); setError('Your listing performance could not be loaded. Please retry.'); }
    } finally { if (request === generation.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));
  const columns = fontScale >= 1.3 || width < 768 ? 1 : width >= 1024 ? 4 : 2;
  const metrics = data ? [
    { label: 'Conversion Rate', value: `${data.conversionRate}%`, color: Colors.warning },
    { label: 'Total Listings', value: String(data.totalListings), color: Colors.accent },
    { label: 'Avg Response Time', value: data.avgResponseHours == null ? '—' : data.avgResponseHours < 1 ? `${Math.round(data.avgResponseHours * 60)}m` : `${data.avgResponseHours}h`, color: Colors.infoBlue },
    { label: `Seller Rating${data.totalReviews ? ` (${data.totalReviews})` : ''}`, value: data.sellerRating != null ? `${data.sellerRating}/5` : data.totalReviews === 0 ? 'No reviews' : '—', color: Colors.success },
  ] : [];
  const maxViews = Math.max(1, ...(data?.recentListingViews.map(row => row.views) ?? []));
  return <View style={s.screen}><WebsiteTopBar /><ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} colors={[Colors.accent]} />}>
    <View style={{ gap: 8 }}><Text accessibilityRole="header" style={s.title}>Listing Performance</Text><Text style={s.body}>How many people are viewing and making offers on your cars.</Text></View>
    {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : loading && !data ? <ActivityIndicator color={Colors.accent} /> : data ? <>
      <View style={s.grid}>{metrics.map(metric => <View key={metric.label} style={[s.metric, { width: (width - 40 - (columns - 1) * 16) / columns }]}><Text style={[s.label, { color: metric.color }]}>{metric.label}</Text><Text style={s.value}>{metric.value}</Text></View>)}</View>
      <View style={s.panel}><Text accessibilityRole="header" style={s.section}>Recent Vehicle Views</Text>{data.recentListingViews.length ? data.recentListingViews.map(row => <View key={row.id} style={{ gap: 8 }}><View style={s.row}><Text style={[s.body, { flex: 1 }]}>{row.title}</Text><Text style={s.label}>{row.views} VIEWS</Text></View><View style={s.track}><View style={[s.bar, { width: `${Math.min(100, Math.max(0, row.views / maxViews * 100))}%` }]} /></View></View>) : <Text style={s.body}>No listing data available.</Text>}</View>
    </> : null}
  </ScrollView></View>;
};
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary }, content: { padding: 20, gap: 32 },
  title: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.textPrimary, textTransform: 'uppercase' },
  body: { fontSize: 14, lineHeight: 22, color: Colors.textMuted }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  metric: { borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 20, gap: 12, backgroundColor: Colors.bgCard },
  label: { fontSize: 12, fontFamily: FontFamily.bold, color: Colors.textPrimary, textTransform: 'uppercase' }, value: { fontSize: 28, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  panel: { padding: 24, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, backgroundColor: Colors.bgCard, gap: 24 },
  section: { fontSize: 18, fontFamily: FontFamily.bold, color: Colors.textPrimary, textTransform: 'uppercase' }, row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  track: { height: 8, borderRadius: 8, backgroundColor: Colors.bgTertiary, overflow: 'hidden' }, bar: { height: 8, backgroundColor: Colors.accent },
});
