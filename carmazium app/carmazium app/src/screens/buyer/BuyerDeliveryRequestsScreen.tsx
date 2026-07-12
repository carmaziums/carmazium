import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import {
  cancelDeliveryRequest,
  completeDeliveryRequest,
  getMyDeliveryRequests,
  type DeliveryRequest,
  type DeliveryStatus,
} from '../../lib/deliveryApi';
import { apiClient } from '../../lib/apiClient';
import { haptics } from '../../lib/haptics';

import { IconButton } from '../../components/IconButton';
// The backend DeliveryRequest payload does NOT include a listing summary —
// only listingId. We hydrate title/image by fetching each linked listing
// once and caching by id so a refresh doesn't refetch every row. Typical
// list sizes for a buyer's delivery history are single digits, so the
// upfront Promise.all is cheap compared with a per-row on-demand fetch.
type ListingSummary = { title?: string; images?: string[] };

const fmtGbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

const STATUS_CFG: Record<
  DeliveryStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  PENDING: {
    label: 'PENDING',
    bg: Colors.warningAlpha14,
    text: Colors.warning,
    border: 'rgba(245,158,11,0.32)',
  },
  ACCEPTED: {
    label: 'ACCEPTED',
    bg: Colors.successAlpha14,
    text: Colors.success,
    border: 'rgba(34,197,94,0.32)',
  },
  DECLINED: {
    label: 'DECLINED',
    bg: Colors.whiteAlpha05,
    text: Colors.textMuted,
    border: Colors.whiteAlpha10,
  },
  CANCELLED: {
    label: 'CANCELLED',
    bg: Colors.whiteAlpha05,
    text: Colors.textMuted,
    border: Colors.whiteAlpha10,
  },
  COMPLETED: {
    label: 'COMPLETED',
    bg: Colors.infoBlueAlpha14,
    text: Colors.infoBlue,
    border: 'rgba(59,130,246,0.32)',
  },
};

