import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
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
  ServiceQuote,
  acceptCustomerQuote,
  cancelCustomerServiceJob,
  confirmCustomerServiceJob,
  disputeCustomerServiceJob,
  formatPence,
  getCustomerServiceJob,
} from '../../lib/servicesApi';
import { refuseAuctionAfterInspection } from '../../lib/auctionApi';
import { getOrCreateServiceJobRoom } from '../../lib/chatApi';
import { IconButton } from '../../components/IconButton';

type Props = NativeStackScreenProps<MainStackParamList, 'CustomerServiceJobDetail'>;

const statusText = (status: ServiceJob['status']) => status.replace(/_/g, ' ');

const providerName = (quote?: ServiceQuote | null) =>
  quote?.contractor?.businessName
  || [quote?.contractor?.user?.firstName, quote?.contractor?.user?.lastName].filter(Boolean).join(' ')
  || 'Verified provider';

export const CustomerServiceJobDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { jobId } = route.params;
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setJob(await getCustomerServiceJob(jobId));
    } catch (err: any) {
      setError(err?.message || 'Could not load this service job.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { void load(); }, [load]);

  const activeQuotes = useMemo(
    () => (job?.quotes ?? [])
      .filter((quote) => quote.status === 'ACTIVE')
      .sort((a, b) => a.amountPence - b.amountPence),
    [job?.quotes],
  );
  const accepted = useMemo(
    () => (job?.quotes ?? []).find((quote) => quote.id === job?.acceptedQuoteId) ?? null,
    [job?.quotes, job?.acceptedQuoteId],
  );

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    setError(null);
    setFlash(null);
    try {
      await action();
      setFlash(success);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const openCheckout = async (quote: ServiceQuote) => {
    setBusy(quote.id);
    setError(null);
    try {
      const checkoutUrl = await acceptCustomerQuote(jobId, quote.id);
      const supported = await Linking.canOpenURL(checkoutUrl);
      if (!supported) throw new Error('Could not open secure checkout.');
      await Linking.openURL(checkoutUrl);
      setFlash('Checkout opened. Return here after payment and refresh the job status.');
    } catch (err: any) {
      setError(err?.message || 'Could not open secure checkout.');
    } finally {
      setBusy(null);
    }
  };

  const openChat = async () => {
    if (!job) return;
    setBusy('chat');
    setError(null);
    try {
      const room = await getOrCreateServiceJobRoom(job.id);
      navigation.navigate('ChatScreen', { threadId: room.id });
    } catch (err: any) {
      setError(err?.message || 'Could not open the provider conversation.');
    } finally {
      setBusy(null);
    }
  };

  const refuseVehicle = () => {
    if (!job?.sourceAuctionId) return;
    Alert.alert(
      'Refuse this vehicle?',
      'The linked inspection recorded faults. Refusing will cancel the auction sale and refund the full £125 buyer fee.',
      [
        { text: 'Keep vehicle', style: 'cancel' },
        {
          text: 'Refuse & refund £125',
          style: 'destructive',
          onPress: () => void run(
            'refuse',
            () => refuseAuctionAfterInspection(
              job.sourceAuctionId!,
              job.inspectionSummary?.trim() || undefined,
            ),
            'Vehicle refused. Your £125 buyer fee has been refunded and the seller can repair or relist the vehicle.',
          ),
        },
      ],
    );
  };

  const cancelJob = () => {
    if (!job) return;
    Alert.alert(
      'Cancel this job?',
      'Any active provider quotes will be withdrawn.',
      [
        { text: 'Keep job', style: 'cancel' },
        {
          text: 'Cancel job',
          style: 'destructive',
          onPress: () => void run(
            'cancel',
            () => cancelCustomerServiceJob(job.id),
            'Service job cancelled.',
          ),
        },
      ],
    );
  };

  const disputeJob = () => {
    if (!job) return;
    Alert.alert(
      'Raise a dispute?',
      'This freezes the paid service job for CarMazium to review.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Raise dispute',
          style: 'destructive',
          onPress: () => void run(
            'dispute',
            () => disputeCustomerServiceJob(job.id),
            'Dispute raised. CarMazium will review the job.',
          ),
        },
      ],
    );
  };

  if (loading && !job) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <IconButton
            style={styles.headerButton}
            icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
          />
          <Text style={styles.headerTitle}>Service Job</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centerCard}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.accent} />
          <Text style={styles.emptyTitle}>Job unavailable</Text>
          <Text style={styles.bodyText}>{error || 'This service job could not be loaded.'}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void load()}>
            <Text style={styles.primaryText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const vehicle = job.vehicles?.[0];
  const isInspection = job.serviceType === 'INSPECTION';
  const paidState = ['PAID', 'IN_PROGRESS', 'COMPLETED', 'RELEASED', 'DISPUTED'].includes(job.status);
  const canMessageProvider = Boolean(job.contractor && paidState);
  const canRefuse = Boolean(
    isInspection
    && job.inspectionOutcome === 'FAULTS_FOUND'
    && job.sourceAuctionId
    && ['COMPLETED', 'RELEASED'].includes(job.status),
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
          <Text style={styles.headerTitle}>Service Job</Text>
          <Text style={styles.headerSub}>{SERVICE_LABELS[job.serviceType]}</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => void load()}>
          {loading
            ? <ActivityIndicator size="small" color={Colors.textSecondary} />
            : <Ionicons name="refresh-outline" size={18} color={Colors.textSecondary} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {flash ? (
          <View style={[styles.notice, styles.noticeOk]}>
            <Ionicons name="checkmark-circle-outline" size={17} color={Colors.accentGreen} />
            <Text style={styles.noticeText}>{flash}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={[styles.notice, styles.noticeError]}>
            <Ionicons name="alert-circle-outline" size={17} color={Colors.accent} />
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={styles.serviceIcon}>
              <Ionicons
                name={isInspection ? 'search-outline' : 'car-outline'}
                size={22}
                color={isInspection ? Colors.warning : Colors.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{job.title}</Text>
              <Text style={styles.status}>{statusText(job.status)}</Text>
            </View>
          </View>

          <Info
            icon="location-outline"
            label={isInspection ? 'Inspection location' : 'Route'}
            value={
              isInspection
                ? [job.serviceAddress, job.servicePostcode].filter(Boolean).join(', ') || 'Location pending'
                : `${job.pickupPostcode || 'Pickup'} → ${job.deliveryPostcode || 'Delivery'}`
            }
          />
          {vehicle ? (
            <Info
              icon="car-sport-outline"
              label="Vehicle"
              value={[vehicle.registration, vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || 'Vehicle'}
            />
          ) : null}
          {job.description ? <Text style={styles.description}>{job.description}</Text> : null}
        </View>

        {isInspection && job.inspectionOutcome ? (
          <View style={[
            styles.card,
            job.inspectionOutcome === 'FAULTS_FOUND' ? styles.warningCard : styles.successCard,
          ]}>
            <Text style={styles.sectionLabel}>INSPECTION RESULT</Text>
            <View style={styles.resultRow}>
              <Ionicons
                name={job.inspectionOutcome === 'FAULTS_FOUND' ? 'warning-outline' : 'checkmark-circle-outline'}
                size={22}
                color={job.inspectionOutcome === 'FAULTS_FOUND' ? Colors.warning : Colors.accentGreen}
              />
              <Text style={styles.resultTitle}>
                {job.inspectionOutcome === 'FAULTS_FOUND'
                  ? 'Faults found'
                  : 'No refusal-triggering faults found'}
              </Text>
            </View>
            {job.inspectionSummary ? (
              <Text style={styles.bodyText}>{job.inspectionSummary}</Text>
            ) : null}
            {canRefuse ? (
              <TouchableOpacity
                style={[styles.dangerButton, busy === 'refuse' && styles.disabled]}
                onPress={refuseVehicle}
                disabled={busy === 'refuse'}
              >
                {busy === 'refuse'
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Ionicons name="close-circle-outline" size={17} color={Colors.white} />}
                <Text style={styles.dangerText}>REFUSE VEHICLE & REFUND £125</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {job.status === 'OPEN' ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>PROVIDER QUOTES ({activeQuotes.length})</Text>
            {activeQuotes.length === 0 ? (
              <>
                <Text style={styles.bodyText}>No quotes yet.</Text>
                <Text style={styles.muted}>
                  {job.eligibleProviderCount != null
                    ? `${job.eligibleProviderCount} verified provider${job.eligibleProviderCount === 1 ? '' : 's'} currently match this request.`
                    : 'Matching verified providers can quote while the job remains open.'}
                </Text>
              </>
            ) : activeQuotes.map((quote, index) => (
              <View key={quote.id} style={styles.quoteCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.providerName}>{providerName(quote)}</Text>
                  <Text style={styles.muted}>
                    {quote.contractor
                      ? `${quote.contractor.rating.toFixed(1)} rating · ${quote.contractor.totalReviews} reviews`
                      : index === 0 ? 'Lowest current quote' : 'Verified provider'}
                  </Text>
                  {quote.message ? <Text style={styles.quoteMessage}>{quote.message}</Text> : null}
                </View>
                <View style={styles.quoteRight}>
                  <Text style={styles.quotePrice}>{formatPence(quote.amountPence)}</Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, busy === quote.id && styles.disabled]}
                    onPress={() => void openCheckout(quote)}
                    disabled={busy === quote.id}
                  >
                    {busy === quote.id
                      ? <ActivityIndicator size="small" color={Colors.white} />
                      : <Text style={styles.primaryText}>ACCEPT & PAY</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {job.status === 'ACCEPTED' && accepted ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>PAYMENT REQUIRED</Text>
            <Text style={styles.providerName}>{providerName(accepted)}</Text>
            <Text style={styles.quotePrice}>{formatPence(accepted.amountPence)}</Text>
            <Text style={styles.bodyText}>
              Your provider is reserved. Complete secure checkout to confirm the job.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, busy === accepted.id && styles.disabled]}
              onPress={() => void openCheckout(accepted)}
              disabled={busy === accepted.id}
            >
              {busy === accepted.id
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.primaryText}>PAY SECURELY</Text>}
            </TouchableOpacity>
          </View>
        ) : null}

        {job.agreedAmountPence != null ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>SERVICE PAYMENT</Text>
            <Text style={styles.bigPrice}>{formatPence(job.agreedAmountPence)}</Text>
            <Text style={styles.bodyText}>
              {job.payment?.status === 'RELEASED'
                ? 'Provider payment released.'
                : job.payment?.status === 'PAID'
                  ? 'Payment is held by CarMazium until you confirm completion or the auto-release period ends.'
                  : job.payment?.status === 'REFUNDED'
                    ? 'This service payment has been refunded.'
                    : 'Waiting for secure payment confirmation.'}
            </Text>
          </View>
        ) : null}

        {job.contractor && paidState ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>YOUR PROVIDER</Text>
            <Text style={styles.providerName}>
              {job.contractor.businessName
                || [job.contractor.user.firstName, job.contractor.user.lastName].filter(Boolean).join(' ')
                || 'Verified provider'}
            </Text>
            <Text style={styles.muted}>
              {job.contractor.rating.toFixed(1)} rating · {job.contractor.totalReviews} reviews
            </Text>
            <View style={styles.actionRow}>
              {job.contractor.phone || job.contractor.user.phone ? (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => void Linking.openURL(`tel:${job.contractor?.phone || job.contractor?.user.phone}`)}
                >
                  <Ionicons name="call-outline" size={16} color={Colors.accent} />
                  <Text style={styles.secondaryText}>CALL</Text>
                </TouchableOpacity>
              ) : null}
              {canMessageProvider ? (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => void openChat()}
                  disabled={busy === 'chat'}
                >
                  {busy === 'chat'
                    ? <ActivityIndicator size="small" color={Colors.accent} />
                    : <Ionicons name="chatbubble-outline" size={16} color={Colors.accent} />}
                  <Text style={styles.secondaryText}>MESSAGE</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {job.status === 'COMPLETED' ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CONFIRM SERVICE</Text>
            <Text style={styles.bodyText}>
              The provider marked this {isInspection ? 'inspection' : 'delivery'} complete.
              Confirm only when you are satisfied.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, busy === 'confirm' && styles.disabled]}
              disabled={busy === 'confirm'}
              onPress={() => void run(
                'confirm',
                () => confirmCustomerServiceJob(job.id),
                `Completion confirmed. Your ${isInspection ? 'inspector' : 'transporter'} can now be paid.`,
              )}
            >
              {busy === 'confirm'
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.primaryText}>CONFIRM COMPLETION</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={disputeJob}
              disabled={busy === 'dispute'}
            >
              <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} />
              <Text style={[styles.secondaryText, { color: Colors.warning }]}>RAISE DISPUTE</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {job.status === 'OPEN' ? (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelJob}
            disabled={busy === 'cancel'}
          >
            <Ionicons name="trash-outline" size={15} color={Colors.textMuted} />
            <Text style={styles.cancelText}>Cancel service request</Text>
          </TouchableOpacity>
        ) : null}

        {job.status === 'DISPUTED' ? (
          <View style={[styles.notice, styles.noticeWarning]}>
            <Ionicons name="shield-outline" size={17} color={Colors.warning} />
            <Text style={styles.noticeText}>This job is frozen while CarMazium reviews the dispute.</Text>
          </View>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

const Info = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={16} color={Colors.textMuted} />
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha08,
  },
  headerButton: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha10,
    alignItems: 'center', justifyContent: 'center',
  },
  refreshButton: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  content: { padding: 18, gap: 12, paddingBottom: 70 },
  card: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    padding: 16,
    gap: 12,
  },
  warningCard: { borderColor: Colors.warningAlpha30, backgroundColor: Colors.warningAlpha08 },
  successCard: { borderColor: Colors.accentGreenAlpha30, backgroundColor: Colors.accentGreenAlpha08 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.whiteAlpha05,
  },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  status: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 3, textTransform: 'uppercase' },
  sectionLabel: { fontFamily: FontFamily.bold, fontSize: 10, color: Colors.textMuted, letterSpacing: 1.2 },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted },
  infoValue: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  description: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  bodyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  muted: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  resultRow: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  resultTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white },
  quoteCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderTopWidth: 1, borderTopColor: Colors.whiteAlpha08, paddingTop: 12,
  },
  providerName: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white },
  quoteMessage: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 6, lineHeight: 18 },
  quoteRight: { alignItems: 'flex-end', gap: 7 },
  quotePrice: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  bigPrice: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.white },
  primaryButton: {
    minHeight: 44, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 7,
  },
  primaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white },
  secondaryButton: {
    minHeight: 42, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.whiteAlpha04,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7,
  },
  secondaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accent },
  dangerButton: {
    minHeight: 46, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: Colors.accent, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  dangerText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white },
  disabled: { opacity: 0.6 },
  actionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  cancelButton: { alignSelf: 'center', flexDirection: 'row', gap: 7, alignItems: 'center', padding: 12 },
  cancelText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted },
  notice: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    borderRadius: 11, padding: 12, borderWidth: 1,
  },
  noticeOk: { backgroundColor: Colors.accentGreenAlpha08, borderColor: Colors.accentGreenAlpha30 },
  noticeError: { backgroundColor: Colors.accentAlpha10, borderColor: Colors.accentAlpha22 },
  noticeWarning: { backgroundColor: Colors.warningAlpha08, borderColor: Colors.warningAlpha30 },
  noticeText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  centerCard: { flex: 1, padding: 34, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
});
