import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import {
  acceptDeliveryRequest,
  declineDeliveryRequest,
  getReceivedDeliveryRequests,
  type DeliveryRequest,
} from '../../lib/deliveryApi';
import { haptics } from '../../lib/haptics';

// Compact panel that surfaces PENDING delivery requests waiting on this
// seller/dealer. Shown at the top of the offers scroll so acceptance
// decisions live alongside the offers they were made against. Non-empty
// state only — nothing renders when there's no pending work, keeping the
// offers screen clean.

interface Props {
  /** Present-tense noun for the toast copy ("your listing" / "your inventory"). */
  contextLabel?: string;
}

const fmtGbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export const ReceivedDeliveryRequestsPanel: React.FC<Props> = ({
  contextLabel = 'your listing',
}) => {
  const [rows, setRows] = useState<DeliveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getReceivedDeliveryRequests();
      // Only surface work that's actionable right now — completed/declined
      // requests belong on a full history screen if we ever add one.
      setRows(list.filter(r => r.status === 'PENDING'));
    } catch {
      // Silently fail — panel is a nice-to-have; offers still load.
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onAccept = (req: DeliveryRequest) => {
    Alert.alert(
      'Accept delivery request',
      `Confirm delivery for ${fmtGbp(req.estimatedCostGbp)} to ${req.deliveryAddress?.postcode ?? 'buyer'} (${Math.round(req.distanceMiles)} mi)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setActionLoading(req.id);
            try {
              await acceptDeliveryRequest(req.id);
              haptics.success();
              await load();
            } catch (err: any) {
              Alert.alert('Could not accept', err?.message ?? 'Please try again.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const onDecline = (req: DeliveryRequest) => {
    Alert.alert(
      'Decline delivery request',
      `Decline the delivery request on ${contextLabel}? The buyer will be notified.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(req.id);
            try {
              await declineDeliveryRequest(req.id);
              haptics.medium();
              await load();
            } catch (err: any) {
              Alert.alert('Could not decline', err?.message ?? 'Please try again.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  // Nothing to show — bail out silently. Loading a spinner for an empty
  // list would be noisier than the whole panel being missing.
  if (loading || rows.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="car-outline" size={13} color="#10B981" />
        <Text style={styles.headerText}>
          {rows.length} delivery request{rows.length === 1 ? '' : 's'} awaiting your response
        </Text>
      </View>

      {rows.map(req => {
        const isActioning = actionLoading === req.id;
        const addr = req.deliveryAddress;
        return (
          <View key={req.id} style={styles.row}>
            <View style={styles.rowTop}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {Math.round(req.distanceMiles)} mi · {fmtGbp(req.estimatedCostGbp)} est.
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {[addr?.street, addr?.city, addr?.postcode].filter(Boolean).join(', ')}
                </Text>
              </View>
            </View>

            {req.deliveryNotes ? (
              <Text style={styles.notes} numberOfLines={2}>
                “{req.deliveryNotes}”
              </Text>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnDecline]}
                activeOpacity={0.85}
                onPress={() => onDecline(req)}
                disabled={isActioning}
              >
                <Text style={[styles.btnText, { color: '#F87171' }]}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnAccept]}
                activeOpacity={0.85}
                onPress={() => onAccept(req)}
                disabled={isActioning}
              >
                {isActioning ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                    <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderRadius: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#10B981',
    letterSpacing: 0.3,
  },
  row: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(16,185,129,0.14)',
    paddingTop: 10,
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  rowSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  notes: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnDecline: {
    borderColor: 'rgba(248,113,113,0.45)',
    backgroundColor: 'rgba(248,113,113,0.08)',
  },
  btnAccept: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  btnText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
