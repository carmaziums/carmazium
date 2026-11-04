import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { Button } from '../../components/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Colors } from '../../constants/colors';
import { TextPresets, Type } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import { approveHandover, denyHandover, getPendingHandovers } from '../../lib/adminApi';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import {
  AdminHeader,
  AdminListSkeleton,
  adminStyles,
  formatPrice,
  isPdfUrl,
  openAdminWeb,
  openExternalUrl,
} from './adminShared';

type Props = NativeStackScreenProps<MainStackParamList, 'AdminHandovers'>;

const keyExtractor = (item: any) => String(item.id);

/**
 * Confirm text copied from web handleApprove
 * (src/app/dashboard/admin/handovers/page.tsx). Approving can trigger the
 * £100 seller reward transfer, so the admin must see which path applies.
 */
function approvePayoutNote(sellerConnected: boolean, hasBankDetails: boolean): string {
  return sellerConnected
    ? 'The £100 seller bonus will be transferred automatically via Stripe.'
    : hasBankDetails
      ? '⚠️ Stripe not connected. You will need to manually transfer £100 to the bank details shown. Approve to mark the handover as complete.'
      : '⚠️ The seller has no payout method set up. Approve to complete the handover — follow up with the seller to arrange payment separately.';
}

export const AdminHandoversScreen: React.FC<Props> = ({ navigation }) => {
  const bottomPad = useTabBarClearance();
  const [handovers, setHandovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      setHandovers((await getPendingHandovers()) || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load handovers');
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

  const approve = useCallback((h: any) => {
    const seller = h.listing?.seller;
    const note = approvePayoutNote(!!seller?.stripeConnectOnboardingComplete, !!seller?.bankAccountNumber);
    Alert.alert('Approve this handover?', note, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setBusyId(h.id);
          try {
            await approveHandover(h.id);
          } catch (err: any) {
            Alert.alert('Approval failed', err?.message || 'Approval failed');
          } finally {
            setBusyId(null);
            await load(true);
          }
        },
      },
    ]);
  }, [load]);

  const deny = useCallback((h: any, rawReason: string) => {
    const feedback = rawReason.trim();
    // Same bounds as web handleDeny.
    if (feedback.length < 10 || feedback.length > 500) {
      Alert.alert('Reason required', 'Please enter a specific reason between 10 and 500 characters.');
      return;
    }
    Alert.alert(
      'Reject proof?',
      'Reject this proof and ask the seller to resubmit? No buyer refund or sale cancellation will be made.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Proof',
          style: 'destructive',
          onPress: async () => {
            setBusyId(h.id);
            try {
              await denyHandover(h.id, feedback);
              setDenyingId(null);
              setReasons((prev) => ({ ...prev, [h.id]: '' }));
            } catch (err: any) {
              Alert.alert('Denial failed', err?.message || 'Denial failed');
            } finally {
              setBusyId(null);
              await load(true);
            }
          },
        },
      ],
    );
  }, [load]);

  const renderItem = useCallback(({ item: h }: { item: any }) => {
    const seller = h.listing?.seller;
    const busy = busyId === h.id;
    const isDenying = denyingId === h.id;
    const stripeReady = !!seller?.stripeConnectOnboardingComplete;
    const hasBank = !!seller?.bankAccountNumber;
    const proofUrl: string | undefined = h.handoverProofUrl || undefined;
    const approveLabel = stripeReady
      ? 'Approve & Pay £100'
      : hasBank
        ? 'Approve (Manual Transfer)'
        : 'Approve (No Payout)';
    return (
      <Card padded>
        <View style={styles.top}>
          {h.listing?.images?.[0] ? (
            <Image source={{ uri: h.listing.images[0] }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Ionicons name="car-outline" size={22} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.topText}>
            <Text style={adminStyles.title} numberOfLines={2}>{h.listing?.title || 'Vehicle'}</Text>
            <Text style={adminStyles.meta}>
              {[h.listing?.year, h.listing?.make, h.listing?.model].filter(Boolean).join(' · ')}
            </Text>
            <Badge kind="featured">Pending review</Badge>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.cell}>
            <Text style={adminStyles.fieldLabel}>Seller</Text>
            <Text style={adminStyles.fieldValue}>{[seller?.firstName, seller?.lastName].filter(Boolean).join(' ') || '—'}</Text>
            {seller?.email ? <Text style={adminStyles.meta}>{seller.email}</Text> : null}
          </View>
          <View style={styles.cell}>
            <Text style={adminStyles.fieldLabel}>Winner / Buyer</Text>
            <Text style={adminStyles.fieldValue}>{[h.winner?.firstName, h.winner?.lastName].filter(Boolean).join(' ') || '—'}</Text>
            {h.winner?.email ? <Text style={adminStyles.meta}>{h.winner.email}</Text> : null}
          </View>
          <View style={styles.cell}>
            <Text style={adminStyles.fieldLabel}>Winning Bid</Text>
            <Text style={styles.money}>{formatPrice(Number(h.winningBidAmount ?? 0))}</Text>
          </View>
        </View>

        <View style={adminStyles.divider} />
        <Text style={adminStyles.fieldLabel}>Fee Breakdown</Text>
        <View style={styles.feeRow}><Text style={adminStyles.meta}>Buyer paid</Text><Text style={adminStyles.mono}>£125.00</Text></View>
        <View style={styles.feeRow}><Text style={adminStyles.meta}>→ Seller bonus (on approval)</Text><Text style={[adminStyles.mono, styles.success]}>£100.00</Text></View>
        <View style={styles.feeRow}><Text style={adminStyles.meta}>CarMazium keeps</Text><Text style={adminStyles.mono}>£25.00</Text></View>
        <Text style={[adminStyles.meta, styles.statusLine]}>Buyer fee {h.buyerFeePaid ? 'paid' : 'not yet paid'}</Text>
        <Text style={[adminStyles.meta, stripeReady ? styles.success : hasBank ? styles.info : styles.warning]}>
          {stripeReady
            ? 'Seller Stripe account connected — payout fires automatically'
            : hasBank
              ? 'Manual bank transfer required — see details below'
              : 'No payout method — seller must add bank details in Settings'}
        </Text>
        {!stripeReady && hasBank ? (
          <View style={styles.bankBox}>
            <Text style={adminStyles.mono}>Name: {seller.bankAccountName || '—'}</Text>
            <Text style={adminStyles.mono}>Sort Code: {seller.bankSortCode || '—'}</Text>
            <Text style={adminStyles.mono}>Account: {seller.bankAccountNumber}</Text>
          </View>
        ) : null}
        {h.handoverSubmittedAt ? (
          <Text style={[adminStyles.meta, styles.statusLine]}>
            Submitted {new Date(h.handoverSubmittedAt).toLocaleString('en-GB')}
          </Text>
        ) : null}

        <View style={adminStyles.divider} />
        <Text style={adminStyles.fieldLabel}>Proof Submitted</Text>
        {proofUrl ? (
          <TouchableOpacity
            style={styles.proof}
            onPress={() => void openExternalUrl(proofUrl)}
            accessibilityRole="link"
            accessibilityLabel="View handover proof"
          >
            {!isPdfUrl(proofUrl) ? (
              <Image source={{ uri: proofUrl }} style={styles.proofImage} contentFit="cover" />
            ) : null}
            <View style={adminStyles.row}>
              <Ionicons name="open-outline" size={14} color={Colors.infoLight} />
              <Text style={adminStyles.link}>View Handover Proof</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <Text style={adminStyles.meta}>No proof file attached.</Text>
        )}

        {isDenying ? (
          <View style={styles.denyBox}>
            <Text style={adminStyles.fieldLabel}>Why is this handover proof inadequate?</Text>
            <Text style={adminStyles.meta}>
              Give the seller specific instructions. Evidence rejection does NOT refund the buyer or cancel the sale.
            </Text>
            <TextInput
              style={adminStyles.input}
              value={reasons[h.id] || ''}
              onChangeText={(text) => setReasons((prev) => ({ ...prev, [h.id]: text }))}
              placeholder="Between 10 and 500 characters"
              placeholderTextColor={Colors.inputPlaceholder}
              multiline
              maxLength={500}
              editable={!busy}
            />
            <View style={adminStyles.actions}>
              <Button label="Cancel" variant="outline" size="sm" style={adminStyles.actionBtn}
                onPress={() => setDenyingId(null)} disabled={busy} />
              <Button label="Reject Proof" variant="dark" size="sm" style={adminStyles.actionBtn}
                onPress={() => deny(h, reasons[h.id] || '')} loading={busy} disabled={busy} />
            </View>
          </View>
        ) : (
          <View style={adminStyles.actions}>
            <Button label={approveLabel} variant="primary" size="sm" style={adminStyles.actionBtn}
              onPress={() => approve(h)} loading={busy} disabled={busy} />
            <Button label="Reject Proof" variant="outline" size="sm" style={adminStyles.actionBtn}
              onPress={() => setDenyingId(h.id)} disabled={busy} />
          </View>
        )}
      </Card>
    );
  }, [approve, deny, busyId, denyingId, reasons]);

  return (
    <View style={adminStyles.screen}>
      <AdminHeader title="Handover Verification" subtitle="Seller handover evidence" onBack={() => navigation.goBack()} />
      <FlatList
        data={loading ? [] : handovers}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={[busyId, denyingId, reasons]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[adminStyles.listContent, { paddingBottom: bottomPad }]}
        ListHeaderComponent={
          <View style={styles.header}>
            {error ? <ErrorBanner message={error} onRetry={() => void load(false)} /> : null}
            <Text style={adminStyles.body}>
              Review seller-submitted handover evidence. Approve valid proof or reject inadequate proof with specific feedback so the seller can resubmit. Rejection does not refund the buyer.
            </Text>
            <TouchableOpacity
              onPress={() => void openAdminWeb('/dashboard/admin/handovers')}
              accessibilityRole="link"
              style={adminStyles.row}
            >
              <Ionicons name="open-outline" size={14} color={Colors.infoLight} />
              <Text style={adminStyles.link}>Seller reward payouts are managed on the website</Text>
            </TouchableOpacity>
            {loading ? <AdminListSkeleton height={260} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading || error ? null : (
            <EmptyState
              icon="checkmark-circle-outline"
              title="All caught up"
              subtitle="No handover proofs are pending verification right now."
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: { gap: 10 },
  top: { flexDirection: 'row', gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: Radius.inline, backgroundColor: Colors.bgTertiary },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  topText: { flex: 1, gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  cell: { flexBasis: '45%', flexGrow: 1 },
  money: { ...TextPresets.monoFigure, fontSize: Type.body, color: Colors.success, marginTop: 2 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  success: { color: Colors.success },
  info: { color: Colors.info },
  warning: { color: Colors.warning },
  statusLine: { marginTop: 8 },
  bankBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.infoBlueAlpha20,
    backgroundColor: Colors.infoBlueAlpha10,
    gap: 2,
  },
  proof: { marginTop: 8, gap: 8 },
  proofImage: { width: '100%', height: 180, borderRadius: Radius.inline, backgroundColor: Colors.bgTertiary },
  denyBox: { marginTop: 12, gap: 4 },
});
