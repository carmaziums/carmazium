import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import {
  formatPence,
  getAssignedProviderJobsPage,
  getProviderJobFeedPage,
  ServiceJob,
} from '../../lib/servicesApi';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderJobs'>;
type Tab = 'available' | 'mine';

const statusLabel = (status: ServiceJob['status']) =>
  status.replace(/_/g, ' ');

const serviceLabel = (job: ServiceJob) =>
  job.serviceType === 'INSPECTION'
    ? 'INSPECTION'
    : job.isRecovery
      ? 'RECOVERY'
      : 'DELIVERY';

const locationLine = (job: ServiceJob) => {
  if (job.serviceType === 'INSPECTION') {
    return [job.serviceAddress, job.servicePostcode].filter(Boolean).join(', ');
  }
  const from = [job.pickupAddress, job.pickupPostcode].filter(Boolean).join(', ');
  const to = [job.deliveryAddress, job.deliveryPostcode].filter(Boolean).join(', ');
  return [from && `From ${from}`, to && `To ${to}`].filter(Boolean).join(' • ');
};

export const ProviderJobsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('available');
  const [items, setItems] = useState<ServiceJob[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = tab === 'available'
        ? await getProviderJobFeedPage(cursor)
        : await getAssignedProviderJobsPage(cursor);
      setItems((prev) => append ? [...prev, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (err: any) {
      setError(err?.message || 'Could not load provider jobs.');
      if (!append) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const renderJob = ({ item: job }: { item: ServiceJob }) => {
    const quote = job.quotes?.[0];
    const workValue = job.contractorAmountPence ?? job.agreedAmountPence;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.78}
        onPress={() => navigation.navigate('ProviderJobDetail', { jobId: job.id })}
      >
        <View style={styles.rowBetween}>
          <View style={[styles.chip, job.serviceType === 'INSPECTION' && styles.chipBlue]}>
            <Text style={styles.chipText}>{serviceLabel(job)}</Text>
          </View>
          <Text style={styles.status}>{statusLabel(job.status)}</Text>
        </View>

        <Text style={styles.jobTitle}>{job.title}</Text>
        {!!job.description && <Text style={styles.description} numberOfLines={2}>{job.description}</Text>}

        {!!locationLine(job) && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={2}>{locationLine(job)}</Text>
          </View>
        )}

        {!!job.requestedFor && (
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>{new Date(job.requestedFor).toLocaleString('en-GB')}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <View>
            {tab === 'available' ? (
              quote ? (
                <>
                  <Text style={styles.footerLabel}>YOUR QUOTE</Text>
                  <Text style={styles.footerValue}>{formatPence(quote.amountPence)}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.footerLabel}>COMPETITION</Text>
                  <Text style={styles.footerValue}>{job._count?.quotes ?? 0} quote{(job._count?.quotes ?? 0) === 1 ? '' : 's'}</Text>
                </>
              )
            ) : (
              <>
                <Text style={styles.footerLabel}>YOUR WORK</Text>
                <Text style={styles.footerValue}>
                  {workValue != null ? formatPence(workValue) : 'Awaiting payment'}
                </Text>
              </>
            )}
          </View>
          <View style={styles.openButton}>
            <Text style={styles.openButtonText}>
              {tab === 'available' ? (quote ? 'VIEW / UPDATE' : 'QUOTE JOB') : 'OPEN JOB'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.white} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgPrimary} />
      <View style={styles.header}>
        <IconButton
          style={styles.headerButton}
          icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={styles.headerTitle}>Provider Jobs</Text>
        <HamburgerButton />
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>TRADEXCHANGE WORK</Text>
        <Text style={styles.title}>Jobs for your Partner business</Text>
        <Text style={styles.sub}>
          Quote on matching Delivery, Recovery and Inspection work. Jobs you win move to My Work.
        </Text>
      </View>

      <View style={styles.tabs}>
        {(['available', 'mine'] as const).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {key === 'available' ? 'AVAILABLE JOBS' : 'MY WORK'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => void load()} style={styles.retryButton}>
              <Text style={styles.retryText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.loadingText}>Loading provider jobs…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name={tab === 'available' ? 'briefcase-outline' : 'checkmark-done-outline'} size={34} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {tab === 'available' ? 'No matching jobs right now' : 'No assigned work yet'}
              </Text>
              <Text style={styles.emptyText}>
                {tab === 'available'
                  ? 'New jobs appear automatically when they match an approved service and your matching area.'
                  : 'When a customer accepts and pays for your quote, the job will appear here.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            nextCursor ? (
              <TouchableOpacity
                style={styles.loadMore}
                onPress={() => void load(nextCursor, true)}
                disabled={loadingMore}
              >
                {loadingMore ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.loadMoreText}>LOAD MORE</Text>}
              </TouchableOpacity>
            ) : <View style={{ height: 18 }} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  hero: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  eyebrow: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.size10, letterSpacing: 1.5 },
  title: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xl, marginTop: 6 },
  sub: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20, marginTop: 7 },
  tabs: { flexDirection: 'row', marginHorizontal: 18, borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha06, padding: 4, marginBottom: 10 },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: Colors.accent },
  tabText: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 0.8 },
  tabTextActive: { color: Colors.white },
  list: { padding: 18, paddingTop: 8, gap: 12, flexGrow: 1 },
  card: { borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, borderRadius: Radius.card, padding: 15, gap: 9 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chip: { borderRadius: 8, backgroundColor: Colors.accentAlpha10, paddingHorizontal: 8, paddingVertical: 5 },
  chipBlue: { backgroundColor: Colors.infoBlueAlpha04 },
  chipText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10, letterSpacing: 0.8 },
  status: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10 },
  jobTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.base },
  description: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size12, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  metaText: { flex: 1, fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size12, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha08, paddingTop: 11, marginTop: 2 },
  footerLabel: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 0.8 },
  footerValue: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.sm, marginTop: 2 },
  openButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, borderRadius: 10, backgroundColor: Colors.accent, paddingHorizontal: 11 },
  openButtonText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10 },
  errorCard: { flexDirection: 'row', gap: 9, marginHorizontal: 18, marginBottom: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10, padding: 12 },
  errorText: { fontFamily: FontFamily.regular, color: Colors.white, fontSize: FontSize.size12 },
  retryButton: { alignSelf: 'flex-start', marginTop: 7 },
  retryText: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.size10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size12 },
  empty: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.base, marginTop: 12 },
  emptyText: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size12, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  loadMore: { alignSelf: 'center', minWidth: 140, minHeight: 42, borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  loadMoreText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10, letterSpacing: 0.8 },
});
