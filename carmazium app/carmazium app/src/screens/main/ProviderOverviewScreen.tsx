import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { getMyCapabilities, getJobFeedPage, getAssignedJobsPage, formatPence, type MyCapabilities, type ServiceJob } from '../../lib/servicesApi';
import { loadAllProviderJobs, loadProviderJobLists, type ProviderJobLists } from '../../lib/tradeXchangeProviderJobLoad';
type Props = NativeStackScreenProps<MainStackParamList, 'ProviderOverview'>;
export function ProviderOverviewScreen(props: Props) {
  const userId = useAuthStore(state => state.user?.id);
  return userId ? <ProviderOverview key={userId} {...props} /> : null;
}
function ProviderOverview({ navigation }: Props) {
  const accountRole = useAuthStore(state => state.accountRole);
  const isDealerStaff = useAuthStore(state => !!state.user?.isDealerStaff);
  const tabBarClearance = useTabBarClearance();
  const { width, fontScale } = useWindowDimensions();
  const iphoneColumns = Platform.OS === 'ios' && (width < 600 || !Platform.isPad);
  const singleMetricColumn = fontScale >= 1.3;
  const [capabilities, setCapabilities] = useState<MyCapabilities | null>(null);
  const [lists, setLists] = useState<ProviderJobLists<ServiceJob> | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    const [caps, jobs] = await Promise.allSettled([
      getMyCapabilities(),
      loadProviderJobLists(() => loadAllProviderJobs(cursor => getJobFeedPage(undefined, cursor, 50)), () => loadAllProviderJobs(cursor => getAssignedJobsPage(cursor, 50))),
    ]);
    if (request !== generation.current) return;
    const next = jobs.status === 'fulfilled' ? jobs.value : null;
    setCapabilities(caps.status === 'fulfilled' ? caps.value : null); setLists(next);
    const errors = [caps.status === 'rejected' ? 'Could not load your service approvals.' : null, next?.availableError, next?.assignedError, !next ? 'Could not load service jobs.' : null].filter(Boolean);
    setError(errors.length ? errors.join(' ') : null); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));
  const assigned = lists?.assigned?.items;
  const active = assigned?.filter(job => !['RELEASED', 'CANCELLED', 'EXPIRED'].includes(job.status));
  const earnings = assigned?.filter(job => job.status === 'RELEASED').reduce((sum, job) => sum + (job.contractorAmountPence ?? 0), 0);
  const recent = [...(assigned ?? [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 4);
  const metrics = [
    [isDealerStaff ? 'Service access' : 'Approved services', isDealerStaff ? 'Business managed' : capabilities ? String(capabilities.capabilities.filter(cap => cap.status === 'APPROVED' && ['DELIVERY', 'INSPECTION'].includes(cap.serviceType)).length) : 'Unavailable'],
    ['Available jobs', lists?.available ? String(lists.available.items.length) : lists?.approvalRequired ? 'Setup needed' : 'Unavailable'],
    ['My active jobs', active ? String(active.length) : 'Unavailable'],
    ['Released earnings', earnings !== undefined ? formatPence(earnings) : 'Unavailable'],
  ];
  const openJobs = (initialTab: 'open' | 'assigned' = 'open') => navigation.navigate('ProviderJobs', { initialTab });
  return <View style={s.screen}><WebsiteTopBar /><ScrollView contentContainerStyle={[s.content, iphoneColumns && s.iosContent, { paddingBottom: tabBarClearance + (iphoneColumns ? 16 : 0) }]}>
    <Text style={s.eyebrow}>TradeXchange Services</Text><Text accessibilityRole="header" style={[s.title, iphoneColumns && s.iosTitle]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>Service Provider Dashboard</Text>
    <Text style={[s.body, iphoneColumns && s.iosBody]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>Delivery and Inspection jobs, approvals and earnings in one place. Contact our team about finance and warranty partnerships.</Text>
    <View style={[s.actions, iphoneColumns && s.iosActions]}>{accountRole === 'dealer' && <Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label="Dealer dashboard" variant="outline" onPress={() => navigation.navigate('Tabs', { screen: 'DealerHome' })} />}<Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label="Find jobs" onPress={() => openJobs()} /><Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label="My work" variant="outline" onPress={() => openJobs('assigned')} /><Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label="Service setup" variant="outline" onPress={() => navigation.navigate('PartnerDashboard')} /><Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label="Job messages" variant="outline" onPress={() => navigation.navigate('ProviderMessages')} /></View>
    <Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label={loading ? 'Refreshing…' : 'Refresh dashboard'} variant="outline" disabled={loading} onPress={() => void load()} />
    {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {isDealerStaff && <View style={[s.card, iphoneColumns && s.iosCard]}><Text style={[s.heading, iphoneColumns && s.iosHeading]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>Your business manages service access</Text><Text style={[s.body, iphoneColumns && s.iosBody]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>Your dealership owner manages service approvals, insurance, payouts and your job permissions. Find jobs and My work show the work available to your business role.</Text></View>}
    {!isDealerStaff && !loading && capabilities && (!capabilities.capabilities.some(cap => cap.status === 'APPROVED' && ['DELIVERY', 'INSPECTION'].includes(cap.serviceType)) || lists?.approvalRequired) && <View style={[s.card, iphoneColumns && s.iosCard]}><Text style={[s.heading, iphoneColumns && s.iosHeading]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>Get ready to quote on jobs</Text><Text style={[s.body, iphoneColumns && s.iosBody]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>Open Service Setup to check applications, insurance, verification and payouts. You can still open any work already assigned to your business.</Text><Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label="Open service setup" variant="outline" onPress={() => navigation.navigate('PartnerDashboard')} /></View>}
    {iphoneColumns ? <View style={s.iosMetrics} testID="ios-provider-metrics">{[metrics.slice(0, 2), metrics.slice(2)].map((row, index) => <View key={index} style={s.iosMetricRow}>{row.map(([label, value]) => <View key={label} style={[s.metric, s.iosMetric]}><Text style={s.iosMetricLabel} maxFontSizeMultiplier={1.3}>{label}</Text><Text style={[s.value, s.iosMetricValue]} maxFontSizeMultiplier={1.3}>{loading ? '…' : value}</Text></View>)}</View>)}</View> : <View style={s.metrics}>{metrics.map(([label, value]) => <View key={label} style={[s.metric, { width: singleMetricColumn ? '100%' : '48%' }]}><Text style={[s.body, iphoneColumns && s.iosBody]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>{label}</Text><Text style={s.value}>{loading ? '…' : value}</Text></View>)}</View>}
    <View style={[s.card, iphoneColumns && s.iosCard]}><Text style={[s.heading, iphoneColumns && s.iosHeading]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>Delivery &amp; Inspection jobs</Text><Text style={[s.body, iphoneColumns && s.iosBody]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>See open jobs in your approved service areas, submit quotes and manage jobs you win.</Text><Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label="Available Jobs" variant="outline" onPress={() => openJobs()} /></View>
    <View style={[s.card, iphoneColumns && s.iosCard]}><Text style={[s.heading, iphoneColumns && s.iosHeading]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>My work</Text><Text style={[s.body, iphoneColumns && s.iosBody]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>Continue jobs assigned to your business and review completed work. Existing jobs remain accessible when approval for new work needs renewal.</Text><Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label="My Work" variant="outline" onPress={() => openJobs('assigned')} /></View>
    <View style={[s.card, iphoneColumns && s.iosCard]}><Text style={[s.heading, iphoneColumns && s.iosHeading]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>My recent assigned jobs</Text><Text style={[s.body, iphoneColumns && s.iosBody]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>Delivery and Inspection jobs assigned to your business.</Text><Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label="View all" variant="outline" onPress={() => openJobs('assigned')} />
      {loading ? <ActivityIndicator color={Colors.accent} /> : !assigned ? <Text style={[s.body, iphoneColumns && s.iosBody]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>Assigned jobs are unavailable. Refresh the dashboard to try again.</Text> : recent.length === 0 ? <><Text style={[s.body, iphoneColumns && s.iosBody]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>No assigned jobs yet. Approved Delivery or Inspection providers can quote on open jobs.</Text><Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label="Browse open jobs" variant="outline" onPress={() => openJobs()} /></> : recent.map(job => <View key={job.id} style={[s.card, iphoneColumns && s.iosCard]}><Text style={[s.heading, iphoneColumns && s.iosHeading]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>{job.title}</Text><Text style={[s.body, iphoneColumns && s.iosBody]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>{job.serviceType === 'DELIVERY' ? `${job.pickupPostcode} → ${job.deliveryPostcode}` : job.servicePostcode}</Text>{job.contractorAmountPence != null && <Text style={[s.body, iphoneColumns && s.iosBody]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>{formatPence(job.contractorAmountPence)} to you</Text>}<Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label="View job" variant="outline" onPress={() => navigation.navigate('ProviderJobDetail', { jobId: job.id })} /></View>)}
    </View>
    <View style={[s.card, iphoneColumns && s.iosCard]}><Text style={[s.heading, iphoneColumns && s.iosHeading]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>What you need before taking jobs</Text><Text style={[s.body, iphoneColumns && s.iosBody]} maxFontSizeMultiplier={iphoneColumns ? 1.3 : undefined}>Complete business verification, verified payouts and the declaration. Collection, delivery and recovery require Motor Trade and Public Liability Insurance. Inspections require Public Liability Insurance only. Your original £1 dealer verification is reused; no further £1 service verification is required. CarMazium retains 9% of the agreed job price and your business receives 91% after release. Finance, warranty and insurance providers should contact CarMazium directly about partnerships.</Text><Button size={iphoneColumns ? 'sm' : 'default'} style={iphoneColumns ? s.iosButton : undefined} textStyle={iphoneColumns ? s.iosButtonText : undefined} label="Complete service setup" variant="outline" onPress={() => navigation.navigate('PartnerDashboard')} /></View>
  </ScrollView></View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary }, content: { padding: 20, gap: 20, paddingBottom: 32 },
  title: { fontSize: 30, fontFamily: FontFamily.bold, color: Colors.textPrimary }, eyebrow: { color: Colors.accent, fontSize: 12, fontFamily: FontFamily.bold },
  heading: { color: Colors.textPrimary, fontSize: 20, fontFamily: FontFamily.bold }, body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { padding: 18, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  value: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.textPrimary }, card: { padding: 20, gap: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  iosCard: { padding: 14, gap: 9 },
  iosContent: { padding: 16, gap: 12 },
  iosTitle: { fontSize: 24, lineHeight: 30 },
  iosHeading: { fontSize: 16, lineHeight: 22 },
  iosBody: { fontSize: 13, lineHeight: 19 },
  iosActions: { gap: 8 },
  iosButton: { paddingHorizontal: 10, paddingVertical: 8, minHeight: 44, flexShrink: 1 },
  iosButtonText: { fontSize: 12 },
  iosMetrics: { gap: 12 },
  iosMetricRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 12, alignItems: 'stretch' },
  iosMetric: { flex: 1, minWidth: 0, padding: 12, gap: 6 },
  iosMetricLabel: { fontSize: 11, lineHeight: 16, color: Colors.textSecondary, fontFamily: FontFamily.bold },
  iosMetricValue: { fontSize: 20, lineHeight: 26 },
  error: { color: Colors.error, fontSize: 14, lineHeight: 22 },
});
