import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import {
  SERVICE_LABELS,
  ServiceJob,
  ServiceType,
  formatPence,
  getAssignedJobsPage,
  getJobFeedPage,
} from '../../lib/servicesApi';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
import { subscribeProductSync } from '../../lib/productSync';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderJobs'>;
type Tab = 'open' | 'assigned';
type Filter = 'ALL' | 'DELIVERY' | 'INSPECTION';

const FILTERS: Filter[] = ['ALL', 'DELIVERY', 'INSPECTION'];

const statusLabel = (status: ServiceJob['status']) => status.replace(/_/g, ' ');

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

export const ProviderJobsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('open');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notApproved, setNotApproved] = useState(false);

  const serviceFilter = useMemo<ServiceType | undefined>(
    () => filter === 'ALL' ? undefined : filter,
    [filter],
  );

  const load = useCallback(async (mode: 'reset' | 'more' = 'reset') => {
    if (mode === 'more' && !nextCursor) return;
    mode === 'more' ? setLoadingMore(true) : setLoading(true);
    setError(null);
    if (mode === 'reset') setNotApproved(false);

    try {
      const page = tab === 'open'
        ? await getJobFeedPage(serviceFilter, mode === 'more' ? nextCursor ?? undefined : undefined)
        : await getAssignedJobsPage(mode === 'more' ? nextCursor ?? undefined : undefined);

      const incoming = tab === 'assigned' && serviceFilter
        ? page.items.filter((job) => job.serviceType === serviceFilter)
        : page.items;

      setJobs((prev) => mode === 'more' ? [...prev, ...incoming] : incoming);
      setNextCursor(page.nextCursor);
    } catch (err: any) {
      const message = err?.message || 'Could not load provider jobs.';
      if (/no approved services|approved service providers/i.test(message)) {
        setNotApproved(true);
        if (mode === 'reset') setJobs([]);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [tab, serviceFilter, nextCursor]);

  useEffect(() => {
    setJobs([]);
    setNextCursor(null);
    void load('reset');
    // load intentionally changes with tab/filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, serviceFilter]);

  useEffect(() => subscribeProductSync(['services'], () => {
    setNextCursor(null);
    void load('reset');
  }), [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNextCursor(null);
    void load('reset');
  }, [load]);

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.header}>
        <IconButton
          style={styles.headerButton}
          icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Service Jobs</Text>
          <Text style={styles.headerSub}>Delivery, Recovery & Inspection</Text>
        </View>
        <HamburgerButton />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'open' && styles.tabActive]}
          onPress={() => setTab('open')}
        >
          <Text style={[styles.tabText, tab === 'open' && styles.tabTextActive]}>AVAILABLE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'assigned' && styles.tabActive]}
          onPress={() => setTab('assigned')}
        >
          <Text style={[styles.tabText, tab === 'assigned' && styles.tabTextActive]}>MY WORK</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.filter, filter === item && styles.filterActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {item === 'ALL' ? 'All' : item === 'DELIVERY' ? 'Delivery' : 'Inspection'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && jobs.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>
      ) : notApproved ? (
        <View style={styles.centerCard}>
          <Ionicons name="shield-outline" size={34} color={Colors.warning} />
          <Text style={styles.emptyTitle}>Approved service required</Text>
          <Text style={styles.emptyText}>
            Apply for Delivery & Recovery or Vehicle Inspection, finish verification and connect payouts. Matching jobs appear here after approval.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('ProviderCapabilities')}
          >
            <Text style={styles.primaryText}>MANAGE SERVICES</Text>
          </TouchableOpacity>
        </View>
      ) : error && jobs.length === 0 ? (
        <View style={styles.centerCard}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.accent} />
          <Text style={styles.emptyTitle}>Could not load jobs</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void load('reset')}>
            <Text style={styles.primaryText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={jobs.length ? styles.list : styles.emptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerCard}>
              <Ionicons name="briefcase-outline" size={34} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {tab === 'open' ? 'No matching jobs right now' : 'No assigned work yet'}
              </Text>
              <Text style={styles.emptyText}>
                {tab === 'open'
                  ? 'New customer jobs appear automatically when they match your approved service areas.'
                  : 'Quote on available jobs. Accepted and paid work stays here for your team.'}
              </Text>
            </View>
          }
          onEndReached={() => {
            if (nextCursor && !loadingMore) void load('more');
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={Colors.accent} style={{ marginVertical: 18 }} /> : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
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
    backgroundColor: Colors.whiteAlpha06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.textMuted, marginTop: 2 },
  tabs: { flexDirection: 'row', marginHorizontal: 18, marginTop: 4, borderRadius: Radius.inline, backgroundColor: Colors.bgSecondary, padding: 4 },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: Colors.accent },
  tabText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textMuted, letterSpacing: 0.7 },
  tabTextActive: { color: Colors.white },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 12 },
  filter: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.whiteAlpha06 },
  filterActive: { borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10 },
  filterText: { fontFamily: FontFamily.medium, fontSize: FontSize.size10, color: Colors.textMuted },
  filterTextActive: { color: Colors.accent },
  list: { padding: 18, gap: 12, paddingBottom: 36 },
  emptyList: { flexGrow: 1, padding: 18, justifyContent: 'center' },
  card: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, padding: 15, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  typeRow: { flex: 1, flexDirection: 'row', gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  typeText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, marginTop: 3 },
  statusPill: { borderRadius: 999, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha08, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textSecondary },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.whiteAlpha08, paddingTop: 11, marginTop: 2 },
  trailing: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accent },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  openText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.accent, letterSpacing: 0.6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerCard: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white, textAlign: 'center' },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textMuted, textAlign: 'center', lineHeight: 19, maxWidth: 340 },
  primaryButton: { marginTop: 5, minHeight: 44, borderRadius: Radius.inline, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 0.7 },
});
