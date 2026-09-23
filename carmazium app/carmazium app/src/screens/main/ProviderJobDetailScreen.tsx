import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
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

  useEffect(() => { void load(); }, [load]);

  const myQuote = job?.quotes?.[0];
  const isMine = job?.viewerRole === 'contractor';
  const canQuote = job?.status === 'OPEN';
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
          <Text style={styles.headerTitle}>Partner Job</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centerCard}>
          <Ionicons name="alert-circle-outline" size={34} color={Colors.accent} />
          <Text style={styles.cardTitle}>Job unavailable</Text>
          <Text style={styles.bodyText}>{error || 'This job could not be loaded.'}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void load()}>
            <Text style={styles.primaryText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Partner Job</Text>
          <Text style={styles.headerSub}>{SERVICE_LABELS[job.serviceType]}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{statusText(job.status)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {flash ? (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle-outline" size={18} color={Colors.accentGreen} />
            <Text style={styles.successText}>{flash}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.accent} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.eyebrow}>
            {job.serviceType === 'DELIVERY' && job.isRecovery ? 'RECOVERY' : SERVICE_LABELS[job.serviceType].toUpperCase()}
          </Text>
          <Text style={styles.title}>{job.title}</Text>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={Colors.accent} />
            <Text style={styles.infoText}>{routeText(job)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color={Colors.warning} />
            <Text style={styles.infoText}>{requestedText(job)}</Text>
          </View>

          {job.description ? <Text style={styles.description}>{job.description}</Text> : null}
        </View>

        {isMine && (
          job.pickupAddress || job.deliveryAddress || job.serviceAddress
        ) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Full job location</Text>
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle{job.vehicles.length === 1 ? '' : 's'}</Text>
          {job.vehicles.length ? job.vehicles.map((vehicle, index) => (
            <View key={vehicle.id || `${vehicle.registration || 'vehicle'}-${index}`} style={styles.vehicleRow}>
              <Ionicons name="car-outline" size={18} color={Colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleTitle}>
                  {[vehicle.registration, vehicle.make, vehicle.model].filter(Boolean).join(' · ') || `Vehicle ${index + 1}`}
                </Text>
                <Text style={styles.smallText}>
                  {[vehicle.year, vehicle.notes].filter(Boolean).join(' · ') || 'No extra vehicle notes'}
                </Text>
              </View>
            </View>
          )) : <Text style={styles.bodyText}>No vehicle details supplied.</Text>}
        </View>

        {canQuote ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {myQuote?.status === 'ACTIVE' ? 'Your quote' : 'Quote this job'}
            </Text>

            <Text style={styles.label}>Customer price</Text>
            <View style={styles.moneyInput}>
              <Text style={styles.currency}>£</Text>
              <TextInput
                style={styles.moneyField}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>

            {providerPence != null ? (
              <Text style={styles.payoutHint}>
                Customer pays {formatPence(amountPence)}. Your business receives approximately {formatPence(providerPence)} after the current CarMazium platform fee.
              </Text>
            ) : null}

            <Text style={styles.label}>Quote message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={quoteMessage}
              onChangeText={setQuoteMessage}
              multiline
              maxLength={1000}
              placeholder="Collection window, vehicle type, anything that helps the customer choose you"
              placeholderTextColor={Colors.textMuted}
            />

            <TouchableOpacity
              style={[styles.primaryButton, (busy === 'quote' || amountPence < 100) && styles.disabled]}
              disabled={busy === 'quote' || amountPence < 100}
              onPress={() => void sendQuote()}
            >
              {busy === 'quote'
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.primaryText}>
                    {myQuote?.status === 'ACTIVE' ? 'UPDATE QUOTE' : 'SEND QUOTE'}
                  </Text>}
            </TouchableOpacity>

            {myQuote?.status === 'ACTIVE' ? (
              <TouchableOpacity
                style={styles.dangerButton}
                disabled={busy === 'withdraw'}
                onPress={withdraw}
              >
                {busy === 'withdraw'
                  ? <ActivityIndicator color={Colors.accent} />
                  : <Text style={styles.dangerText}>WITHDRAW QUOTE</Text>}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {isMine && job.agreedAmountPence != null ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your payout</Text>
            <Text style={styles.payoutAmount}>
              {formatPence(job.contractorAmountPence ?? 0)}
            </Text>
            <Text style={styles.bodyText}>
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
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Customer</Text>
            <Text style={styles.customerName}>
              {[job.customer.firstName, job.customer.lastName].filter(Boolean).join(' ') || 'Customer'}
            </Text>
            {job.customer.phone ? (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => void Linking.openURL(`tel:${job.customer?.phone}`)}
              >
                <Ionicons name="call-outline" size={16} color={Colors.accent} />
                <Text style={styles.contactText}>{job.customer.phone}</Text>
              </TouchableOpacity>
            ) : null}
            {job.customer.email ? (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => void Linking.openURL(`mailto:${job.customer?.email}`)}
              >
                <Ionicons name="mail-outline" size={16} color={Colors.accent} />
                <Text style={styles.contactText}>{job.customer.email}</Text>
              </TouchableOpacity>
            ) : null}
            {canMessageCustomer ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                disabled={busy === 'chat'}
                onPress={() => void openChat()}
              >
                {busy === 'chat'
                  ? <ActivityIndicator color={Colors.white} />
                  : <>
                      <Ionicons name="chatbubble-ellipses-outline" size={17} color={Colors.white} />
                      <Text style={styles.secondaryText}>MESSAGE CUSTOMER</Text>
                    </>}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {isMine && (job.status === 'PAID' || job.status === 'IN_PROGRESS') ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Work status</Text>

            {job.status === 'PAID' ? (
              <>
                <Text style={styles.bodyText}>Customer payment is confirmed. Start the job when work begins.</Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  disabled={busy === 'start'}
                  onPress={start}
                >
                  {busy === 'start'
                    ? <ActivityIndicator color={Colors.white} />
                    : <Text style={styles.primaryText}>START JOB</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {job.serviceType === 'INSPECTION' ? (
                  <>
                    <Text style={styles.label}>Inspection outcome</Text>
                    <View style={styles.choiceRow}>
                      <TouchableOpacity
                        style={[styles.choice, inspectionOutcome === 'PASS' && styles.choiceActive]}
                        onPress={() => setInspectionOutcome('PASS')}
                      >
                        <Text style={[styles.choiceText, inspectionOutcome === 'PASS' && styles.choiceTextActive]}>
                          PASS
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.choice, inspectionOutcome === 'FAULTS_FOUND' && styles.choiceActiveWarning]}
                        onPress={() => setInspectionOutcome('FAULTS_FOUND')}
                      >
                        <Text style={[styles.choiceText, inspectionOutcome === 'FAULTS_FOUND' && styles.choiceTextWarning]}>
                          FAULTS FOUND
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>
                      Inspection summary {inspectionOutcome === 'FAULTS_FOUND' ? '· required' : '· optional'}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={inspectionSummary}
                      onChangeText={setInspectionSummary}
                      multiline
                      maxLength={2000}
                      placeholder="Condition, checks completed and any faults found"
                      placeholderTextColor={Colors.textMuted}
                    />

                    {inspectionOutcome === 'FAULTS_FOUND' ? (
                      <View style={styles.warningCard}>
                        <Ionicons name="warning-outline" size={16} color={Colors.warning} />
                        <Text style={styles.warningText}>
                          A verified fault outcome can allow a linked auction buyer to refuse the vehicle before approved handover and receive the full buyer-fee refund.
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (
                      busy === 'complete'
                      || (job.serviceType === 'INSPECTION' && !inspectionOutcome)
                      || (
                        job.serviceType === 'INSPECTION'
                        && inspectionOutcome === 'FAULTS_FOUND'
                        && !inspectionSummary.trim()
                      )
                    ) && styles.disabled,
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
                    : <Text style={styles.primaryText}>MARK COMPLETE</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        {isMine && job.status === 'ACCEPTED' ? (
          <View style={styles.noticeCard}>
            <Text style={styles.bodyText}>
              Your quote was accepted. Waiting for customer payment{
                settings ? ` within ${settings.acceptedPaymentTimeoutMinutes} minutes` : ''
              }. If payment is not completed, the backend safely reopens the job.
            </Text>
          </View>
        ) : null}

        {isMine && job.status === 'COMPLETED' ? (
          <View style={styles.noticeCard}>
            <Text style={styles.bodyText}>
              Waiting for the customer to confirm completion. The backend auto-releases payout after the configured confirmation period.
            </Text>
          </View>
        ) : null}

        {!isMine && !canQuote ? (
          <View style={styles.noticeCard}>
            <Text style={styles.bodyText}>This job is no longer open for quoting.</Text>
          </View>
        ) : null}

        <View style={{ height: 36 }} />
      </ScrollView>
    </View>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoLine}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

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
  card: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, padding: 16, gap: 12 },
  noticeCard: { borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.whiteAlpha06, padding: 14 },
  successCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.whiteAlpha06, padding: 12 },
  successText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.size12, color: Colors.accentGreen },
  errorCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10, padding: 12 },
  errorText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.paleRed_fca5a5, lineHeight: 18 },
  warningCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.whiteAlpha06, padding: 12 },
  warningText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size11, color: Colors.warning, lineHeight: 18 },
  eyebrow: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.size10, letterSpacing: 1.2 },
  title: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xl },
  cardTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.base },
  bodyText: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size12, lineHeight: 19 },
  description: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size12, lineHeight: 20, marginTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { flex: 1, fontFamily: FontFamily.medium, color: Colors.textSecondary, fontSize: FontSize.size12 },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha08, paddingBottom: 9 },
  infoLabel: { fontFamily: FontFamily.medium, color: Colors.textMuted, fontSize: FontSize.size11 },
  infoValue: { flex: 1, fontFamily: FontFamily.medium, color: Colors.white, fontSize: FontSize.size11, textAlign: 'right' },
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
  primaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size11, letterSpacing: 0.7 },
  secondaryButton: { minHeight: 44, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  secondaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size11 },
  dangerButton: { minHeight: 42, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.accentAlpha25, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.size11 },
  disabled: { opacity: 0.55 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.whiteAlpha06 },
  choiceActive: { borderColor: Colors.accentGreen, backgroundColor: Colors.whiteAlpha06 },
  choiceActiveWarning: { borderColor: Colors.warning, backgroundColor: Colors.whiteAlpha06 },
  choiceText: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10 },
  choiceTextActive: { color: Colors.accentGreen },
  choiceTextWarning: { color: Colors.warning },
});
