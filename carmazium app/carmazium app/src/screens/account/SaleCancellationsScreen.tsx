import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { IconButton } from '../../components/IconButton';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { adaptLegacyLightStyles, mergeAppearanceStyles, appearancePalette, lightReadableText } from '../../theme/appearancePalette';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import {
  getMySaleCancellations,
  respondToSaleCancellation,
  SALE_CANCELLATION_REASON_LABELS,
  withdrawSaleCancellation,
  type SaleCancellationRequest,
} from '../../lib/saleCancellationApi';
import { haptics } from '../../lib/haptics';
import { useAppearance } from '../../theme/useAppearance';
import { ThemedStatusBar } from '../../components/ThemedStatusBar';

const STATUS_LABEL: Record<string, string> = {
  PENDING_COUNTERPARTY: 'Waiting for other party',
  PENDING_ADMIN: 'Waiting for CarMazium review',
  APPROVED: 'Cancelled',
  REJECTED: 'Cancellation declined',
  WITHDRAWN: 'Request withdrawn',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING_COUNTERPARTY: Colors.warning,
  PENDING_ADMIN: Colors.infoBlue,
  APPROVED: Colors.success,
  REJECTED: Colors.error,
  WITHDRAWN: Colors.textMuted,
};

export const SaleCancellationsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { tc } = useAppearance();
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(adaptLegacyLightStyles(styles), lightContrastStyles) : styles;
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<SaleCancellationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setRequests(await getMySaleCancellations());
    } catch (err: any) {
      setError(err?.message || 'Could not load cancellation requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const respond = (request: SaleCancellationRequest, decision: 'ACCEPT' | 'REJECT') => {
    const accept = decision === 'ACCEPT';
    Alert.alert(
      accept ? 'Agree to cancel sale?' : 'Decline cancellation?',
      accept
        ? 'This confirms that you agree to cancel the vehicle sale. Some cases may still require CarMazium admin review.'
        : 'The sale will remain in place and the requester will be notified.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: accept ? 'Agree & Continue' : 'Decline',
          style: accept ? 'default' : 'destructive',
          onPress: async () => {
            setBusyId(request.id);
            try {
              await respondToSaleCancellation(request.id, decision);
              accept ? haptics.success() : haptics.medium();
              await load(true);
            } catch (err: any) {
              Alert.alert('Could not update request', err?.message || 'Please try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const withdraw = (request: SaleCancellationRequest) => {
    Alert.alert(
      'Withdraw request?',
      'The cancellation request will close and the sale will remain in place.',
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            setBusyId(request.id);
            try {
              await withdrawSaleCancellation(request.id);
              haptics.medium();
              await load(true);
            } catch (err: any) {
              Alert.alert('Could not withdraw request', err?.message || 'Please try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={ts.container}>
      <ThemedStatusBar />
      <LinearGradient
        colors={appearanceMode === 'light' ? ['#EEF5FB', '#F7FBFF'] : [Colors.accentAlpha04, Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ height: insets.top }} />

      <View style={ts.header}>
        <IconButton
          style={ts.backBtn}
          icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />}
          onPress={() => navigation?.goBack()}
          accessibilityLabel="Go back"
        />
        <View style={{ flex: 1 }}>
          <Text style={ts.headerTitle}>Sale Cancellations</Text>
          <Text style={ts.headerSub}>Buyer & seller protection</Text>
        </View>
        <View style={ts.headerSpacer} />
      </View>

      <ScrollView
        style={ts.scroll}
        contentContainerStyle={ts.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error && <ErrorBanner message={error} onRetry={() => void load(false)} />}

        {loading ? (
          <View style={ts.loading}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : requests.length === 0 ? (
          <EmptyState
            icon="shield-checkmark-outline"
            title="No cancellation requests"
            subtitle="Requests involving your vehicle sales or purchases will appear here."
          />
        ) : (
          requests.map(request => {
            const statusColor = STATUS_COLOR[request.status] || Colors.textMuted;
            const isBusy = busyId === request.id;
            return (
              <View key={request.id} style={ts.card}>
                <View style={ts.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={ts.vehicleTitle} numberOfLines={2}>
                      {request.listing?.title || 'Vehicle sale'}
                    </Text>
                    <Text style={ts.meta}>
                      {request.requestedByRole === 'BUYER' ? 'Buyer requested' : 'Seller requested'}
                      {' · '}
                      {new Date(request.createdAt).toLocaleDateString('en-GB')}
                    </Text>
                  </View>
                  <View style={[ts.statusChip, { borderColor: statusColor }]}>
                    <Text style={[ts.statusText, { color: statusColor }]}>
                      {STATUS_LABEL[request.status] || request.status}
                    </Text>
                  </View>
                </View>

                <View style={ts.infoBox}>
                  <Text style={ts.label}>REASON</Text>
                  <Text style={ts.reason}>
                    {SALE_CANCELLATION_REASON_LABELS[request.reason]}
                  </Text>
                  {!!request.details && <Text style={ts.details}>{request.details}</Text>}
                </View>

                {!!request.evidence.length && (
                  <View>
                    <Text style={ts.label}>PRIVATE EVIDENCE</Text>
                    <View style={ts.evidenceList}>
                      {request.evidence.map(item => (
                        <TouchableOpacity
                          key={item.id}
                          style={ts.evidenceRow}
                          activeOpacity={0.75}
                          disabled={!item.url}
                          onPress={() => item.url && Linking.openURL(item.url)}
                        >
                          <Ionicons
                            name={item.mimeType.startsWith('video/') ? 'videocam-outline' : 'image-outline'}
                            size={15}
                            color={Colors.infoBlue}
                          />
                          <Text style={ts.evidenceName} numberOfLines={1}>{item.fileName}</Text>
                          <Ionicons name="open-outline" size={14} color={tc(Colors.textMuted)} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {!!request.linkedServiceJobs?.length && (
                  <View style={ts.serviceWarning}>
                    <Ionicons name="alert-circle-outline" size={15} color={tc(Colors.warning)} />
                    <Text style={ts.serviceWarningText}>
                      Linked TradeXchange work has progressed. CarMazium admin must review this cancellation separately from the provider job.
                    </Text>
                  </View>
                )}

                {!!request.counterpartResponseNote && (
                  <Text style={ts.note}>Other party: {request.counterpartResponseNote}</Text>
                )}
                {!!request.adminNote && <Text style={ts.note}>CarMazium: {request.adminNote}</Text>}
                {request.buyerFeeRefunded && (
                  <Text style={ts.refundText}>£125 auction buyer fee refunded.</Text>
                )}
                {request.sellerBonusRecoveryRequired && (
                  <Text style={ts.warningText}>Seller reward reconciliation is required.</Text>
                )}

                {(request.viewer?.canRespond || request.viewer?.canWithdraw) && (
                  <View style={ts.actions}>
                    {request.viewer?.canRespond && (
                      <>
                        <TouchableOpacity
                          style={[ts.secondaryBtn, isBusy && { opacity: 0.5 }]}
                          onPress={() => respond(request, 'REJECT')}
                          disabled={isBusy}
                        >
                          <Text style={ts.secondaryBtnText}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[ts.primaryBtn, isBusy && { opacity: 0.5 }]}
                          onPress={() => respond(request, 'ACCEPT')}
                          disabled={isBusy}
                        >
                          {isBusy
                            ? <ActivityIndicator size="small" color={Colors.white} />
                            : <Text style={ts.primaryBtnText}>Agree & Cancel</Text>}
                        </TouchableOpacity>
                      </>
                    )}
                    {request.viewer?.canWithdraw && (
                      <TouchableOpacity
                        style={[ts.withdrawBtn, isBusy && { opacity: 0.5 }]}
                        onPress={() => withdraw(request)}
                        disabled={isBusy}
                      >
                        <Text style={ts.withdrawText}>Withdraw my request</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: Math.max(insets.bottom, 24) + 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  headerSub: {
    marginTop: 2,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
  },
  headerSpacer: { width: 38 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, gap: 12 },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  card: {
    padding: 15,
    borderRadius: Radius.card,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    gap: 13,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  vehicleTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  meta: {
    marginTop: 3,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
  },
  statusChip: {
    maxWidth: 125,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    textAlign: 'center',
  },
  infoBox: {
    padding: 12,
    borderRadius: Radius.inline,
    backgroundColor: Colors.whiteAlpha04,
  },
  label: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    letterSpacing: 0.8,
    color: Colors.textMuted,
    marginBottom: 5,
  },
  reason: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  details: {
    marginTop: 6,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  evidenceList: { gap: 7 },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  evidenceName: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  serviceWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: Radius.inline,
    backgroundColor: Colors.warningAlpha10,
    borderWidth: 1,
    borderColor: Colors.warningAlpha25,
  },
  serviceWarningText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  note: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  refundText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.success,
  },
  warningText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.warning,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
  secondaryBtn: {
    flex: 1,
    minWidth: 110,
    height: 42,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.accentAlpha30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.accent,
  },
  primaryBtn: {
    flex: 1,
    minWidth: 130,
    height: 42,
    borderRadius: Radius.inline,
    backgroundColor: Colors.successSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.white,
  },
  withdrawBtn: {
    width: '100%',
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});

const LIGHT_PALETTE = appearancePalette('light');

// Light-mode text colours for keys the screen's light map did not cover.
// Generated from the contrast audit (scripts/theme-audit); dark mode is untouched.
const lightContrastStyles = StyleSheet.create({
  headerSub: { color: LIGHT_PALETTE.muted },
  reason: { color: LIGHT_PALETTE.text },
  serviceWarningText: { color: LIGHT_PALETTE.secondary },
  note: { color: LIGHT_PALETTE.secondary },
  secondaryBtnText: { color: lightReadableText.accent },
  primaryBtn: { backgroundColor: lightReadableText.success },
});
