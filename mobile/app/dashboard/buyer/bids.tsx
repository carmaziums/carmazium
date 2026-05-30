import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CzScreen } from '@/components/ui/CzScreen';
import { CzBadge } from '@/components/ui/CzBadge';
import { dashboardApi } from '@/lib/api';
import { CZM, FONT } from '@/constants/tokens';

type AuctionStatus = 'ACTIVE' | 'ENDED' | 'WON' | 'OUTBID' | string;

function statusBadgeKind(status: AuctionStatus) {
  switch (status) {
    case 'ACTIVE':  return 'standard' as const;   // blue
    case 'WON':     return 'verified' as const;   // emerald
    case 'OUTBID':  return 'live' as const;       // red
    case 'ENDED':
    default:        return 'dark' as const;       // fg4
  }
}

function statusLabel(status: AuctionStatus) {
  switch (status) {
    case 'ACTIVE':  return 'Active';
    case 'ENDED':   return 'Ended';
    case 'WON':     return 'Won';
    case 'OUTBID':  return 'Outbid';
    default:        return status ?? 'Unknown';
  }
}

export default function BuyerBids() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', 'buyer'],
    queryFn: dashboardApi.buyer,
  });

  const bids: any[] = data?.bids ?? [];

  return (
    <CzScreen safe={false}>
      {/* Header */}
      <View
        className="flex-row items-center px-5 border-b border-white/5"
        style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 p-1"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text className="text-white text-xl" style={{ fontFamily: FONT.heading }}>
            ‹
          </Text>
        </TouchableOpacity>
        <Text className="text-white text-lg flex-1" style={{ fontFamily: FONT.headingSemi }}>
          My Bids
        </Text>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={CZM.red} size="large" />
        </View>
      )}

      {isError && !isLoading && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-white/60 text-center" style={{ fontFamily: FONT.body }}>
            Could not load dashboard
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="mt-4 bg-[#ff0037]/10 border border-[#ff0037]/30 rounded-xl px-6 py-3"
          >
            <Text className="text-[#ff4d6a] text-sm font-bold uppercase tracking-wider">
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !isError && (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={CZM.red}
              colors={[CZM.red]}
            />
          }
        >
          {bids.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-white/40 text-base" style={{ fontFamily: FONT.body }}>
                No bids yet
              </Text>
            </View>
          ) : (
            bids.map((bid: any, index: number) => {
              const title = bid.listing?.title ?? bid.listingId ?? 'Unknown vehicle';
              const amount = bid.amount != null
                ? `£${bid.amount.toLocaleString('en-GB')}`
                : '—';
              const status = bid.auctionStatus ?? bid.status ?? 'ENDED';
              return (
                <View
                  key={bid.id ?? index}
                  className="px-5 py-4 border-b border-white/5"
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <Text
                      className="text-white flex-1 mr-3 text-base"
                      style={{ fontFamily: FONT.bodySemi }}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    <CzBadge kind={statusBadgeKind(status)}>
                      {statusLabel(status)}
                    </CzBadge>
                  </View>
                  <Text
                    className="text-white/60 text-sm mt-0.5"
                    style={{ fontFamily: FONT.mono }}
                  >
                    {amount}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </CzScreen>
  );
}
