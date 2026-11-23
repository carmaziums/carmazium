import { ServiceJobChanges } from '../../components/ServiceJobChanges';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
  ServiceQuote,
  acceptCustomerQuote,
  cancelCustomerServiceJob,
  confirmCustomerServiceJob,
  disputeCustomerServiceJob,
  formatPence,
  classifyServiceCheckoutTarget,
  servicePaymentEvidence,
  servicePaymentStatusText,
  serviceCompletionReview,
  comparableServiceQuotes,
  isServiceQuoteSelectable,
  getCustomerServiceJob,
  createCustomerServiceReview,
} from '../../lib/servicesApi';
import { refuseAuctionAfterInspection } from '../../lib/auctionApi';
import { getOrCreateServiceJobRoom } from '../../lib/chatApi';
import { IconButton } from '../../components/IconButton';
import { useAuthStore } from '../../store/authStore';
import { customerServiceNextStep, inspectionRefusalNotice } from '../../lib/serviceJobJourney';
import { formatUkServiceDateTime } from '../../lib/ukServiceDateTime';

type Props = NativeStackScreenProps<MainStackParamList, 'CustomerServiceJobDetail'>;

const statusText = (status: ServiceJob['status']) => status.replace(/_/g, ' ');

const providerName = (quote?: ServiceQuote | null) =>
  quote?.contractor?.businessName
  || [quote?.contractor?.user?.firstName, quote?.contractor?.user?.lastName].filter(Boolean).join(' ')
  || 'Service provider';

export const CustomerServiceJobDetailScreen: React.FC<Props> = (props) => {
  const userId = useAuthStore(state => state.user?.id);
  return userId ? <CustomerJobDetail key={`${userId}:${props.route.params.jobId}`} {...props} /> : null;
};

