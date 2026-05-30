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
import { dashboardApi } from '@/lib/api';
import { CZM, FONT } from '@/constants/tokens';

export default function BuyerHistory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', 'buyer'],
    queryFn: dashboardApi.buyer,
  });

  // Defensive: try all three field names the backend may use
  const history: any[] = data?.history ?? data?.purchases ?? data?.orders ?? [];

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
          Purchase History
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
          {history.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-white/40 text-base" style={{ fontFamily: FONT.body }}>
                No purchase history yet
              </Text>
            </View>
          ) : (
            history.map((item: any, index: number) => {
              const title = item.listing?.title ?? item.vehicle?.title ?? item.title ?? 'Unknown vehicle';
              const price = item.price ?? item.purchasePrice ?? item.amount;
              const formattedPrice = price != null
                ? `£${(price as number).toLocaleString('en-GB')}`
                : '—';

              const rawDate = item.createdAt ?? item.purchasedAt ?? item.date;
              let formattedDate = '—';
              if (rawDate) {
                try {
                  formattedDate = new Date(rawDate).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                } catch {
                  formattedDate = '—';
                }
              }

              return (
                <View
                  key={item.id ?? index}
                  className="px-5 py-4 border-b border-white/5"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <Text
                        className="text-white text-base"
                        style={{ fontFamily: FONT.bodySemi }}
                        numberOfLines={1}
                      >
                        {title}
                      </Text>
                      <Text
                        className="text-white/40 text-xs mt-1"
                        style={{ fontFamily: FONT.body }}
                      >
                        {formattedDate}
                      </Text>
                    </View>
                    <Text
                      className="text-white text-base"
                      style={{ fontFamily: FONT.mono }}
                    >
                      {formattedPrice}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </CzScreen>
  );
}
