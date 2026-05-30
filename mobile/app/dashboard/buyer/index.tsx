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
import { CzScreen } from '@/components/ui/CzScreen';
import { CzEyebrow } from '@/components/ui/CzEyebrow';
import { KpiTile } from '@/components/dashboard/KpiTile';
import { dashboardApi } from '@/lib/api';
import { CZM, FONT } from '@/constants/tokens';

export default function BuyerDashboard() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', 'buyer'],
    queryFn: dashboardApi.buyer,
  });

  if (isLoading) {
    return (
      <CzScreen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={CZM.red} size="large" />
        </View>
      </CzScreen>
    );
  }

  if (isError) {
    return (
      <CzScreen>
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
      </CzScreen>
    );
  }

  const activeBids = (data?.activeBids ?? 0) as number;
  const activeOffers = (data?.activeOffers ?? 0) as number;
  const watchlistCount = (data?.watchlistCount ?? 0) as number;
  const wonAuctions = (data?.wonAuctions ?? 0) as number;

  return (
    <CzScreen safe={false}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={CZM.red}
            colors={[CZM.red]}
          />
        }
      >
        {/* Header */}
        <View className="px-5 pt-14 pb-4">
          <CzEyebrow color={CZM.red}>My Dashboard</CzEyebrow>
          <Text
            className="text-white text-2xl mt-1"
            style={{ fontFamily: FONT.heading }}
          >
            Buyer
          </Text>
        </View>

        {/* KPI Grid */}
        <View className="px-5 flex-row flex-wrap gap-3">
          <View className="w-[47%]">
            <KpiTile
              label="Active Bids"
              value={activeBids}
              accent={activeBids > 0}
            />
          </View>
          <View className="w-[47%]">
            <KpiTile
              label="Active Offers"
              value={activeOffers}
              accent={activeOffers > 0}
            />
          </View>
          <View className="w-[47%]">
            <KpiTile
              label="Watchlist"
              value={watchlistCount}
            />
          </View>
          <View className="w-[47%]">
            <KpiTile
              label="Won"
              value={wonAuctions}
            />
          </View>
        </View>

        {/* Quick Links */}
        <View className="px-5 mt-8">
          <CzEyebrow color={CZM.fg4}>Quick Links</CzEyebrow>

          <View className="mt-3 border border-white/5 rounded-[18px] overflow-hidden">
            <TouchableOpacity
              className="flex-row items-center justify-between px-5 py-4 border-b border-white/5"
              onPress={() => router.push('/dashboard/buyer/bids')}
              activeOpacity={0.7}
            >
              <Text className="text-white text-base" style={{ fontFamily: FONT.bodySemi }}>
                My Bids
              </Text>
              <Text className="text-white/30 text-lg">›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-between px-5 py-4 border-b border-white/5"
              onPress={() => router.push('/dashboard/buyer/offers')}
              activeOpacity={0.7}
            >
              <Text className="text-white text-base" style={{ fontFamily: FONT.bodySemi }}>
                My Offers
              </Text>
              <Text className="text-white/30 text-lg">›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-between px-5 py-4"
              onPress={() => router.push('/dashboard/buyer/history')}
              activeOpacity={0.7}
            >
              <Text className="text-white text-base" style={{ fontFamily: FONT.bodySemi }}>
                Purchase History
              </Text>
              <Text className="text-white/30 text-lg">›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </CzScreen>
  );
}
