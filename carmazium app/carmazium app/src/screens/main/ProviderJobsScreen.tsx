import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Elevation, Radius } from '../../constants/spacing';
import {
  SERVICE_LABELS,
  ServiceJob,
  ServiceType,
  formatPence,
  getAssignedJobsPage,
  getJobFeedPage,
} from '../../lib/servicesApi';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { loadProviderJobLists, type ProviderJobLists } from '../../lib/tradeXchangeProviderJobLoad';
import { Button } from '../../components/Button';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderJobs'>;
type Tab = 'open' | 'assigned';
type Filter = 'ALL' | 'DELIVERY' | 'INSPECTION';

const FILTERS: Filter[] = ['ALL', 'DELIVERY', 'INSPECTION'];

const statusLabel = (status: ServiceJob['status']) => ({ OPEN: 'Open for quotes', ACCEPTED: 'Awaiting payment', PAID: 'Paid — ready', IN_PROGRESS: 'In progress', COMPLETED: 'Awaiting confirmation', RELEASED: 'Complete', CANCELLED: 'Cancelled', EXPIRED: 'Expired', DISPUTED: 'Disputed' }[status] ?? status);

const routeText = (job: ServiceJob) => {
  if (job.serviceType === 'INSPECTION') {
    return job.servicePostcode || 'Inspection location';
  }
  const from = job.pickupPostcode || 'Pickup';
  const to = job.deliveryPostcode || 'Delivery';
  return `${from} → ${to}`;
};

const timingText = (job: ServiceJob) => {
  if (job.requestedFor) {
    return new Date(job.requestedFor).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }
  return 'ASAP / flexible';
};

