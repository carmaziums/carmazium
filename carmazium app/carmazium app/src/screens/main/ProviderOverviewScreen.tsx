import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { getMyCapabilities, getJobFeedPage, getAssignedJobsPage, formatPence, type MyCapabilities, type ServiceJob } from '../../lib/servicesApi';
import { loadAllProviderJobs, loadProviderJobLists, type ProviderJobLists } from '../../lib/tradeXchangeProviderJobLoad';
type Props = NativeStackScreenProps<MainStackParamList, 'ProviderOverview'>;
export function ProviderOverviewScreen({ navigation }: Props) {
  const { fontScale } = useWindowDimensions();
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
    ['Approved services', capabilities ? String(capabilities.capabilities.filter(cap => cap.status === 'APPROVED' && ['DELIVERY', 'INSPECTION'].includes(cap.serviceType)).length) : 'Unavailable'],
    ['Available jobs', lists?.available ? String(lists.available.items.length) : lists?.approvalRequired ? 'Setup needed' : 'Unavailable'],
    ['My active jobs', active ? String(active.length) : 'Unavailable'],
    ['Released earnings', earnings !== undefined ? formatPence(earnings) : 'Unavailable'],
  ];
  const openJobs = (initialTab: 'open' | 'assigned' = 'open') => navigation.navigate('ProviderJobs', { initialTab });
  return <View style={s.screen}><WebsiteTopBar /><ScrollView contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>TradeXchange Services</Text><Text accessibilityRole="header" style={s.title}>Provider overview</Text>
    <Text style={s.body}>Delivery and Inspection jobs, approvals and earnings in one place. Contact our team about finance and warranty partnerships.</Text>
    <View style={s.actions}><Button label="My services" variant="outline" onPress={() => navigation.navigate('PartnerDashboard')} /><Button label="Find jobs" onPress={() => openJobs()} /></View>
    <Button label={loading ? 'Refreshing…' : 'Refresh dashboard'} variant="outline" disabled={loading} onPress={() => void load()} />
    {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <View style={s.metrics}>{metrics.map(([label, value]) => <View key={label} style={[s.metric, { width: fontScale >= 1.3 ? '100%' : '48%' }]}><Text style={s.body}>{label}</Text><Text style={s.value}>{loading ? '…' : value}</Text></View>)}</View>
    <View style={s.card}><Text style={s.heading}>Delivery &amp; Inspection jobs</Text><Text style={s.body}>See open jobs in your approved service areas, submit quotes and manage jobs you win.</Text><Button label="Available Jobs" variant="outline" onPress={() => openJobs()} /></View>
    <View style={s.card}><Text style={s.heading}>My work</Text><Text style={s.body}>Continue jobs assigned to your business and review completed work. Existing jobs remain accessible when approval for new work needs renewal.</Text><Button label="My Work" variant="outline" onPress={() => openJobs('assigned')} /></View>
    <View style={s.card}><Text style={s.heading}>My recent assigned jobs</Text><Text style={s.body}>Delivery and Inspection jobs assigned to your business.</Text><Button label="View all" variant="outline" onPress={() => openJobs('assigned')} />
      {loading ? <ActivityIndicator color={Colors.accent} /> : !assigned ? <Text style={s.body}>Assigned jobs are unavailable. Refresh the dashboard to try again.</Text> : recent.length === 0 ? <><Text style={s.body}>No assigned jobs yet. Approved Delivery or Inspection providers can quote on open jobs.</Text><Button label="Browse open jobs" variant="outline" onPress={() => openJobs()} /></> : recent.map(job => <View key={job.id} style={s.card}><Text style={s.heading}>{job.title}</Text><Text style={s.body}>{job.serviceType === 'DELIVERY' ? `${job.pickupPostcode} → ${job.deliveryPostcode}` : job.servicePostcode}</Text>{job.contractorAmountPence != null && <Text style={s.body}>{formatPence(job.contractorAmountPence)} to you</Text>}<Button label="View job" variant="outline" onPress={() => navigation.navigate('ProviderJobDetail', { jobId: job.id })} /></View>)}
    </View>
    <View style={s.card}><Text style={s.heading}>What you need before taking jobs</Text><Text style={s.body}>Complete business verification, verified payouts and the declaration. Collection, delivery and recovery require trade insurance. Inspections need no inspection documents. Your original £1 dealer verification is reused; no further £1 service verification is required. CarMazium retains 9% of the agreed job price and your business receives 91% after release. Finance, warranty and insurance providers should contact CarMazium directly about partnerships.</Text><Button label="Complete service setup" variant="outline" onPress={() => navigation.navigate('PartnerDashboard')} /></View>
  </ScrollView></View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary }, content: { padding: 20, gap: 20, paddingBottom: 32 },
  title: { fontSize: 30, fontFamily: FontFamily.bold, color: Colors.textPrimary }, eyebrow: { color: Colors.accent, fontSize: 12, fontFamily: FontFamily.bold },
  heading: { color: Colors.textPrimary, fontSize: 20, fontFamily: FontFamily.bold }, body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { padding: 18, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  value: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.textPrimary }, card: { padding: 20, gap: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  error: { color: Colors.error, fontSize: 14, lineHeight: 22 },
});
