import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  completeProviderJob,
  formatPence,
  getProviderJob,
  ServiceJob,
  startProviderJob,
  upsertProviderJobQuote,
  withdrawProviderJobQuote,
} from '../../lib/servicesApi';
import { getOrCreateServiceJobRoom } from '../../lib/chatApi';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderJobDetail'>;

const paidWorkStatuses: ServiceJob['status'][] = [
  'PAID',
  'IN_PROGRESS',
  'COMPLETED',
  'RELEASED',
  'DISPUTED',
];

const labelStatus = (value: string) => value.replace(/_/g, ' ');

export const ProviderJobDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { jobId } = route.params;
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [inspectionOutcome, setInspectionOutcome] = useState<'' | 'PASS' | 'FAULTS_FOUND'>('');
  const [inspectionSummary, setInspectionSummary] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getProviderJob(jobId);
      setJob(next);
      const mine = next.quotes?.[0];
      if (mine?.status === 'ACTIVE') {
        setAmount((mine.amountPence / 100).toFixed(2));
        setMessage(mine.message ?? '');
      }
      if (next.serviceType === 'INSPECTION') {
        setInspectionOutcome(next.inspectionOutcome ?? '');
        setInspectionSummary(next.inspectionSummary ?? '');
      }
    } catch (err: any) {
      setError(err?.message || 'Job not found.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const myQuote = job?.quotes?.[0];
  const amountPence = useMemo(() => {
    const value = Number.parseFloat(amount);
    return Number.isFinite(value) ? Math.round(value * 100) : 0;
  }, [amount]);
  const platformFeePence = amountPence >= 100 ? Math.round(amountPence * 0.09) : 0;
  const providerPence = amountPence - platformFeePence;
  const isAssignedToViewer = job?.viewerRole === 'contractor';
  const canQuote = job?.status === 'OPEN';
  const canChat = Boolean(isAssignedToViewer && job && paidWorkStatuses.includes(job.status));
  const canStart = Boolean(isAssignedToViewer && job?.status === 'PAID');
  const canComplete = Boolean(isAssignedToViewer && job?.status === 'IN_PROGRESS');

  const run = useCallback(async (
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
  }, [load]);

  const openChat = useCallback(async () => {
    if (!canChat) return;
    setBusy('chat');
    setError(null);
    try {
      const result = await getOrCreateServiceJobRoom(jobId);
      navigation.navigate('ChatScreen', { threadId: result.room.id });
    } catch (err: any) {
      setError(err?.message || 'Could not open the job conversation.');
    } finally {
      setBusy(null);
    }
  }, [canChat, jobId, navigation]);

  const submitQuote = () => {
    if (amountPence < 100) {
      setError('Enter a quote of at least £1.00.');
      return;
    }
    void run(
      'quote',
      () => upsertProviderJobQuote(jobId, {
        amountPence,
        message: message.trim() || undefined,
      }),
      myQuote?.status === 'ACTIVE'
        ? 'Quote updated.'
        : 'Quote sent. The customer has been notified.',
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
      'The customer will be asked to confirm. Provider payout releases on confirmation or after the existing automatic release window.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Job',
          onPress: () => void run(
            'complete',
            () => completeProviderJob(
              jobId,
              job.serviceType === 'INSPECTION'
                ? {
                    inspectionOutcome: inspectionOutcome || undefined,
                    inspectionSummary: inspectionSummary.trim() || undefined,
                  }
                : undefined,
            ),
            'Marked complete. Waiting for customer confirmation.',
          ),
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.accent} />
        <Text style={styles.muted}>Loading job…</Text>
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
          <Text style={styles.headerTitle}>Provider Job</Text>
          <HamburgerButton />
        </View>
        <View style={[styles.center, { paddingHorizontal: 24 }]}>
          <Ionicons name="alert-circle-outline" size={30} color={Colors.accent} />
          <Text style={styles.errorText}>{error || 'Job not found.'}</Text>
        </View>
      </View>
    );
  }

  const serviceLocation = job.serviceType === 'INSPECTION'
    ? [job.serviceAddress, job.servicePostcode].filter(Boolean).join(', ')
    : null;

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
        <Text style={styles.headerTitle}>Job Details</Text>
        <HamburgerButton />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {flash ? (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle-outline" size={17} color={Colors.accentGreen} />
            <Text style={styles.successText}>{flash}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={17} color={Colors.accent} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.serviceChip}>
              <Text style={styles.serviceChipText}>
                {job.serviceType === 'INSPECTION' ? 'INSPECTION' : job.isRecovery ? 'RECOVERY' : 'DELIVERY'}
              </Text>
            </View>
            <Text style={styles.statusText}>{labelStatus(job.status)}</Text>
          </View>
          <Text style={styles.title}>{job.title}</Text>
          {!!job.description && <Text style={styles.body}>{job.description}</Text>}

          {job.serviceType === 'DELIVERY' ? (
            <>
              <InfoRow
                icon="navigate-outline"
                label="Collection"
                value={[job.pickupAddress, job.pickupPostcode].filter(Boolean).join(', ') || 'Not supplied'}
              />
              <InfoRow
                icon="flag-outline"
                label="Delivery"
                value={[job.deliveryAddress, job.deliveryPostcode].filter(Boolean).join(', ') || 'Not supplied'}
              />
            </>
          ) : (
            <InfoRow icon="location-outline" label="Inspection location" value={serviceLocation || 'Not supplied'} />
          )}

          {!!job.requestedFor && (
            <InfoRow icon="calendar-outline" label="Requested for" value={new Date(job.requestedFor).toLocaleString('en-GB')} />
          )}

          {job.vehicles?.map((vehicle, index) => (
            <View key={vehicle.id ?? String(index)} style={styles.vehicleBox}>
              <Text style={styles.label}>VEHICLE {job.vehicles.length > 1 ? index + 1 : ''}</Text>
              <Text style={styles.vehicleTitle}>
                {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.registration || 'Vehicle'}
              </Text>
              {!!vehicle.registration && <Text style={styles.muted}>{vehicle.registration}</Text>}
              {!!vehicle.notes && <Text style={styles.body}>{vehicle.notes}</Text>}
            </View>
          ))}
        </View>

        {canQuote && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{myQuote?.status === 'ACTIVE' ? 'Your quote' : 'Quote this job'}</Text>
            <Text style={styles.body}>
              Customer pays your quote through CarMazium. The current TradeXchange split is 9% platform fee / 91% provider share.
            </Text>

            <Text style={styles.label}>QUOTE AMOUNT (£)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
            />
            {amountPence >= 100 && (
              <View style={styles.splitBox}>
                <Text style={styles.muted}>Customer pays {formatPence(amountPence)}</Text>
                <Text style={styles.muted}>CarMazium fee {formatPence(platformFeePence)}</Text>
                <Text style={styles.splitStrong}>You receive {formatPence(providerPence)}</Text>
              </View>
            )}

            <Text style={styles.label}>MESSAGE TO CUSTOMER</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              placeholder="Collection window, inspection timing, vehicle type, anything useful"
              placeholderTextColor={Colors.textMuted}
            />

            <TouchableOpacity
              style={[styles.primaryButton, (busy === 'quote' || amountPence < 100) && styles.disabled]}
              disabled={busy === 'quote' || amountPence < 100}
              onPress={submitQuote}
            >
              {busy === 'quote'
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.primaryText}>{myQuote?.status === 'ACTIVE' ? 'UPDATE QUOTE' : 'SEND QUOTE'}</Text>}
            </TouchableOpacity>

            {myQuote?.status === 'ACTIVE' && (
              <TouchableOpacity
                style={styles.dangerLink}
                disabled={busy === 'withdraw'}
                onPress={() => Alert.alert(
                  'Withdraw quote?',
                  'The customer will no longer be able to accept this quote.',
                  [
                    { text: 'Keep Quote', style: 'cancel' },
                    {
                      text: 'Withdraw',
                      style: 'destructive',
                      onPress: () => void run('withdraw', () => withdrawProviderJobQuote(jobId), 'Quote withdrawn.'),
                    },
                  ],
                )}
              >
                {busy === 'withdraw'
                  ? <ActivityIndicator color={Colors.accent} />
                  : <Text style={styles.dangerText}>WITHDRAW QUOTE</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {isAssignedToViewer && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Your assigned work</Text>
            {job.agreedAmountPence != null && (
              <View style={styles.rowBetween}>
                <Text style={styles.body}>Agreed customer price</Text>
                <Text style={styles.money}>{formatPence(job.agreedAmountPence)}</Text>
              </View>
            )}
            {job.payment && (
              <View style={styles.rowBetween}>
                <Text style={styles.body}>Payment</Text>
                <Text style={styles.money}>{labelStatus(job.payment.status)}</Text>
              </View>
            )}

            {job.customer && paidWorkStatuses.includes(job.status) && (
              <View style={styles.contactBox}>
                <Text style={styles.label}>CUSTOMER</Text>
                <Text style={styles.vehicleTitle}>
                  {[job.customer.firstName, job.customer.lastName].filter(Boolean).join(' ') || 'Customer'}
                </Text>
                {!!job.customer.phone && <Text style={styles.body}>{job.customer.phone}</Text>}
                {!!job.customer.email && <Text style={styles.body}>{job.customer.email}</Text>}
              </View>
            )}

            {canChat && (
              <TouchableOpacity style={styles.secondaryButton} disabled={busy === 'chat'} onPress={() => void openChat()}>
                {busy === 'chat'
                  ? <ActivityIndicator color={Colors.white} />
                  : <>
                      <Ionicons name="chatbubble-ellipses-outline" size={17} color={Colors.white} />
                      <Text style={styles.secondaryText}>MESSAGE CUSTOMER</Text>
                    </>}
              </TouchableOpacity>
            )}

            {job.status === 'ACCEPTED' && (
              <Text style={styles.body}>Your quote was accepted. Waiting for the customer to complete payment.</Text>
            )}

            {canStart && (
              <TouchableOpacity
                style={styles.primaryButton}
                disabled={busy === 'start'}
                onPress={() => void run('start', () => startProviderJob(jobId), 'Job started.')}
              >
                {busy === 'start'
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.primaryText}>START JOB</Text>}
              </TouchableOpacity>
            )}

            {canComplete && (
              <>
                {job.serviceType === 'INSPECTION' && (
                  <View style={styles.inspectionBox}>
                    <Text style={styles.label}>INSPECTION OUTCOME</Text>
                    <View style={styles.choiceRow}>
                      {(['PASS', 'FAULTS_FOUND'] as const).map((outcome) => (
                        <TouchableOpacity
                          key={outcome}
                          style={[styles.choice, inspectionOutcome === outcome && styles.choiceActive]}
                          onPress={() => setInspectionOutcome(outcome)}
                        >
                          <Text style={[styles.choiceText, inspectionOutcome === outcome && styles.choiceTextActive]}>
                            {outcome === 'PASS' ? 'PASS' : 'FAULTS FOUND'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.label}>
                      INSPECTION SUMMARY {inspectionOutcome === 'FAULTS_FOUND' ? '• REQUIRED' : '• OPTIONAL'}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.textarea]}
                      value={inspectionSummary}
                      onChangeText={setInspectionSummary}
                      multiline
                      maxLength={3000}
                      placeholder="Record the inspection result clearly"
                      placeholderTextColor={Colors.textMuted}
                    />
                    {inspectionOutcome === 'FAULTS_FOUND' && (
                      <Text style={styles.warningText}>
                        A verified faults outcome can allow the auction buyer to refuse the vehicle before approved handover and receive the full £125 buyer-fee refund.
                      </Text>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryButton, (
                    busy === 'complete'
                    || (job.serviceType === 'INSPECTION' && !inspectionOutcome)
                    || (job.serviceType === 'INSPECTION' && inspectionOutcome === 'FAULTS_FOUND' && !inspectionSummary.trim())
                  ) && styles.disabled]}
                  disabled={
                    busy === 'complete'
                    || (job.serviceType === 'INSPECTION' && !inspectionOutcome)
                    || (job.serviceType === 'INSPECTION' && inspectionOutcome === 'FAULTS_FOUND' && !inspectionSummary.trim())
                  }
                  onPress={complete}
                >
                  {busy === 'complete'
                    ? <ActivityIndicator color={Colors.white} />
                    : <Text style={styles.primaryText}>MARK COMPLETE</Text>}
                </TouchableOpacity>
              </>
            )}

            {job.status === 'COMPLETED' && (
              <Text style={styles.body}>Waiting for customer confirmation. The existing automatic release window still applies.</Text>
            )}
            {job.status === 'RELEASED' && (
              <Text style={styles.successText}>Job closed and provider payout released.</Text>
            )}
            {job.status === 'DISPUTED' && (
              <Text style={styles.warningText}>This job is in dispute. Keep all communication in the job chat while CarMazium reviews it.</Text>
            )}
          </View>
        )}

        {!isAssignedToViewer && !canQuote && (
          <View style={styles.card}>
            <Text style={styles.body}>This job is no longer open to new provider quotes.</Text>
          </View>
        )}

        <TouchableOpacity style={styles.refreshButton} onPress={() => void load()}>
          <Ionicons name="refresh-outline" size={15} color={Colors.textSecondary} />
          <Text style={styles.refreshText}>REFRESH JOB</Text>
        </TouchableOpacity>
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={Colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Text style={styles.body}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  content: { padding: 18, gap: 14 },
  card: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, padding: 16, gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  serviceChip: { borderRadius: 8, backgroundColor: Colors.accentAlpha10, paddingHorizontal: 8, paddingVertical: 5 },
  serviceChipText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10, letterSpacing: 0.8 },
  statusText: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10 },
  title: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xl },
  sectionTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.base },
  body: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size12, lineHeight: 19 },
  muted: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size12 },
  label: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 1, marginBottom: 3 },
  infoRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: Colors.whiteAlpha08, paddingTop: 10 },
  vehicleBox: { borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha06, padding: 12, gap: 4 },
  vehicleTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.sm },
  input: { borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.bgTertiary, borderRadius: Radius.inline, paddingHorizontal: 13, paddingVertical: 12, color: Colors.white, fontFamily: FontFamily.regular, fontSize: FontSize.sm },
  textarea: { minHeight: 94, textAlignVertical: 'top' },
  splitBox: { borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha06, padding: 11, gap: 3 },
  splitStrong: { fontFamily: FontFamily.bold, color: Colors.accentGreen, fontSize: FontSize.size12 },
  primaryButton: { minHeight: 46, borderRadius: Radius.inline, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size12, letterSpacing: 0.7 },
  secondaryButton: { minHeight: 46, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flexDirection: 'row', gap: 8 },
  secondaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size12 },
  disabled: { opacity: 0.55 },
  dangerLink: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.size10, letterSpacing: 0.8 },
  money: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.sm },
  contactBox: { borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.whiteAlpha06, padding: 12, gap: 4 },
  inspectionBox: { gap: 9, marginTop: 2 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.whiteAlpha10, alignItems: 'center', justifyContent: 'center' },
  choiceActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  choiceText: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10 },
  choiceTextActive: { color: Colors.white },
  warningText: { fontFamily: FontFamily.regular, color: Colors.warning, fontSize: FontSize.size12, lineHeight: 18 },
  successCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.whiteAlpha06, padding: 12 },
  successText: { flex: 1, fontFamily: FontFamily.bold, color: Colors.accentGreen, fontSize: FontSize.size12, lineHeight: 18 },
  errorCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10, padding: 12 },
  errorText: { flex: 1, fontFamily: FontFamily.regular, color: Colors.white, fontSize: FontSize.size12, lineHeight: 18, textAlign: 'center' },
  refreshButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 12 },
  refreshText: { fontFamily: FontFamily.bold, color: Colors.textSecondary, fontSize: FontSize.size10, letterSpacing: 0.8 },
});