export const ProviderJobsScreen: React.FC<Props> = ({ navigation, route }) => {
  const [tab, setTab] = useState<Tab>(route?.params?.initialTab ?? 'open');
  const [filter, setFilter] = useState<Filter>('ALL');
  useEffect(() => { if (route?.params?.initialTab) setTab(route.params.initialTab); }, [route?.params?.initialTab]);
  const [lists, setLists] = useState<ProviderJobLists<ServiceJob> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0), morePending = useRef(false);
  const selected = tab === 'open' ? lists?.available : lists?.assigned;
  const jobs = useMemo(() => (selected?.items ?? []).filter(job => filter === 'ALL' || job.serviceType === filter), [selected, filter]);
  const nextCursor = selected?.nextCursor;
  const error = tab === 'open' ? lists?.availableError : lists?.assignedError;
  const notApproved = tab === 'open' && lists?.approvalRequired;
  const load = useCallback(async () => {
    const request = ++generation.current;
    morePending.current = false; setLoadingMore(false); setLoading(true); setLists(null);
    const result = await loadProviderJobLists(() => getJobFeedPage(), () => getAssignedJobsPage());
    if (request !== generation.current) return;
    setLists(result); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));
  const refresh = () => { void load(); };
  const loadMore = async () => {
    if (!nextCursor || morePending.current || loading) return;
    const request = generation.current, target = tab;
    morePending.current = true; setLoadingMore(true);
    try {
      const page = target === 'open' ? await getJobFeedPage(undefined, nextCursor) : await getAssignedJobsPage(nextCursor);
      if (request !== generation.current) return;
      setLists(previous => {
        if (!previous) return previous;
        const key = target === 'open' ? 'available' : 'assigned';
        return { ...previous, [key]: { items: [...new Map([...(previous[key]?.items ?? []), ...page.items].map(job => [job.id, job])).values()], nextCursor: page.nextCursor }, [target === 'open' ? 'availableError' : 'assignedError']: null };
      });
    } catch (err: any) {
      if (request === generation.current) setLists(previous => previous && ({ ...previous, [target === 'open' ? 'availableError' : 'assignedError']: err?.message || 'Could not load more jobs.' }));
    } finally { if (request === generation.current) { morePending.current = false; setLoadingMore(false); } }
  };

  const renderJob = ({ item: job }: { item: ServiceJob }) => {
    const myQuote = job.quotes?.[0];
    const assigned = tab === 'assigned';
    const trailing = assigned && job.contractorAmountPence != null
      ? `${formatPence(job.contractorAmountPence)} payout`
      : myQuote?.status === 'ACTIVE'
        ? `Your quote ${formatPence(myQuote.amountPence)}`
        : `${job._count?.quotes ?? 0} quote${(job._count?.quotes ?? 0) === 1 ? '' : 's'}`;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('ProviderJobDetail', { jobId: job.id })}
      >
        <View style={styles.cardTop}>
          <View style={styles.typeRow}>
            <View style={styles.iconBox}>
              <Ionicons
                name={job.serviceType === 'INSPECTION' ? 'search-outline' : 'car-outline'}
                size={19}
                color={job.serviceType === 'INSPECTION' ? Colors.warning : Colors.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeText}>
                {job.serviceType === 'DELIVERY' && job.isRecovery
                  ? 'Recovery'
                  : SERVICE_LABELS[job.serviceType]}
              </Text>
              <Text style={styles.title} numberOfLines={2}>{job.title}</Text>
            </View>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{statusLabel(job.status)}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.metaText}>{routeText(job)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.metaText}>{timingText(job)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="car-sport-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.metaText}>
            {job.vehicles?.length || 0} vehicle{(job.vehicles?.length || 0) === 1 ? '' : 's'}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={[
            styles.trailing,
            myQuote?.status === 'ACTIVE' && { color: Colors.accentGreen },
          ]}>
            {trailing}
          </Text>
          <View style={styles.openRow}>
            <Text style={styles.openText}>OPEN JOB</Text>
            <Ionicons name="chevron-forward" size={15} color={Colors.accent} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Tabs, filters and the coverage link scroll with the list (header) so a
  // larger system font size can't leave the list too little height.
  const listHeader = (
    <View>
      <Text style={styles.headerSub}>TradeXchange Provider Marketplace</Text>
      <Text accessibilityRole="header" style={styles.pageTitle}>{tab === 'assigned' ? 'My Work' : 'Available Jobs'}</Text>
      <Text style={styles.pageDescription}>These are customer-posted Delivery, Recovery and Inspection jobs your approved Partner business can compete for. Send a quote on suitable work; jobs you win stay under My Work.</Text>
      <View style={styles.pageActions}>
        <Button label="Refresh jobs" variant="outline" disabled={loading} onPress={refresh} />
        <Button label="Provider overview" variant="outline" onPress={() => navigation.navigate('ProviderOverview')} />
        <Button label="Job messages" variant="outline" onPress={() => navigation.navigate('ProviderMessages')} />
      </View>
      <View style={styles.postJobCard}><Text style={styles.pageDescription}>Looking for the customer side instead? Any signed-in CarMazium user can post a job and approved providers will see matching work in this marketplace.</Text><Button label="Post a job" variant="outline" onPress={() => Alert.alert('Post a job', 'Choose the service you need.', [{ text: 'Delivery & Recovery', onPress: () => navigation.navigate('CreateServiceJob', { serviceType: 'DELIVERY' }) }, { text: 'Vehicle Inspection', onPress: () => navigation.navigate('CreateServiceJob', { serviceType: 'INSPECTION' }) }, { text: 'Cancel', style: 'cancel' }])} /></View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'open' && styles.tabActive]}
          onPress={() => setTab('open')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'open' }}
          accessibilityLabel="Available service jobs"
        >
          <Text style={[styles.tabText, tab === 'open' && styles.tabTextActive]}>{`Available${lists?.available ? ` (${lists.available.items.length}${lists.available.nextCursor ? '+' : ''})` : ''}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'assigned' && styles.tabActive]}
          onPress={() => setTab('assigned')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'assigned' }}
          accessibilityLabel="My assigned service work"
        >
          <Text style={[styles.tabText, tab === 'assigned' && styles.tabTextActive]}>{`My Work${lists?.assigned ? ` (${lists.assigned.items.length}${lists.assigned.nextCursor ? '+' : ''})` : ''}`}</Text>
        </TouchableOpacity>
      </View>

      {!!error && jobs.length > 0 && <View style={styles.postJobCard}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><Button label="Retry loading more" variant="outline" onPress={() => void loadMore()} /></View>}
      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.filter, filter === item && styles.filterActive]}
            onPress={() => setFilter(item)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item }}
          >
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {item === 'ALL' ? 'All' : item === 'DELIVERY' ? 'Delivery' : 'Inspection'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.manageCoverage}
        onPress={() => navigation.navigate('PartnerDashboard')}
        accessibilityRole="button"
        accessibilityLabel="Manage approved services and job-matching coverage"
        activeOpacity={0.8}
      >
        <Ionicons name="options-outline" size={17} color={Colors.accent} />
        <Text style={styles.manageCoverageText}>Manage service areas & verification</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
      </TouchableOpacity>
    </View>
  );
  // Loading / approval / load-error states render inside the list.
  const listStatus = loading && jobs.length === 0 ? (
    <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>
  ) : notApproved ? (
    <View style={styles.centerCard}>
      <Ionicons name="shield-outline" size={34} color={Colors.warning} />
      <Text style={styles.emptyTitle}>Verification required for new jobs</Text>
      <Text style={styles.emptyText}>
        Complete business verification, verified payouts and the declaration. Delivery, collection and recovery require Motor Trade and Public Liability Insurance; inspection requires Public Liability Insurance only. Your original £1 dealer verification is reused. Previously accepted jobs remain under My Work.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('PartnerDashboard')}
      >
        <Text style={styles.primaryText}>MANAGE SERVICES</Text>
      </TouchableOpacity>
    </View>
  ) : error && jobs.length === 0 ? (
    <View style={styles.centerCard}>
      <Ionicons name="alert-circle-outline" size={32} color={Colors.accent} />
      <Text style={styles.emptyTitle}>Could not load jobs</Text>
      <Text style={styles.emptyText}>{error}</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => void load()}>
        <Text style={styles.primaryText}>TRY AGAIN</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />

      <WebsiteTopBar />

        <FlatList
          data={listStatus ? [] : jobs}
          ListHeaderComponent={listHeader}
          ListHeaderComponentStyle={styles.listHeaderBleed}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={jobs.length && !listStatus ? styles.list : styles.emptyList}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={listStatus ?? (
            <View style={styles.centerCard}>
              <Ionicons name="briefcase-outline" size={34} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {tab === 'open' ? 'No matching jobs right now' : 'No won jobs yet'}
              </Text>
              <Text style={styles.emptyText}>
                {tab === 'open'
                  ? 'Refresh to check for jobs matching your approved services. Eligible providers also receive account and email notifications for new matching jobs.'
                  : 'Quote on Available Jobs to start building your completed work history.'}
              </Text>
            </View>
          )}
          onEndReached={() => {
            if (nextCursor && !loadingMore) void loadMore();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={Colors.accent} style={{ marginVertical: 18 }} /> : null
          }
        />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  pageTitle: { fontSize: 30, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginVertical: 12 },
  pageDescription: { fontSize: 14, lineHeight: 22, color: Colors.textSecondary },
  pageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 16 },
  postJobCard: { padding: 16, gap: 12, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, marginBottom: 16 },
  errorText: { fontSize: 14, color: Colors.error },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 2,
    ...Elevation.card,
  },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.textMuted, marginTop: 2 },
  tabs: { flexDirection: 'row', marginHorizontal: 0, marginTop: 4, borderRadius: Radius.inline, padding: 4, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: Colors.accent, borderBottomWidth: 3, borderBottomColor: Colors.accentDark, ...Elevation.neon },
  tabText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textMuted, letterSpacing: 0.7 },
  tabTextActive: { color: Colors.onAccent },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 0, paddingVertical: 12 },
  manageCoverage: { marginHorizontal: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 6, borderRadius: Radius.inline, backgroundColor: Colors.bgCardSolid, borderWidth: 1, borderColor: Colors.borderSubtle },
  manageCoverageText: { flex: 1, color: Colors.accent, fontFamily: FontFamily.bold, fontSize: FontSize.xs },
  filter: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: Colors.borderHi, backgroundColor: Colors.bgCardSolid },
  filterActive: { borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10 },
  filterText: { fontFamily: FontFamily.medium, fontSize: FontSize.size10, color: Colors.textMuted },
  filterTextActive: { color: Colors.accent },
  list: { padding: 20, gap: 12, paddingBottom: 36 },
  emptyList: { flexGrow: 1, padding: 20 },
  // Header and cards share one mobile gutter.
  listHeaderBleed: { marginBottom: 12 },
  card: { borderRadius: Radius.card, borderWidth: 1, padding: 16, gap: 12, backgroundColor: Colors.bgCard, borderColor: Colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  typeRow: { flex: 1, flexDirection: 'row', gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  typeText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.textPrimary, marginTop: 3 },
  statusPill: { borderRadius: 999, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha08, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.whiteAlpha08, paddingTop: 11, marginTop: 2 },
  trailing: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accent },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  openText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.accent, letterSpacing: 0.6 },
  center: { flexGrow: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  centerCard: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textPrimary, textAlign: 'center' },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textMuted, textAlign: 'center', lineHeight: 19, maxWidth: 340 },
  primaryButton: { marginTop: 5, minHeight: 44, borderRadius: Radius.inline, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderBottomWidth: 3, borderBottomColor: Colors.accentDark, ...Elevation.neon },
  primaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.onAccent, letterSpacing: 0.7 },
});
