import React, { useCallback, useEffect, useState } from 'react';
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
  formatPence,
  getMyServiceJobsPage,
} from '../../lib/servicesApi';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';

type Props = NativeStackScreenProps<MainStackParamList, 'CustomerServiceJobs'>;

const statusLabel = (status: ServiceJob['status']) => status.replace(/_/g, ' ');

const locationText = (job: ServiceJob) => {
  if (job.serviceType === 'INSPECTION') {
    return job.servicePostcode || job.serviceAddress || 'Inspection location';
  }
  const from = job.pickupPostcode || 'Pickup';
  const to = job.deliveryPostcode || 'Delivery';
  return `${from} → ${to}`;
};

const trailingText = (job: ServiceJob) => {
  if (job.agreedAmountPence != null) return formatPence(job.agreedAmountPence);
  const active = (job.quotes ?? []).filter((q) => q.status === 'ACTIVE');
  if (active.length > 0) {
    const cheapest = Math.min(...active.map((q) => q.amountPence));
    return `from ${formatPence(cheapest)}`;
  }
  return `${job._count?.quotes ?? active.length} quote${(job._count?.quotes ?? active.length) === 1 ? '' : 's'}`;
};

export const CustomerServiceJobsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'reset' | 'more' = 'reset') => {
    if (mode === 'more' && !nextCursor) return;
    mode === 'more' ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await getMyServiceJobsPage(
        mode === 'more' ? nextCursor ?? undefined : undefined,
      );
      setJobs((prev) => mode === 'more' ? [...prev, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (err: any) {
      setError(err?.message || 'Could not load your service jobs.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [nextCursor]);

  useEffect(() => { void load('reset'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNextCursor(null);
    void load('reset');
  }, [load]);

  const renderJob = ({ item: job }: { item: ServiceJob }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.82}
      onPress={() => navigation.navigate('CustomerServiceJobDetail', { jobId: job.id })}
    >
      <View style={styles.topRow}>
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
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{statusLabel(job.status)}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.metaText}>{locationText(job)}</Text>
      </View>

      {job.vehicles?.[0] ? (
        <View style={styles.metaRow}>
          <Ionicons name="car-sport-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.metaText}>
            {[job.vehicles[0].registration, job.vehicles[0].make, job.vehicles[0].model]
              .filter(Boolean).join(' · ') || 'Vehicle'}
          </Text>
        </View>
      ) : null}

      {job.serviceType === 'INSPECTION' && job.inspectionOutcome ? (
        <View style={[
          styles.outcome,
          job.inspectionOutcome === 'FAULTS_FOUND'
            ? styles.outcomeWarning
            : styles.outcomeOk,
        ]}>
          <Ionicons
            name={job.inspectionOutcome === 'FAULTS_FOUND' ? 'warning-outline' : 'checkmark-circle-outline'}
            size={14}
            color={job.inspectionOutcome === 'FAULTS_FOUND' ? Colors.warning : Colors.accentGreen}
          />
          <Text style={styles.outcomeText}>
            {job.inspectionOutcome === 'FAULTS_FOUND' ? 'Faults found' : 'Inspection passed'}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.trailing}>{trailingText(job)}</Text>
        <View style={styles.openRow}>
          <Text style={styles.openText}>VIEW JOB</Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.accent} />
        </View>
      </View>
    </TouchableOpacity>
  );

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
          <Text style={styles.headerTitle}>My Service Jobs</Text>
          <Text style={styles.headerSub}>Delivery & inspection requests</Text>
        </View>
        <HamburgerButton />
      </View>

      {loading && jobs.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>
      ) : error && jobs.length === 0 ? (
        <View style={styles.centerCard}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.accent} />
          <Text style={styles.emptyTitle}>Could not load jobs</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void load('reset')}>
            <Text style={styles.primaryText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.centerCard}>
          <Ionicons name="briefcase-outline" size={34} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No service jobs yet</Text>
          <Text style={styles.emptyText}>
            Inspection and delivery requests you create through CarMazium will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.accent} />
          }
          onEndReached={() => nextCursor && !loadingMore && void load('more')}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={Colors.accent} style={{ marginVertical: 18 }} />
              : error
                ? <Text style={styles.inlineError}>{error}</Text>
                : null
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteAlpha08,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  list: { padding: 18, gap: 12, paddingBottom: 60 },
  card: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    borderRadius: Radius.card,
    padding: 16,
    gap: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconBox: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.whiteAlpha05,
  },
  typeText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase' },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white, marginTop: 3 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.whiteAlpha06 },
  statusText: { fontFamily: FontFamily.bold, fontSize: 9, color: Colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },
  outcome: { flexDirection: 'row', gap: 7, alignItems: 'center', borderRadius: 10, padding: 10, borderWidth: 1 },
  outcomeWarning: { backgroundColor: Colors.warningAlpha08, borderColor: Colors.warningAlpha30 },
  outcomeOk: { backgroundColor: Colors.accentGreenAlpha08, borderColor: Colors.accentGreenAlpha30 },
  outcomeText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  trailing: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openText: { fontFamily: FontFamily.bold, fontSize: 10, color: Colors.accent },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerCard: { flex: 1, padding: 34, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white, textAlign: 'center' },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  primaryButton: { backgroundColor: Colors.accent, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, marginTop: 6 },
  primaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white },
  inlineError: { color: Colors.accent, fontFamily: FontFamily.medium, textAlign: 'center', padding: 12 },
});
