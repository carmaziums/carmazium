import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { approveListing, getPendingListingReviews, rejectListing } from '../../lib/adminApi';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import { AdminHeader, AdminListSkeleton, adminStyles } from './adminShared';

type Props = NativeStackScreenProps<MainStackParamList, 'AdminListingsReview'>;

type Money = number | string | null | undefined;
const validMoney = (value: Money): number | null => {
  if (value == null || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};
const gbp = (value: number) => '£' + value.toLocaleString('en-GB', { maximumFractionDigits: 2 });

/** Port of web getModerationPrice (src/lib/adminListingModeration.ts). */
function moderationPrice(listing: any): { value: string; label: string } {
  if (listing.type === 'AUCTION') {
    const startingBid = validMoney(listing.auction?.startingBid);
    const highestBid = validMoney(listing.bids?.[0]?.amount);
    const price = highestBid ?? startingBid;
    return {
      value: price == null ? 'Auction terms unavailable' : gbp(price),
      label: highestBid == null ? 'Starting bid' : 'Current bid',
    };
  }
  const retail = validMoney(listing.price);
  return {
    value: retail == null ? 'Price not set' : gbp(retail),
    label: listing.type === 'CLASSIFIED' ? 'Retail asking price' : 'Price (unclassified)',
  };
}

const channelLabel = (type?: string) =>
  type === 'AUCTION' ? 'Auction' : type === 'CLASSIFIED' ? 'Retail' : 'Unknown';

const keyExtractor = (item: any) => String(item.id);

export const AdminListingsReviewScreen: React.FC<Props> = ({ navigation }) => {
  const bottomPad = useTabBarClearance();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      const data = await getPendingListingReviews();
      // Web filters to PENDING_REVIEW too (admin/listings/page.tsx loadPending).
      setListings((data || []).filter((l: any) => l.status === 'PENDING_REVIEW'));
    } catch (err: any) {
      setError(err?.message || 'Failed to load pending listing reviews.');
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

  const approve = useCallback((listing: any) => {
    Alert.alert(
      'Approve listing?',
      `“${listing.title || 'This listing'}” will be approved and go live.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setBusyId(listing.id);
            try {
              await approveListing(listing.id);
              Alert.alert('Approved', 'Listing approved and is now live.');
            } catch (err: any) {
              Alert.alert('Could not approve', err?.message || 'Failed to approve listing');
            } finally {
              setBusyId(null);
              await load(true);
            }
          },
        },
      ],
    );
  }, [load]);

  const reject = useCallback((listing: any, rawReason: string) => {
    const reason = rawReason.trim();
    if (reason.length < 10) {
      Alert.alert('Reason required', 'Please provide a rejection reason (at least 10 characters).');
      return;
    }
    if (reason.length > 1000) {
      Alert.alert('Reason too long', 'Please keep the rejection reason under 1000 characters.');
      return;
    }
    Alert.alert(
      'Reject listing?',
      'The seller will be notified with your reason and asked to fix the listing before resubmitting.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setBusyId(listing.id);
            try {
              await rejectListing(listing.id, reason);
              setRejectingId(null);
              setReasons((prev) => ({ ...prev, [listing.id]: '' }));
              Alert.alert('Rejected', 'Listing rejected — the seller has been notified.');
            } catch (err: any) {
              Alert.alert('Could not reject', err?.message || 'Failed to reject listing');
            } finally {
              setBusyId(null);
              await load(true);
            }
          },
        },
      ],
    );
  }, [load]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    const price = moderationPrice(item);
    const busy = busyId === item.id;
    const isRejecting = rejectingId === item.id;
    const hpiPending = item.hpiReport?.status === 'PENDING';
    const sellerName = [item.seller?.firstName, item.seller?.lastName].filter(Boolean).join(' ');
    return (
      <Card padded>
        <View style={styles.top}>
          {item.images?.[0] ? (
            <Image source={{ uri: item.images[0] }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Ionicons name="car-outline" size={22} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.topText}>
            <Text style={adminStyles.title} numberOfLines={2}>{item.title || 'Untitled listing'}</Text>
            <View style={styles.badges}>
              <Badge kind={item.type === 'AUCTION' ? 'premium' : 'standard'}>{channelLabel(item.type)}</Badge>
              <Badge kind="featured">Pending</Badge>
            </View>
          </View>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{price.value}</Text>
          <Text style={adminStyles.meta}>{price.label}</Text>
        </View>
        <Text style={adminStyles.meta} numberOfLines={1}>
          Seller: {sellerName || '—'}{item.seller?.email ? ` · ${item.seller.email}` : ''}
        </Text>
        {hpiPending ? (
          <Text style={[adminStyles.meta, styles.hpi]}>
            History report outstanding — you can approve now and attach it later from the website vehicle history queue.
          </Text>
        ) : null}

        {isRejecting ? (
          <View style={styles.rejectBox}>
            <Text style={adminStyles.fieldLabel}>Rejection reason (required to reject)</Text>
            <TextInput
              style={adminStyles.input}
              value={reasons[item.id] || ''}
              onChangeText={(text) => setReasons((prev) => ({ ...prev, [item.id]: text }))}
              placeholder="Explain what needs fixing before this can be approved..."
              placeholderTextColor={Colors.inputPlaceholder}
              multiline
              maxLength={1000}
              editable={!busy}
            />
            <View style={adminStyles.actions}>
              <Button label="Cancel" variant="outline" size="sm" style={adminStyles.actionBtn}
                onPress={() => setRejectingId(null)} disabled={busy} />
              <Button label="Send rejection" variant="dark" size="sm" style={adminStyles.actionBtn}
                onPress={() => reject(item, reasons[item.id] || '')} loading={busy} disabled={busy} />
            </View>
          </View>
        ) : (
          <View style={adminStyles.actions}>
            <Button label="Approve" variant="primary" size="sm" style={adminStyles.actionBtn}
              onPress={() => approve(item)} loading={busy} disabled={busy} />
            <Button label="Reject" variant="outline" size="sm" style={adminStyles.actionBtn}
              onPress={() => setRejectingId(item.id)} disabled={busy} />
          </View>
        )}
      </Card>
    );
  }, [approve, reject, busyId, rejectingId, reasons]);

  return (
    <View style={adminStyles.screen}>
      <AdminHeader
        title="Listings"
        subtitle="Pending review"
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={loading ? [] : listings}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={[busyId, rejectingId, reasons]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[adminStyles.listContent, { paddingBottom: bottomPad }]}
        ListHeaderComponent={
          <View style={styles.header}>
            {error ? <ErrorBanner message={error} onRetry={() => void load(false)} /> : null}
            {!loading && listings.length > 0 ? (
              <Text style={adminStyles.sectionLabel}>{listings.length} awaiting action</Text>
            ) : null}
            {loading ? (
              <AdminListSkeleton />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading || error ? null : (
            <EmptyState
              icon="checkmark-circle-outline"
              title="All caught up"
              subtitle="Nothing is waiting for review right now."
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
  topText: { flex: 1, gap: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12, marginBottom: 4 },
  price: { ...TextPresets.monoFigure, fontSize: Type.h5, color: Colors.textPrimary },
  hpi: { marginTop: 6, color: Colors.accent },
  rejectBox: { marginTop: 12 },
});
