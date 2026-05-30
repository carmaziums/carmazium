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

type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | string;

function offerBadgeKind(status: OfferStatus) {
  switch (status) {
    case 'ACCEPTED':  return 'verified' as const;   // emerald
    case 'COUNTERED': return 'standard' as const;   // blue
    case 'REJECTED':  return 'live' as const;       // red
    case 'PENDING':
    default:          return 'premium' as const;    // amber
  }
}

function offerStatusLabel(status: OfferStatus) {
  switch (status) {
    case 'PENDING':   return 'Pending';
    case 'ACCEPTED':  return 'Accepted';
    case 'REJECTED':  return 'Rejected';
    case 'COUNTERED': return 'Countered';
    default:          return status ?? 'Unknown';
  }
}

export default function BuyerOffers() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', 'buyer'],
    queryFn: dashboardApi.buyer,
  });

  const offers: any[] = data?.offers ?? [];

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
          My Offers
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
          {offers.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-white/40 text-base" style={{ fontFamily: FONT.body }}>
                No offers yet
              </Text>
            </View>
          ) : (
            offers.map((offer: any, index: number) => {
              const title = offer.listing?.title ?? offer.listingId ?? 'Unknown vehicle';
              const amount = offer.amount != null
                ? `£${offer.amount.toLocaleString('en-GB')}`
                : '—';
              const status = offer.status ?? 'PENDING';
              return (
                <View
                  key={offer.id ?? index}
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
                    <CzBadge kind={offerBadgeKind(status)}>
                      {offerStatusLabel(status)}
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