const CustomerJobDetail: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { jobId } = route.params;
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const checkoutPending = useRef(false);
  const actionPending = useRef(false);
  const generation = useRef(0);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async (preserveError = true) => {
    const request = ++generation.current;
    setLoading(true);
    if (!preserveError) setError(null);
    try {
      const next = await getCustomerServiceJob(jobId);
      if (request !== generation.current) return;
      if (next.viewerRole === 'contractor' || next.viewerRole === 'bidder') {
        navigation.replace('ProviderJobDetail', { jobId });
        return;
      }
      setJob(next);
    } catch (err: any) {
      if (request === generation.current) setError(current => current || err?.message || 'Could not load this service request.');
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [jobId, navigation]);

  // Checkout leaves the app and job chat opens a separate stack screen.
  // Re-read server-confirmed payment/completion state when returning; never
  // infer payment success just because checkout launched.
  useFocusEffect(useCallback(() => {
    void load();
    return () => { generation.current++; };
  }, [load]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  const activeQuotes = useMemo(
    () => comparableServiceQuotes(job?.quotes),
    [job?.quotes],
  );
  const accepted = useMemo(
    () => (job?.quotes ?? []).find((quote) => quote.id === job?.acceptedQuoteId) ?? null,
    [job?.quotes, job?.acceptedQuoteId],
  );

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    if (actionPending.current || checkoutPending.current || busy !== null) return;
    actionPending.current = true;
    setBusy(key);
    setError(null);
    setFlash(null);
    try {
      const response = await action();
      setFlash(typeof response === 'string' ? response : success);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
      await load();
    } finally {
      actionPending.current = false;
      setBusy(null);
    }
  };

  // A synchronous guard protects against two different quotes being tapped
  // before React has rendered the first busy state. The backend also claims
  // exactly one quote atomically; the client never assumes payment succeeded.
  const openCheckout = async (quote: ServiceQuote, resume = false) => {
    if (!job || checkoutPending.current || busy !== null || actionPending.current) return;
    if (resume) {
      if (job.status !== 'ACCEPTED' || job.acceptedQuoteId !== quote.id || job.payment?.status !== 'PENDING') {
        setError('This job is no longer awaiting checkout. Refresh for the current payment status.');
        await load();
        return;
      }
    } else if (job.status !== 'OPEN' || !isServiceQuoteSelectable(quote)) {
      setError('This quote is no longer available. Refresh to compare current offers.');
      await load();
      return;
    }
    checkoutPending.current = true;
    setBusy(quote.id);
    setError(null);
    try {
      const checkoutUrl = await acceptCustomerQuote(jobId, quote.id);
      const target = classifyServiceCheckoutTarget(checkoutUrl, jobId);
      if (target === 'JOB_RETURN') {
        // The existing Stripe session was already paid. Stay on this native
        // page, do not open a website, and rely on the updated backend record.
        setFlash('Earlier checkout completed. Refreshing the confirmed service payment status.');
        await load();
        return;
      }
      if (target !== 'STRIPE_CHECKOUT') {
        throw new Error('Secure checkout could not be verified. Please refresh and try again.');
      }
      const supported = await Linking.canOpenURL(checkoutUrl);
      if (!supported) throw new Error('Could not open secure checkout.');
      await Linking.openURL(checkoutUrl);
      setFlash('Secure checkout opened. Payment is not confirmed until the job status updates.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not open secure checkout.');
      // Acceptance may have committed before Stripe returned an error: reload
      // rather than continuing to display multiple selectable OPEN quotes.
      await load();
    } finally {
      checkoutPending.current = false;
      setBusy(null);
    }
  };

  const chooseProvider = (quote: ServiceQuote) => {
    if (!job || busy !== null || checkoutPending.current || actionPending.current) return;
    if (job.status !== 'OPEN' || !isServiceQuoteSelectable(quote)) {
      setError('That quote has expired or the job has changed. Refresh and compare current offers.');
      void load();
      return;
    }
    Alert.alert(
      'Choose this provider?',
      `${providerName(quote)} quoted ${formatPence(quote.amountPence)} for the whole job. Only this quote will be accepted. Secure payment comes next; work starts after payment is confirmed.`,
      [
        { text: 'Keep comparing', style: 'cancel' },
        { text: 'Continue to payment', onPress: () => { void openCheckout(quote); } },
      ],
    );
  };

  const openChat = async () => {
    if (!job || actionPending.current || checkoutPending.current || busy !== null) return;
    actionPending.current = true;
    setBusy('chat');
    setError(null);
    try {
      const room = await getOrCreateServiceJobRoom(job.id);
      navigation.navigate('ChatScreen', { threadId: room.id });
    } catch (err: any) {
      setError(err?.message || 'Could not open the provider conversation.');
    } finally {
      actionPending.current = false;
      setBusy(null);
    }
  };

  const refuseVehicle = () => {
    if (!job?.sourceAuctionId) return;
    Alert.alert(
      'Refuse this vehicle?',
      'The linked inspection recorded faults. Refusing will cancel the auction sale and refund any buyer fee paid (up to £125).',
      [
        { text: 'Keep vehicle', style: 'cancel' },
        {
          text: 'Refuse vehicle',
          style: 'destructive',
          onPress: () => void run(
            'refuse',
            async () => {
              const result = await refuseAuctionAfterInspection(job.sourceAuctionId!, job.inspectionSummary?.trim() || undefined);
              if (!result.refused) throw new Error('Vehicle refusal could not be confirmed. Refresh the auction purchase for its status.');
              return inspectionRefusalNotice(result.refundedAmount);
            },
            'Vehicle refusal recorded.',
          ),
        },
      ],
    );
  };

  const confirmJob = () => {
    if (!job || !serviceCompletionReview(job) || actionPending.current || checkoutPending.current || busy !== null) return;
    Alert.alert(
      'Confirm service completion?',
      'Only confirm after checking the completed work. This releases the provider payout through the existing payment process. If something is wrong, raise a dispute instead.',
      [
        { text: 'Review again', style: 'cancel' },
        {
          text: 'Confirm and release payout',
          onPress: () => void run(
            'confirm',
            () => confirmCustomerServiceJob(job.id),
            'Service completion confirmed. Provider payout recorded.',
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
      job.status === 'RELEASED'
        ? 'This opens a post-payout review. The provider transfer is not automatically reversed.'
        : 'This pauses the usual provider payout while CarMazium reviews the service.',
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

  const submitReview = async () => {
    if (!job || !job.canReview || job.status !== 'RELEASED' || reviewRating < 1 || reviewRating > 5) return;
    await run('review', async () => {
      await createCustomerServiceReview(job.id, { rating: reviewRating, comment: reviewComment.trim() || undefined });
      setReviewRating(0);
      setReviewComment('');
    }, 'Thank you. Your verified service review is now published.');
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
          <Text style={styles.headerTitle}>Service Request</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centerCard}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.accent} />
          <Text style={styles.emptyTitle}>Job unavailable</Text>
          <Text style={styles.bodyText}>{error || 'This service job could not be loaded.'}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void load(false)}>
            <Text style={styles.primaryText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const paymentEvidence = servicePaymentEvidence(job.payment, job.agreedAmountPence);
  const completionReview = serviceCompletionReview(job);
  const isInspection = job.serviceType === 'INSPECTION';
  const paidState = ['PAID', 'IN_PROGRESS', 'COMPLETED', 'RELEASED', 'DISPUTED'].includes(job.status);
  const nextStep = customerServiceNextStep(job);
  const canMessageProvider = Boolean(job.contractor && paidState);
  const canRefuse = Boolean(
    isInspection
    && job.inspectionOutcome === 'FAULTS_FOUND'
    && job.sourceAuctionId
    && ['COMPLETED', 'RELEASED'].includes(job.status),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />

      <View style={styles.header}>
        <IconButton
          style={styles.headerButton}
          icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Service Request</Text>
          <Text style={styles.headerSub}>{SERVICE_LABELS[job.serviceType]}</Text>
        </View>
        <TouchableOpacity accessibilityLabel="Refresh request" disabled={loading || busy !== null} style={styles.refreshButton} onPress={() => void load(false)}>
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


        <View style={styles.nextStepCard}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>NEXT STEP</Text>
            <Text style={styles.providerName}>{nextStep.title}</Text>
            <Text style={styles.bodyText}>{nextStep.description}</Text>
          </View>
        </View>

        {job.status === 'ACCEPTED' && accepted ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>PAYMENT REQUIRED</Text>
            <Text style={styles.providerName}>{providerName(accepted)}</Text>
            <Text style={styles.quotePrice}>{formatPence(accepted.amountPence)}</Text>
            <Text style={styles.bodyText}>
              {accepted.message || 'No additional scope supplied.'}
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, busy !== null && styles.disabled]}
              onPress={() => { void openCheckout(accepted, true); }}
              disabled={busy !== null || job.payment?.status !== 'PENDING'}
            >
              {busy === accepted.id
                ? <ActivityIndicator size="small" color={Colors.onAccent} />
                : <Text style={styles.primaryText}>CONTINUE TO PAYMENT</Text>}
            </TouchableOpacity>
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
              {job.contractor.totalReviews > 0 ? `${job.contractor.rating.toFixed(1)} rating · ${job.contractor.totalReviews} reviews` : 'New to CarMazium'}
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
                  disabled={busy !== null}
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


        {isInspection && job.inspectionOutcome ? (
          <View style={[
            styles.card,
            job.inspectionOutcome === 'FAULTS_FOUND' ? styles.warningCard : styles.successCard,
          ]}>
            <Text style={styles.sectionLabel}>INSPECTION RESULT</Text>
          {!!job.sourceAuctionId && (
            <TouchableOpacity
              style={styles.auctionLink}
              onPress={() => navigation.navigate('AuctionDeepLink', { auctionId: job.sourceAuctionId! })}
              accessibilityRole="button"
              accessibilityLabel="Open linked vehicle auction"
            >
              <Text style={styles.auctionLinkText}>View linked auction</Text>
              <Ionicons name="arrow-forward-outline" size={17} color={Colors.accent} />
            </TouchableOpacity>
          )}
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
                disabled={busy !== null}
              >
                {busy === 'refuse'
                  ? <ActivityIndicator size="small" color={Colors.onAccent} />
                  : <Ionicons name="close-circle-outline" size={17} color={Colors.onAccent} />}
                <Text style={styles.dangerText}>REFUSE VEHICLE & REVIEW REFUND</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {job.status === 'COMPLETED' ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CONFIRM SERVICE</Text>
            <Text style={styles.bodyText}>
              The provider marked this {isInspection ? 'inspection' : 'delivery'} complete.
              Confirm only when you are satisfied. Confirming authorises provider payout; raise a dispute if the work is incomplete or incorrect.
            </Text>
            <Text style={styles.muted}>
              {completionReview
                ? completionReview.elapsed
                  ? 'The 48-hour review period has elapsed. Automatic confirmation may still be processing; check payment status.'
                  : `Automatic confirmation becomes eligible after ${formatUkServiceDateTime(completionReview.dueAt)}, unless a dispute blocks release.`
                : 'Completion is awaiting verification. Do not rely on an automatic payout date yet.'}
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, busy === 'confirm' && styles.disabled]}
              disabled={busy !== null || !completionReview}
              onPress={confirmJob}
            >
              {busy === 'confirm'
                ? <ActivityIndicator size="small" color={Colors.onAccent} />
                : <Text style={styles.primaryText}>CONFIRM COMPLETION</Text>}
            </TouchableOpacity>
          </View>
        ) : null}

        {['PAID', 'IN_PROGRESS', 'COMPLETED', 'RELEASED'].includes(job.status) ? (
          <TouchableOpacity style={styles.dangerButton} accessibilityRole="button"
            accessibilityLabel="Raise a service dispute"
            disabled={busy !== null} onPress={disputeJob}>
            <Text style={styles.dangerText}>SOMETHING WRONG? RAISE A DISPUTE</Text>
          </TouchableOpacity>
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
                    {quote.contractor ? (quote.contractor.totalReviews > 0 ? quote.contractor.rating.toFixed(1) + ' rating · ' + quote.contractor.totalReviews + ' reviews' : 'New to CarMazium') : 'Service provider'}
                  </Text>
                  {quote.contractor?.serviceArea ? <Text style={styles.muted}>Service area: {quote.contractor.serviceArea}</Text> : null}
                  {index === 0 ? <Text style={styles.muted}>Lowest current quote</Text> : null}
                  <Text style={styles.quoteMessage}>{quote.message || "No additional details supplied. Confirm scope before accepting."}</Text>
                  {quote.validUntil ? (
                    <Text style={styles.muted}>Valid until {new Date(quote.validUntil).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })} UK time</Text>
                  ) : null}
                </View>
                <View style={styles.quoteRight}>
                  <Text style={styles.quotePrice}>{formatPence(quote.amountPence)}</Text>
                  <Text style={styles.muted}>Total for the whole request</Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, busy !== null && styles.disabled]}
                    onPress={() => chooseProvider(quote)}
                    disabled={busy !== null}
                  >
                    {busy === quote.id
                      ? <ActivityIndicator size="small" color={Colors.onAccent} />
                      : <Text style={styles.primaryText}>CHOOSE & CONTINUE TO PAYMENT</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}


        <View style={styles.card}>
          <Text style={styles.providerName}>Request details</Text>

          <Info
            icon="location-outline"
            label={isInspection ? 'Inspection location' : 'Route'}
            value={
              isInspection
                ? [job.serviceAddress, job.servicePostcode].filter(Boolean).join(', ') || 'Location pending'
                : `${job.pickupPostcode || 'Pickup'} → ${job.deliveryPostcode || 'Delivery'}`
            }
          />
          {job.vehicles.map((vehicle, index) => <Info
            key={vehicle.id || index}
            icon="car-sport-outline"
            label={job.vehicles.length > 1 ? `Vehicle ${index + 1} of ${job.vehicles.length}` : 'Vehicle'}
            value={[
              [vehicle.registration, vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || 'Vehicle',
              vehicle.notes,
            ].filter(Boolean).join('\n')}
          />)}
          <Info icon="calendar-outline" label="Requested time" value={formatUkServiceDateTime(job.requestedFor)} />
          {job.description ? <Text style={styles.description}>{job.description}</Text> : null}
        </View>



        {job.agreedAmountPence != null ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>SERVICE PAYMENT</Text>
            <Text style={styles.bigPrice}>{formatPence(job.agreedAmountPence)}</Text>
            <Text style={styles.bodyText}>
              {servicePaymentStatusText(job.payment?.status)}
            </Text>
            {paymentEvidence ? (
              <View style={{ gap: 8, marginTop: 12 }}>
                <Info icon="cash-outline" label="Recorded customer amount" value={formatPence(paymentEvidence.grossPence)} />
                {paymentEvidence.refundPence > 0 ? <>
                  <Info icon="cash-outline" label="Recorded customer refund" value={formatPence(paymentEvidence.refundPence)} />
                  <Info icon="cash-outline" label="Remaining service amount" value={formatPence(paymentEvidence.netServicePence)} />
                </> : null}
                <Info icon="cash-outline" label="CarMazium service fee (9%)" value={formatPence(paymentEvidence.platformFeePence)} />
                <Info icon="cash-outline" label="Provider allocation (91%)" value={formatPence(paymentEvidence.contractorPence)} />
              </View>
            ) : (
              <Text accessibilityRole="alert" style={styles.muted}>
                Payment breakdown is not yet verified. Refresh or contact support before relying on these amounts.
              </Text>
            )}
          </View>
        ) : null}

        {job.status === 'OPEN' ? (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelJob}
            disabled={busy !== null}
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

        {job.status === 'RELEASED' && (job.review || job.canReview) ? (
          <View style={styles.card}>
            <Text style={styles.providerName}>{job.review ? 'Your verified service review' : 'Review your provider'}</Text>
            <Text style={styles.bodyText}>Reviews are available to customers after the paid service is completed.</Text>
            <View style={styles.actionRow}>
              {[1, 2, 3, 4, 5].map(star => <TouchableOpacity
                key={star} accessibilityRole="button" accessibilityLabel={`Rate ${star} star${star === 1 ? '' : 's'}`}
                accessibilityState={{ selected: star <= (job.review?.rating || reviewRating), disabled: !!job.review || busy !== null }}
                disabled={!!job.review || busy !== null} onPress={() => setReviewRating(star)} style={styles.starButton}>
                <Ionicons name={star <= (job.review?.rating || reviewRating) ? 'star' : 'star-outline'} size={25} color={Colors.warning} />
              </TouchableOpacity>)}
            </View>
            {job.review ? <>
              <Text style={styles.bodyText}>{job.review.rating} out of 5 stars</Text>
              {job.review.comment ? <Text style={styles.bodyText}>{job.review.comment}</Text> : null}
              <Text style={styles.muted}>{formatUkServiceDateTime(job.review.createdAt)}</Text>
            </> : <>
              <TextInput accessibilityLabel="Service review comment" placeholder="Optional comment about the service"
                placeholderTextColor={Colors.textMuted} value={reviewComment} onChangeText={setReviewComment}
                maxLength={2000} multiline editable={busy === null} style={styles.reviewInput} />
              <TouchableOpacity accessibilityRole="button" style={[styles.primaryButton, (busy !== null || !reviewRating) && styles.disabled]}
                disabled={busy !== null || !reviewRating} onPress={() => void submitReview()}>
                {busy === 'review' ? <ActivityIndicator size="small" color={Colors.onAccent} /> : <Text style={styles.primaryText}>SUBMIT VERIFIED REVIEW</Text>}
              </TouchableOpacity>
            </>}
          </View>
        ) : null}
        <ServiceJobChanges job={job} role="customer" onChange={load} disabled={busy !== null}
          onBusyChange={value => { actionPending.current = value; setBusy(value ? 'support' : null); }} />
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
  nextStepCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 15, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.borderHi, backgroundColor: Colors.bgCardSolid },
  auctionLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: Radius.inline, borderWidth: 1.5, borderBottomWidth: 3, borderColor: Colors.accent, backgroundColor: Colors.bgCard, alignSelf: 'flex-start', ...Elevation.card },
  auctionLinkText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.accent },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha08,
  },
  headerButton: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 2,
    ...Elevation.card,
  },
  refreshButton: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 2,
    ...Elevation.card,
  },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  content: { padding: 18, gap: 12, paddingBottom: 70 },
  starButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  reviewInput: { minHeight: 100, textAlignVertical: 'top', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, color: Colors.textSecondary, backgroundColor: Colors.bgTertiary },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    ...Elevation.card,
  },
  warningCard: { borderColor: Colors.warning, backgroundColor: Colors.bgCard },
  successCard: { borderColor: Colors.accentGreen, backgroundColor: Colors.bgCard },
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
    gap: 12, alignItems: 'stretch',
    borderTopWidth: 1, borderTopColor: Colors.whiteAlpha08, paddingTop: 12,
  },
  providerName: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white },
  quoteMessage: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 6, lineHeight: 18 },
  quoteRight: { alignItems: 'stretch', gap: 7 },
  quotePrice: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  bigPrice: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.white },
  primaryButton: {
    minHeight: 44, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 7,
    borderBottomWidth: 3,
    borderBottomColor: Colors.accentDark,
    ...Elevation.neon,
  },
  primaryText: { flexShrink: 1, textAlign: 'center', fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.onAccent },
  secondaryButton: {
    minHeight: 42, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.borderHi,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 3,
    ...Elevation.card,
  },
  secondaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accent },
  dangerButton: {
    minHeight: 46, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: Colors.accent, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, flexWrap: 'wrap',
    borderBottomWidth: 3,
    borderBottomColor: Colors.accentDark,
    ...Elevation.neon,
  },
  dangerText: { flexShrink: 1, textAlign: 'center', fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.onAccent },
  disabled: { opacity: 0.6 },
  actionRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  cancelButton: { alignSelf: 'center', flexDirection: 'row', gap: 7, alignItems: 'center', padding: 12, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderHi, borderBottomWidth: 3, ...Elevation.card },
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
