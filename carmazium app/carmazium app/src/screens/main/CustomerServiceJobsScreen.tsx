import React, { useCallback, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Elevation, Radius } from '../../constants/spacing';
import {
  SERVICE_LABELS,
  ServiceJob,
  formatPence,
  getMyServiceJobsPage,
} from '../../lib/servicesApi';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
import { Button } from '../../components/Button';
import { REQUEST_FILTERS, requestMatches, requestNextStep, type RequestFilter } from '../../lib/serviceRequestViews';
import { getServiceSettings } from '../../lib/servicesApi';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<MainStackParamList, 'CustomerServiceJobs'>;

const statusLabel = (status: ServiceJob['status']) => ({ OPEN: 'Open for quotes', ACCEPTED: 'Awaiting payment', PAID: 'Paid — ready', IN_PROGRESS: 'In progress', COMPLETED: 'Awaiting confirmation', RELEASED: 'Complete', CANCELLED: 'Cancelled', EXPIRED: 'Expired', DISPUTED: 'Disputed' }[status]);

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

export const CustomerServiceJobsScreen: React.FC<Props> = props => {
  const userId=useAuthStore(s=>s.user?.id);
  return userId ? <CustomerRequests key={userId} {...props}/> : null;
};
const CustomerRequests: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [filter,setFilter]=useState<RequestFilter>("all");
  const [availability,setAvailability]=useState<{DELIVERY?:boolean;INSPECTION?:boolean}|null>(null);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId=useRef(0);
  const activeRequest=useRef(false);
  const load = useCallback(async (mode: 'reset' | 'more' = 'reset') => {
    if (mode === 'more' && (!nextCursor || activeRequest.current)) return;
    const id=++requestId.current;
    activeRequest.current=true;
    mode === 'more' ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await getMyServiceJobsPage(
        mode === 'more' ? nextCursor ?? undefined : undefined,
      );
      if(id!==requestId.current)return;
      setJobs((prev) => mode === 'more' ? [...new Map([...prev,...page.items].map(job=>[job.id,job])).values()] : page.items);
      setNextCursor(page.nextCursor);
    } catch (err: any) {
      if(id===requestId.current)setError(err?.message || 'Could not load your service requests.');
    } finally {
      if(id===requestId.current){activeRequest.current=false;setLoading(false);setLoadingMore(false);setRefreshing(false);}
    }
  }, [nextCursor]);

  // Reset pagination after returning from a job/quote/payment on another screen.
  // The reset branch never reads nextCursor, so stable callback avoids a
  // refetch loop when the paginated cursor changes.
  useFocusEffect(useCallback(() => {
    void load('reset');
    let active=true; getServiceSettings().then(data=>{if(active)setAvailability(data.availability??{});}).catch(()=>{if(active)setAvailability(null)});
    return ()=>{active=false;requestId.current++;activeRequest.current=false};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNextCursor(null);
    void load('reset');
  }, [load]);

  const ordered = jobs.filter(job=>requestMatches(job,filter));
  const requestActions = <View style={styles.actions}>
    {availability && availability.DELIVERY !== false && <Button label="Request transport" size="sm" onPress={()=>navigation.navigate('CreateServiceJob', {serviceType:'DELIVERY'})}/>}
    {availability && availability.INSPECTION !== false && <Button label="Request inspection" variant="outline" size="sm" onPress={()=>navigation.navigate('CreateServiceJob', {serviceType:'INSPECTION'})}/>}
  </View>;
  const renderJob = ({ item: job }: { item: ServiceJob }) => (<View style={styles.jobRow}>
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
          <Text style={styles.metaText}>{job.requestedFor ? `Wanted ${new Date(job.requestedFor).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'As soon as possible'}</Text>
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
            {job.vehicles.length>1 ? job.vehicles.length+' vehicles' : [job.vehicles[0].registration, job.vehicles[0].make, job.vehicles[0].model]
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
        <Text style={styles.trailing}>{job.status === 'OPEN' || job.agreedAmountPence != null ? trailingText(job) : ''}</Text>
        <View style={styles.openRow}>
          <Text style={styles.openText}>{requestNextStep(job)}</Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.accent} />
        </View>
      </View>
    </TouchableOpacity></View>
  );

  // Keep customer controls and job history in ONE scrolling list. Previously
  // the static toolbar consumed half the iPhone viewport while only cards moved.
  const listHeader = (
    <>
      <View style={styles.header}>
        <IconButton
          style={styles.headerButton}
          icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={styles.headerTitle} maxFontSizeMultiplier={1.25}>My Service Requests</Text>
          <Text style={styles.headerSub}>TradeXchange</Text>
        </View>
        <HamburgerButton />
      </View>
      <View style={styles.intro}>
        <Text style={styles.introText}>Review quotes, pay for accepted services and track the work you requested. This is separate from providing services.</Text>
        <View style={styles.actions}>
          <Button label="TradeXchange Services" variant="outline" size="sm" onPress={() => navigation.navigate('Services')} />
          <Button label="Warranty orders" variant="outline" size="sm" onPress={()=>navigation.navigate("WarrantyOrders")}/>
        </View>
        {requestActions}
        {availability===null && <Text style={styles.metaText}>Service availability is being checked. You can still view your existing requests.</Text>}
        <View style={styles.actions}>{REQUEST_FILTERS.map(([id,label])=><Button key={id} label={label} size="sm" variant={filter===id?"primary":"outline"} onPress={()=>setFilter(id)}/>)}</View>
        <Text style={styles.metaText}>{ordered.length} matching requests in {jobs.length} loaded{nextCursor?" — load more to search older requests":""}.</Text>
      </View>
    </>
  );

  const emptyContent = loading ? (
    <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>
  ) : error ? (
    <View style={styles.centerCard}>
      <Ionicons name="alert-circle-outline" size={32} color={Colors.accent} />
      <Text style={styles.emptyTitle}>Could not load jobs</Text>
      <Text style={styles.emptyText}>{error}</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => void load('reset')}>
        <Text style={styles.primaryText}>TRY AGAIN</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.centerCard}>
      <Ionicons name="briefcase-outline" size={34} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>{jobs.length ? "No matching requests in loaded history" : "No jobs yet"}</Text>
      <Text style={styles.emptyText}>Request transport or an inspection to receive quotes, or choose another filter.</Text>
      {requestActions}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
      <FlatList
        data={ordered}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyContent}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.accent} />}
        onEndReached={() => nextCursor && !loadingMore && void load('more')}
        onEndReachedThreshold={0.35}
        ListFooterComponent={loadingMore
          ? <ActivityIndicator color={Colors.accent} style={{ marginVertical: 18 }} />
          : <View>{error && jobs.length > 0 ? <Text style={styles.inlineError}>{error}</Text> : null}{nextCursor && <Button label="Load older requests" variant="outline" onPress={()=>void load("more")}/>}</View>}
      />
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 2,
    ...Elevation.card,
  },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  list: { paddingBottom: 60 },
  intro: { paddingHorizontal: 18, paddingVertical: 14, gap: 12 },
  introText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 20, color: Colors.textSecondary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  jobRow: { paddingHorizontal: 18, marginBottom: 12, gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 16,
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    ...Elevation.card,
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
  statusText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
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
  center: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  centerCard: { minHeight: 240, padding: 34, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white, textAlign: 'center' },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  primaryButton: { backgroundColor: Colors.accent, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, minHeight: 48, justifyContent: 'center', marginTop: 6, borderBottomWidth: 3, borderBottomColor: Colors.accentDark, ...Elevation.neon },
  primaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.onAccent },
  inlineError: { color: Colors.accent, fontFamily: FontFamily.medium, textAlign: 'center', padding: 12 },
});