export const BuyerDeliveryRequestsScreen: React.FC<{ navigation?: any }> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ListingSummary>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const rows = await getMyDeliveryRequests();
      setRequests(rows);

      // Hydrate listing titles/images once per unique listingId. Requests
      // that reference the same listing (rare but possible) share a lookup.
      const uniqueListingIds = Array.from(
        new Set(rows.map(r => r.listingId).filter(Boolean)),
      );
      const missing = uniqueListingIds.filter(id => !summaries[id]);
      if (missing.length > 0) {
        const fetched = await Promise.all(
          missing.map(async id => {
            try {
              const res = await apiClient<{ success: boolean; data: any }>(
                `/listings/${id}`,
              );
              const l = res?.data;
              return [
                id,
                {
                  title:
                    l?.title ??
                    [l?.year, l?.make, l?.model].filter(Boolean).join(' ') ??
                    undefined,
                  images: Array.isArray(l?.images) ? l.images : undefined,
                },
              ] as const;
            } catch {
              return [id, {}] as const;
            }
          }),
        );
        setSummaries(prev => {
          const next = { ...prev };
          for (const [id, summary] of fetched) next[id] = summary;
          return next;
        });
      }
    } catch (err: any) {
      setError(err?.message ?? 'Could not load delivery requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // Deliberately omit `summaries` from deps — including it would cause a
    // fetch loop every time we update the cache. We re-check missing ids on
    // every call anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onCancel = (req: DeliveryRequest) => {
    Alert.alert(
      'Cancel delivery request',
      'This will withdraw the request. The seller will be notified.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(req.id);
            try {
              await cancelDeliveryRequest(req.id);
              haptics.medium();
              await fetchAll();
            } catch (err: any) {
              Alert.alert(
                'Could not cancel',
                err?.message ?? 'Please try again in a moment.',
              );
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const onComplete = (req: DeliveryRequest) => {
    Alert.alert(
      'Mark delivery complete',
      'Confirm the vehicle has been delivered? This closes the request.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Mark Complete',
          onPress: async () => {
            setActionLoading(req.id);
            try {
              await completeDeliveryRequest(req.id);
              haptics.success();
              await fetchAll();
            } catch (err: any) {
              Alert.alert(
                'Could not complete',
                err?.message ?? 'Please try again in a moment.',
              );
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const renderRow = useCallback(({ item: req }: { item: DeliveryRequest }) => {
    const cfg = STATUS_CFG[req.status] ?? STATUS_CFG.PENDING;
    const summary = summaries[req.listingId];
    const title = summary?.title ?? 'Vehicle listing';
    const addr = req.deliveryAddress;
    const isActioning = actionLoading === req.id;

    return (
      <View style={[styles.card, { borderLeftColor: cfg.border }]}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.chip, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <Text style={[styles.chipText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>DISTANCE</Text>
            <Text style={styles.metaValue}>
              {Math.round(req.distanceMiles)} mi
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>EST. COST</Text>
            <Text style={styles.metaValue}>{fmtGbp(req.estimatedCostGbp)}</Text>
          </View>
        </View>

        <View style={styles.addressBlock}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.addressText} numberOfLines={2}>
            {[addr?.street, addr?.city, addr?.postcode].filter(Boolean).join(', ')}
          </Text>
        </View>

        {req.deliveryNotes ? (
          <Text style={styles.notesText} numberOfLines={2}>
            “{req.deliveryNotes}”
          </Text>
        ) : null}

        {(req.status === 'PENDING' || req.status === 'ACCEPTED') && (
          <View style={styles.actionsRow}>
            {req.status === 'PENDING' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDestructive]}
                activeOpacity={0.85}
                onPress={() => onCancel(req)}
                disabled={isActioning}
              >
                {isActioning ? (
                  <ActivityIndicator size="small" color={Colors.paleRed_f87171} />
                ) : (
                  <Text style={[styles.actionBtnText, { color: Colors.paleRed_f87171 }]}>
                    Cancel request
                  </Text>
                )}
              </TouchableOpacity>
            )}
            {req.status === 'ACCEPTED' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                activeOpacity={0.85}
                onPress={() => onComplete(req)}
                disabled={isActioning}
              >
                {isActioning ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={14} color={Colors.white} />
                    <Text style={[styles.actionBtnText, { color: Colors.white }]}>
                      Mark complete
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }, [summaries, actionLoading, onCancel, onComplete]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.infoBlueAlpha06, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ height: insets.top }} />

      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Delivery Requests</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading || requests.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAll(true)}
              tintColor={Colors.accent}
            />
          }
        >
          {error && !loading && (
            <ErrorBanner message={error} onRetry={() => fetchAll()} />
          )}
          {loading ? (
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.accent} />
            </View>
          ) : (
            <EmptyState
              icon="car-outline"
              title="No delivery requests yet"
              subtitle="Once a seller accepts your offer, request delivery from the listing to see it here."
            />
          )}
        </ScrollView>
      ) : (
        // FlatList so a long delivery-request history virtualizes instead of
        // mounting every row at once (mobile-audit.md P3).
        <FlatList
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAll(true)}
              tintColor={Colors.accent}
            />
          }
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          ListHeaderComponent={error ? <ErrorBanner message={error} onRetry={() => fetchAll()} /> : null}
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    borderLeftWidth: 3,
    padding: 14,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.textPrimary,
  },
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  chipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaCell: {
    flex: 1,
    backgroundColor: Colors.whiteAlpha03,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  metaLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  metaValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size14,
    color: Colors.textPrimary,
  },
  addressBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  addressText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  notesText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnDestructive: {
    borderColor: 'rgba(248,113,113,0.4)',
    backgroundColor: 'rgba(248,113,113,0.08)',
  },
  actionBtnPrimary: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  actionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    letterSpacing: 0.3,
  },
});
