import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { KpiTile } from '@/components/dashboard/KpiTile';
import { LeadFunnelBar, LeadFunnel } from '@/components/dashboard/LeadFunnelBar';
import { CzEyebrow } from '@/components/ui/CzEyebrow';
import { dashboardApi } from '@/lib/api/dashboard';
import { CZM } from '@/constants/tokens';

export default function DealerDashboard() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', 'dealer'],
    queryFn: dashboardApi.dealer,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: CZM.bg }}>
        <ActivityIndicator
          testID="activity-indicator"
          color={CZM.red}
          size="large"
        />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: CZM.bg }}>
        <Text className="text-white/50 text-sm">Could not load dashboard</Text>
      </View>
    );
  }

  const funnel: LeadFunnel = {
    NEW:         data?.leadFunnel?.NEW         ?? 0,
    CONTACTED:   data?.leadFunnel?.CONTACTED   ?? 0,
    QUALIFIED:   data?.leadFunnel?.QUALIFIED   ?? 0,
    NEGOTIATING: data?.leadFunnel?.NEGOTIATING ?? 0,
    WON:         data?.leadFunnel?.WON         ?? 0,
    LOST:        data?.leadFunnel?.LOST        ?? 0,
  };

  const conversionDisplay =
    data?.conversionRate != null
      ? `${(data.conversionRate * 100).toFixed(1)}%`
      : '—';

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: CZM.bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={CZM.red}
        />
      }
    >
      {/* Section 1 — KPI tiles (DEALER-01) */}
      <CzEyebrow style={{ marginBottom: 12 }}>Dealer Dashboard</CzEyebrow>

      <View className="flex-row gap-3 mb-3">
        <KpiTile
          label="Active Listings"
          value={data?.activeListings ?? 0}
        />
        <KpiTile
          label="Auctions"
          value={data?.activeAuctions ?? 0}
        />
      </View>

      <View className="flex-row gap-3 mb-6">
        <KpiTile
          label="Leads"
          value={data?.totalLeads ?? 0}
          accent={!!data?.totalLeads}
        />
        <KpiTile
          label="Sold / Mo"
          value={data?.soldThisMonth ?? 0}
        />
      </View>

      {/* Section 2 — Lead Funnel (DEALER-02) */}
      <CzEyebrow style={{ marginBottom: 12 }}>Lead Funnel</CzEyebrow>

      <View className="mb-6">
        <LeadFunnelBar funnel={funnel} />
      </View>

      {/* Section 3 — Trend KPIs (DEALER-03) */}
      <CzEyebrow style={{ marginBottom: 12 }}>Performance</CzEyebrow>

      <View className="flex-row gap-3">
        <KpiTile
          label="Conversion"
          value={conversionDisplay}
          sub="offer to sale"
        />
        <KpiTile
          label="Avg Views"
          value={data?.avgViews ?? '—'}
          sub="per listing"
        />
      </View>
    </ScrollView>
  );
}
