import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
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
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { adaptLegacyLightStyles, mergeAppearanceStyles, appearancePalette, lightReadableText } from '../../theme/appearancePalette';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import {
  SERVICE_LABELS,
  ServiceJob,
  ServiceMarketplaceSettings,
  completeProviderJob,
  formatPence,
  getProviderJob,
  getServiceSettings,
  startProviderJob,
  upsertProviderQuote,
  withdrawProviderQuote,
} from '../../lib/servicesApi';
import { getOrCreateServiceJobRoom } from '../../lib/chatApi';
import { IconButton } from '../../components/IconButton';
import { useAppearance } from '../../theme/useAppearance';
import { ThemedStatusBar } from '../../components/ThemedStatusBar';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderJobDetail'>;

const ACTIVE_JOB_STATUSES = ['PAID', 'IN_PROGRESS', 'COMPLETED', 'RELEASED', 'DISPUTED'];

const routeText = (job: ServiceJob) => {
  if (job.serviceType === 'INSPECTION') return job.servicePostcode || 'Inspection location';
  return `${job.pickupPostcode || 'Pickup'} → ${job.deliveryPostcode || 'Delivery'}`;
};

const requestedText = (job: ServiceJob) => {
  if (!job.requestedFor) return 'ASAP / flexible';
  return new Date(job.requestedFor).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const statusText = (status: ServiceJob['status']) => status.replace(/_/g, ' ');

export const ProviderJobDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { tc } = useAppearance();
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(adaptLegacyLightStyles(styles), lightContrastStyles) : styles;
  const insets = useSafeAreaInsets();
  const { jobId } = route.params;

  const [job, setJob] = useState<ServiceJob | null>(null);
  const [settings, setSettings] = useState<ServiceMarketplaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [inspectionOutcome, setInspectionOutcome] = useState<'' | 'PASS' | 'FAULTS_FOUND'>('');
  const [inspectionSummary, setInspectionSummary] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextJob, nextSettings] = await Promise.all([
        getProviderJob(jobId),
        getServiceSettings().catch(() => null),
      ]);
      setJob(nextJob);
      setSettings(nextSettings);

      const mine = nextJob.quotes?.[0];
      if (mine?.status === 'ACTIVE') {
        setAmount((mine.amountPence / 100).toFixed(2));
        setQuoteMessage(mine.message || '');
      }
      setInspectionOutcome(nextJob.inspectionOutcome || '');
      setInspectionSummary(nextJob.inspectionSummary || '');
    } catch (err: any) {
      setError(err?.message || 'Could not load this job.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // After messaging a customer or returning from a payment update, re-check
  // authoritative job/quote status, not the previously visible action.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const myQuote = job?.quotes?.[0];
  const isMine = job?.viewerRole === 'contractor';
  const canQuote = job?.status === 'OPEN';
  const nextStep = job?.status === 'OPEN'
    ? 'Review the vehicle and location, then send a quote. You cannot start work until the customer accepts and pays.'
    : job?.status === 'ACCEPTED'
      ? 'Your quote was accepted. Wait for the customer’s service payment before beginning.'
      : job?.status === 'PAID'
        ? 'Payment has been confirmed. Start the job when you begin the work.'
        : job?.status === 'IN_PROGRESS'
          ? 'Record the inspection outcome or finish the transport, then mark the work complete for customer review.'
          : job?.status === 'COMPLETED'
            ? 'The customer can now confirm the work. Payout follows confirmation or the configured auto-release period.'
            : job?.status === 'DISPUTED'
              ? 'A dispute is open. Wait for CarMazium to review before taking further payout actions.'
              : job?.status === 'RELEASED'
                ? 'The service payout has been released.'
                : 'Check the service details and current status below.';
  const canMessageCustomer = Boolean(
    isMine && job && ACTIVE_JOB_STATUSES.includes(job.status),
  );

  const amountPence = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [amount]);

  const providerPence = useMemo(() => {
    if (amountPence < 1) return null;
    const feeRate = settings?.platformFeeRate;
    if (feeRate == null) return null;
    return amountPence - Math.round(amountPence * feeRate);
  }, [amountPence, settings?.platformFeeRate]);

  const run = async (
    key: string,
    action: () => Promise<unknown>,
    success: string,
  ) => {
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

  const sendQuote = async () => {
    if (!job || amountPence < 100) {
      setError('Enter a quote of at least £1.00.');
      return;
    }
    await run(
      'quote',
      () => upsertProviderQuote(job.id, {
        amountPence,
        message: quoteMessage.trim() || undefined,
      }),
      myQuote?.status === 'ACTIVE'
        ? 'Quote updated.'
        : 'Quote sent. The customer has been notified.',
    );
  };

  const withdraw = () => {
    if (!job) return;
    Alert.alert(
      'Withdraw quote?',
      'The customer will no longer be able to accept this quote.',
      [
        { text: 'Keep quote', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: () => void run(
            'withdraw',
            () => withdrawProviderQuote(job.id),
            'Quote withdrawn.',
          ),
        },
      ],
    );
  };

  const start = () => {
    if (!job) return;
    Alert.alert(
      'Start this job?',
      'This marks the work as in progress for the customer.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => void run(
            'start',
            () => startProviderJob(job.id),
            'Job marked as started.',
          ),
        },
      ],
    );
  };

  const complete = () => {
    if (!job) return;
    if (job.serviceType === 'INSPECTION' && !inspectionOutcome) {
      setError('Choose the inspection outcome before completing the job.');
      return;
    }
    if (
      job.serviceType === 'INSPECTION'
      && inspectionOutcome === 'FAULTS_FOUND'
      && !inspectionSummary.trim()
    ) {
      setError('Describe the faults found before completing the inspection.');
      return;
    }

    Alert.alert(
      'Mark job complete?',
      'The customer will be asked to confirm. Provider payout releases after confirmation or the backend auto-release period.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => void run(
            'complete',
            () => completeProviderJob(
              job.id,
              job.serviceType === 'INSPECTION'
                ? {
                    inspectionOutcome: inspectionOutcome || undefined,
                    inspectionSummary: inspectionSummary.trim() || undefined,
                  }
                : undefined,
            ),
            'Job marked complete.',
          ),
        },
      ],
    );
  };

  const openChat = async () => {
    if (!job) return;
    setBusy('chat');
    setError(null);
    try {
      const room = await getOrCreateServiceJobRoom(job.id);
      navigation.navigate('ChatScreen', { threadId: room.id });
    } catch (err: any) {
      setError(err?.message || 'Could not open the job conversation.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <View style={[ts.container, ts.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[ts.container, { paddingTop: insets.top }]}>
        <View style={ts.header}>
          <IconButton
            style={ts.headerButton}
            icon={<Ionicons name="chevron-back" size={19} color={tc(Colors.white)} />}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
          />
          <Text style={ts.headerTitle}>Partner Job</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={ts.centerCard}>
          <Ionicons name="alert-circle-outline" size={34} color={Colors.accent} />
          <Text style={ts.cardTitle}>Job unavailable</Text>
          <Text style={ts.bodyText}>{error || 'This job could not be loaded.'}</Text>
          <TouchableOpacity style={ts.primaryButton} onPress={() => void load()}>
            <Text style={ts.primaryText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[ts.container, { paddingTop: insets.top }]}>
      <ThemedStatusBar />

      <View style={ts.header}>
        <IconButton
          style={ts.headerButton}
          icon={<Ionicons name="chevron-back" size={19} color={tc(Colors.white)} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <View style={{ flex: 1 }}>
          <Text style={ts.headerTitle}>Partner Job</Text>
          <Text style={ts.headerSub}>{SERVICE_LABELS[job.serviceType]}</Text>
        </View>
        <View style={ts.statusPill}>
          <Text style={ts.statusText}>{statusText(job.status)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={ts.content} showsVerticalScrollIndicator={false}>
        {flash ? (
          <View style={ts.successCard}>
            <Ionicons name="checkmark-circle-outline" size={18} color={tc(Colors.accentGreen)} />
            <Text style={ts.successText}>{flash}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={ts.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.accent} />
            <Text style={ts.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={ts.nextStepCard}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={ts.nextStepLabel}>WHAT HAPPENS NEXT</Text>
            <Text style={ts.bodyText}>{nextStep}</Text>
          </View>
        </View>

        <View style={ts.card}>
          <Text style={ts.eyebrow}>
            {job.serviceType === 'DELIVERY' && job.isRecovery ? 'RECOVERY' : SERVICE_LABELS[job.serviceType].toUpperCase()}
          </Text>
          <Text style={ts.title}>{job.title}</Text>

          <View style={ts.infoRow}>
            <Ionicons name="location-outline" size={16} color={Colors.accent} />
            <Text style={ts.infoText}>{routeText(job)}</Text>
          </View>
          <View style={ts.infoRow}>
            <Ionicons name="time-outline" size={16} color={tc(Colors.warning)} />
            <Text style={ts.infoText}>{requestedText(job)}</Text>
          </View>

          {job.description ? <Text style={ts.description}>{job.description}</Text> : null}
        </View>

        {isMine && (
          job.pickupAddress || job.deliveryAddress || job.serviceAddress
        ) ? (
          <View style={ts.card}>
            <Text style={ts.cardTitle}>Full job location</Text>
            {job.pickupAddress ? (
              <Info label="Pickup" value={`${job.pickupAddress}, ${job.pickupPostcode || ''}`} />
            ) : null}
            {job.deliveryAddress ? (
              <Info label="Delivery" value={`${job.deliveryAddress}, ${job.deliveryPostcode || ''}`} />
            ) : null}
            {job.serviceAddress ? (
              <Info label="Inspection" value={`${job.serviceAddress}, ${job.servicePostcode || ''}`} />
            ) : null}
          </View>
        ) : null}

        <View style={ts.card}>
          <Text style={ts.cardTitle}>Vehicle{job.vehicles.length === 1 ? '' : 's'}</Text>
          {job.vehicles.length ? job.vehicles.map((vehicle, index) => (
            <View key={vehicle.id || `${vehicle.registration || 'vehicle'}-${index}`} style={ts.vehicleRow}>
              <Ionicons name="car-outline" size={18} color={tc(Colors.textMuted)} />
              <View style={{ flex: 1 }}>
                <Text style={ts.vehicleTitle}>
                  {[vehicle.registration, vehicle.make, vehicle.model].filter(Boolean).join(' · ') || `Vehicle ${index + 1}`}
                </Text>
                <Text style={ts.smallText}>
                  {[vehicle.year, vehicle.notes].filter(Boolean).join(' · ') || 'No extra vehicle notes'}
                </Text>
              </View>
            </View>
          )) : <Text style={ts.bodyText}>No vehicle details supplied.</Text>}
        </View>

        {canQuote ? (
          <View style={ts.card}>
            <Text style={ts.cardTitle}>
              {myQuote?.status === 'ACTIVE' ? 'Your quote' : 'Quote this job'}
            </Text>

            <Text style={ts.label}>Customer price</Text>
            <View style={ts.moneyInput}>
              <Text style={ts.currency}>£</Text>
              <TextInput
                style={ts.moneyField}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={tc(Colors.textMuted)}
                keyboardType="decimal-pad"
              />
            </View>

            {providerPence != null ? (
              <Text style={ts.payoutHint}>
                Customer pays {formatPence(amountPence)}. Your business receives approximately {formatPence(providerPence)} after the current CarMazium platform fee.
              </Text>
            ) : null}

            <Text style={ts.label}>Quote message</Text>
            <TextInput
              style={[ts.input, ts.textArea]}
              value={quoteMessage}
              onChangeText={setQuoteMessage}
              multiline
              maxLength={1000}
              placeholder="Collection window, vehicle type, anything that helps the customer choose you"
              placeholderTextColor={tc(Colors.textMuted)}
            />

            <TouchableOpacity
              style={[ts.primaryButton, (busy === 'quote' || amountPence < 100) && ts.disabled]}
              disabled={busy === 'quote' || amountPence < 100}
              onPress={() => void sendQuote()}
            >
              {busy === 'quote'
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={ts.primaryText}>
                    {myQuote?.status === 'ACTIVE' ? 'UPDATE QUOTE' : 'SEND QUOTE'}
                  </Text>}
            </TouchableOpacity>

            {myQuote?.status === 'ACTIVE' ? (
              <TouchableOpacity
                style={ts.dangerButton}
                disabled={busy === 'withdraw'}
                onPress={withdraw}
              >
                {busy === 'withdraw'
                  ? <ActivityIndicator color={Colors.accent} />
                  : <Text style={ts.dangerText}>WITHDRAW QUOTE</Text>}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {isMine && job.agreedAmountPence != null ? (
          <View style={ts.card}>
            <Text style={ts.cardTitle}>Your payout</Text>
            <Text style={ts.payoutAmount}>
              {formatPence(job.contractorAmountPence ?? 0)}
            </Text>
            <Text style={ts.bodyText}>
              From {formatPence(job.agreedAmountPence)} customer price. {
                job.payment?.status === 'RELEASED'
                  ? 'Transferred to your Stripe business account.'
                  : job.payment?.status === 'PAID'
                    ? 'Held by CarMazium until customer confirmation or auto-release.'
                    : 'Waiting for customer payment.'
              }
            </Text>
          </View>
        ) : null}

        {isMine && job.customer && ACTIVE_JOB_STATUSES.includes(job.status) ? (
          <View style={ts.card}>
            <Text style={ts.cardTitle}>Customer</Text>
            <Text style={ts.customerName}>
              {[job.customer.firstName, job.customer.lastName].filter(Boolean).join(' ') || 'Customer'}
            </Text>
            {job.customer.phone ? (
              <TouchableOpacity
                style={ts.contactRow}
                onPress={() => void Linking.openURL(`tel:${job.customer?.phone}`)}
              >
                <Ionicons name="call-outline" size={16} color={Colors.accent} />
                <Text style={ts.contactText}>{job.customer.phone}</Text>
              </TouchableOpacity>
            ) : null}
            {job.customer.email ? (
              <TouchableOpacity
                style={ts.contactRow}
                onPress={() => void Linking.openURL(`mailto:${job.customer?.email}`)}
              >
                <Ionicons name="mail-outline" size={16} color={Colors.accent} />
                <Text style={ts.contactText}>{job.customer.email}</Text>
              </TouchableOpacity>
            ) : null}
            {canMessageCustomer ? (
              <TouchableOpacity
                style={ts.secondaryButton}
                disabled={busy === 'chat'}
                onPress={() => void openChat()}
              >
                {busy === 'chat'
                  ? <ActivityIndicator color={tc(Colors.white)} />
                  : <>
                      <Ionicons name="chatbubble-ellipses-outline" size={17} color={tc(Colors.white)} />
                      <Text style={ts.secondaryText}>MESSAGE CUSTOMER</Text>
                    </>}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {isMine && (job.status === 'PAID' || job.status === 'IN_PROGRESS') ? (
          <View style={ts.card}>
            <Text style={ts.cardTitle}>Work status</Text>

            {job.status === 'PAID' ? (
              <>
                <Text style={ts.bodyText}>Customer payment is confirmed. Start the job when work begins.</Text>
                <TouchableOpacity
                  style={ts.primaryButton}
                  disabled={busy === 'start'}
                  onPress={start}
                >
                  {busy === 'start'
                    ? <ActivityIndicator color={Colors.white} />
                    : <Text style={ts.primaryText}>START JOB</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {job.serviceType === 'INSPECTION' ? (
                  <>
                    <Text style={ts.label}>Inspection outcome</Text>
                    <View style={ts.choiceRow}>
                      <TouchableOpacity
                        style={[ts.choice, inspectionOutcome === 'PASS' && ts.choiceActive]}
                        onPress={() => setInspectionOutcome('PASS')}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: inspectionOutcome === 'PASS' }}
                        accessibilityLabel="Inspection passed"
                      >
                        <Text style={[ts.choiceText, inspectionOutcome === 'PASS' && ts.choiceTextActive]}>
                          PASS
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[ts.choice, inspectionOutcome === 'FAULTS_FOUND' && ts.choiceActiveWarning]}
                        onPress={() => setInspectionOutcome('FAULTS_FOUND')}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: inspectionOutcome === 'FAULTS_FOUND' }}
                        accessibilityLabel="Faults found at inspection"
                      >
                        <Text style={[ts.choiceText, inspectionOutcome === 'FAULTS_FOUND' && ts.choiceTextWarning]}>
                          FAULTS FOUND
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={ts.label}>
                      Inspection summary {inspectionOutcome === 'FAULTS_FOUND' ? '· required' : '· optional'}
                    </Text>
                    <TextInput
                      style={[ts.input, ts.textArea]}
                      value={inspectionSummary}
                      onChangeText={setInspectionSummary}
                      multiline
                      maxLength={2000}
                      placeholder="Condition, checks completed and any faults found"
                      placeholderTextColor={tc(Colors.textMuted)}
                    />

                    {inspectionOutcome === 'FAULTS_FOUND' ? (
                      <View style={ts.warningCard}>
                        <Ionicons name="warning-outline" size={16} color={tc(Colors.warning)} />
                        <Text style={ts.warningText}>
                          A verified fault outcome can allow a linked auction buyer to refuse the vehicle before approved handover and receive the full buyer-fee refund.
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : null}

                <TouchableOpacity
                  style={[
                    ts.primaryButton,
                    (
                      busy === 'complete'
                      || (job.serviceType === 'INSPECTION' && !inspectionOutcome)
                      || (
                        job.serviceType === 'INSPECTION'
                        && inspectionOutcome === 'FAULTS_FOUND'
                        && !inspectionSummary.trim()
                      )
                    ) && ts.disabled,
                  ]}
                  disabled={
                    busy === 'complete'
                    || (job.serviceType === 'INSPECTION' && !inspectionOutcome)
                    || (
                      job.serviceType === 'INSPECTION'
                      && inspectionOutcome === 'FAULTS_FOUND'
                      && !inspectionSummary.trim()
                    )
                  }
                  onPress={complete}
                >
                  {busy === 'complete'
                    ? <ActivityIndicator color={Colors.white} />
                    : <Text style={ts.primaryText}>MARK COMPLETE</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        {isMine && job.status === 'ACCEPTED' ? (
          <View style={ts.noticeCard}>
            <Text style={ts.bodyText}>
              Your quote was accepted. Waiting for customer payment{
                settings ? ` within ${settings.acceptedPaymentTimeoutMinutes} minutes` : ''
              }. If payment is not completed, the backend safely reopens the job.
            </Text>
          </View>
        ) : null}

        {isMine && job.status === 'COMPLETED' ? (
          <View style={ts.noticeCard}>
            <Text style={ts.bodyText}>
              Waiting for the customer to confirm completion. The backend auto-releases payout after the configured confirmation period.
            </Text>
          </View>
        ) : null}

        {!isMine && !canQuote ? (
          <View style={ts.noticeCard}>
            <Text style={ts.bodyText}>This job is no longer open for quoting.</Text>
          </View>
        ) : null}

        <View style={{ height: 36 }} />
      </ScrollView>
    </View>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => {
  const mode = useAppearanceStore(state => state.mode);
  const ts = mode === 'light' ? mergeAppearanceStyles(adaptLegacyLightStyles(styles), lightContrastStyles) : styles;
  return (
  <View style={ts.infoLine}>
    <Text style={ts.infoLabel}>{label}</Text>
    <Text style={ts.infoValue}>{value}</Text>
  </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },
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
  statusPill: { borderRadius: 999, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha08, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textSecondary },
  content: { padding: 18, gap: 12 },
  centerCard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  card: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgCardSolid, padding: 16, gap: 12 },
  nextStepCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: Colors.borderHi, borderRadius: Radius.card, backgroundColor: Colors.bgCardSolid, padding: 15 },
  nextStepLabel: { color: Colors.accent, fontFamily: FontFamily.bold, fontSize: FontSize.xs, marginBottom: 5 },
  noticeCard: { borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.whiteAlpha06, padding: 14 },
  successCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.whiteAlpha06, padding: 12 },
  successText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.size12, color: Colors.accentGreen },
  errorCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10, padding: 12 },
  errorText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.paleRed_fca5a5, lineHeight: 18 },
  warningCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.whiteAlpha06, padding: 12 },
  warningText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.warningLight, lineHeight: 18 },
  eyebrow: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.size10, letterSpacing: 1.2 },
  title: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xl },
  cardTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.base },
  bodyText: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size12, lineHeight: 19 },
  description: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size12, lineHeight: 20, marginTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { flex: 1, fontFamily: FontFamily.medium, color: Colors.textSecondary, fontSize: FontSize.size12 },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha08, paddingBottom: 9 },
  infoLabel: { fontFamily: FontFamily.medium, color: Colors.textMuted, fontSize: FontSize.xs },
  infoValue: { flex: 1, fontFamily: FontFamily.medium, color: Colors.white, fontSize: FontSize.xs, textAlign: 'right' },
  vehicleRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 3 },
  vehicleTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size12 },
  smallText: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size10, marginTop: 2 },
  label: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 0.8, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.bgTertiary, borderRadius: Radius.inline, paddingHorizontal: 13, paddingVertical: 11, color: Colors.white, fontFamily: FontFamily.regular, fontSize: FontSize.sm },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  moneyInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.bgTertiary, borderRadius: Radius.inline, paddingHorizontal: 13 },
  currency: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.base },
  moneyField: { flex: 1, paddingVertical: 11, paddingHorizontal: 8, color: Colors.white, fontFamily: FontFamily.bold, fontSize: FontSize.base },
  payoutHint: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size10, lineHeight: 16 },
  payoutAmount: { fontFamily: FontFamily.bold, color: Colors.accentGreen, fontSize: FontSize.xl },
  customerName: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  contactText: { fontFamily: FontFamily.medium, color: Colors.accent, fontSize: FontSize.size12 },
  primaryButton: { minHeight: 46, borderRadius: Radius.inline, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xs, letterSpacing: 0.7 },
  secondaryButton: { minHeight: 44, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  secondaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xs },
  dangerButton: { minHeight: 42, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.accentAlpha25, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.xs },
  disabled: { opacity: 0.55 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.whiteAlpha06 },
  choiceActive: { borderColor: Colors.accentGreen, backgroundColor: Colors.whiteAlpha06 },
  choiceActiveWarning: { borderColor: Colors.warning, backgroundColor: Colors.whiteAlpha06 },
  choiceText: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10 },
  choiceTextActive: { color: Colors.accentGreen },
  choiceTextWarning: { color: Colors.warning },
});

const LIGHT_PALETTE = appearancePalette('light');

// Light-mode text colours for keys the screen's light map did not cover.
// Generated from the contrast audit (scripts/theme-audit); dark mode is untouched.
const lightContrastStyles = StyleSheet.create({
  headerSub: { color: LIGHT_PALETTE.muted },
  statusText: { color: LIGHT_PALETTE.secondary },
  currency: { color: LIGHT_PALETTE.muted },
  moneyField: { color: LIGHT_PALETTE.text },
  input: { color: LIGHT_PALETTE.text },
  dangerText: { color: lightReadableText.accent },
});
