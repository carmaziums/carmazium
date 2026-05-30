import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, offersApi } from '@/lib/api';
import { KpiTile } from '@/components/dashboard/KpiTile';
import { CzEyebrow } from '@/components/ui/CzEyebrow';
import { CZM, FONT } from '@/constants/tokens';
import { useAuthStore } from '@/store/auth.store';

// ─── OfferRow ──────────────────────────────────────────────────────────────────

interface OfferRowProps {
  offer: any;
  onRespond: (id: string, action: 'accept' | 'reject' | 'counter', counterAmount?: number) => void;
  isPending: boolean;
}

function OfferRow({ offer, onRespond, isPending }: OfferRowProps) {
  const [showCounter, setShowCounter] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');

  const buyerName = [offer.buyer?.firstName, offer.buyer?.lastName].filter(Boolean).join(' ');
  const formattedAmount = `£${offer.amount?.toLocaleString('en-GB')}`;

  const handleSendCounter = () => {
    const parsed = parseFloat(counterAmount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Please enter a valid counter amount.');
      return;
    }
    onRespond(offer.id, 'counter', Number(counterAmount));
    setShowCounter(false);
    setCounterAmount('');
  };

  return (
    <View
      className="px-4 py-4 border-b border-white/5"
      pointerEvents={isPending ? 'none' : 'auto'}
      style={isPending ? { opacity: 0.5 } : undefined}
    >
      {/* Offer header: buyer name + amount */}
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-white font-semibold text-sm">{buyerName}</Text>
        <Text
          className="text-white font-bold text-sm"
          style={{ fontFamily: FONT.mono }}
        >
          {formattedAmount}
        </Text>
      </View>

      {/* Listing title */}
      {offer.listing?.title ? (
        <Text className="text-white/50 text-xs mb-3">{offer.listing.title}</Text>
      ) : null}

      {/* Action row */}
      {!showCounter ? (
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => onRespond(offer.id, 'accept')}
            className="flex-1 bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl py-2 items-center"
          >
            <Text className="text-[#34d399] text-xs font-bold uppercase tracking-wider">
              Accept
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowCounter(true)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 items-center"
          >
            <Text className="text-white/70 text-xs font-bold uppercase tracking-wider">
              Counter
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onRespond(offer.id, 'reject')}
            className="flex-1 bg-[#ff0037]/10 border border-[#ff0037]/30 rounded-xl py-2 items-center"
          >
            <Text className="text-[#ff4d6a] text-xs font-bold uppercase tracking-wider">
              Decline
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-row gap-2 items-center">
          <TextInput
            value={counterAmount}
            onChangeText={setCounterAmount}
            placeholder="Counter amount"
            placeholderTextColor={CZM.fg4}
            keyboardType="numeric"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
          />
          <TouchableOpacity
            onPress={handleSendCounter}
            className="bg-[#ff0037] rounded-xl px-4 py-2"
          >
            <Text className="text-white text-xs font-bold">Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setShowCounter(false); setCounterAmount(''); }}
            className="px-2"
          >
            <Text className="text-white/40 text-xs">Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── SellerDashboard ───────────────────────────────────────────────────────────

export default function SellerDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', 'seller'],
    queryFn: dashboardApi.seller,
  });

  const respondMutation = useMutation({
    mutationFn: ({
      id,
      action,
      counterAmount,
    }: {
      id: string;
      action: 'accept' | 'reject' | 'counter';
      counterAmount?: number;
    }) => offersApi.respond(id, action, counterAmount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', 'seller'] });
    },
    onError: (err: Error) => {
      Alert.alert('Action failed', err.message);
    },
  });

  const handleRespond = (
    id: string,
    action: 'accept' | 'reject' | 'counter',
    counterAmount?: number,
  ) => {
    respondMutation.mutate({ id, action, counterAmount });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: CZM.bg }}>
        <ActivityIndicator color={CZM.red} />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: CZM.bg }}>
        <Text className="text-white/50 text-sm">Failed to load dashboard</Text>
      </View>
    );
  }

  const offers = data?.offers ?? [];
  const earnings = data?.earnings ?? data?.completedSales ?? [];

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: CZM.bg }}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching ?? false}
          onRefresh={refetch}
          tintColor={CZM.red}
        />
      }
    >
      {/* ── Section 1: Overview ──────────────────────────────────── */}
      <View className="px-5 pt-12 pb-4">
        <CzEyebrow>Seller Dashboard</CzEyebrow>
        <Text
          className="text-white text-2xl mt-1 mb-4"
          style={{ fontFamily: FONT.heading }}
        >
          {user?.firstName ? `Hi, ${user.firstName}` : 'My Dashboard'}
        </Text>

        <View className="flex-row gap-3">
          <KpiTile
            label="Active Listings"
            value={data?.activeListings ?? 0}
          />
          <KpiTile
            label="Offers"
            value={data?.offerCount ?? 0}
            accent={(data?.offerCount ?? 0) > 0}
          />
          <KpiTile
            label="Enquiries"
            value={data?.enquiries ?? 0}
          />
        </View>
      </View>

      {/* ── Section 2: Offer Inbox ───────────────────────────────── */}
      <View className="mt-4">
        <View className="px-5 mb-3">
          <CzEyebrow>Offer Inbox</CzEyebrow>
        </View>

        <View className="bg-[#13182a] border border-white/5 mx-5 rounded-[18px] overflow-hidden">
          {offers.length === 0 ? (
            <View className="px-4 py-6 items-center">
              <Text className="text-white/40 text-sm">No offers yet</Text>
            </View>
          ) : (
            offers.map((offer: any) => (
              <OfferRow
                key={offer.id}
                offer={offer}
                onRespond={handleRespond}
                isPending={respondMutation.isPending}
              />
            ))
          )}
        </View>
      </View>

      {/* ── Section 3: Earnings Summary ──────────────────────────── */}
      <View className="mt-6">
        <View className="px-5 mb-3">
          <CzEyebrow>Earnings</CzEyebrow>
        </View>

        <View className="bg-[#13182a] border border-white/5 mx-5 rounded-[18px] overflow-hidden">
          {earnings.length === 0 ? (
            <View className="px-4 py-6 items-center">
              <Text className="text-white/40 text-sm">No completed sales yet</Text>
            </View>
          ) : (
            earnings.map((item: any) => (
              <View
                key={item.id}
                className="px-4 py-4 border-b border-white/5"
              >
                <Text className="text-white font-semibold text-sm mb-1">
                  {item.listing?.title ?? 'Sale'}
                </Text>
                <View className="flex-row gap-4">
                  <Text className="text-white/60 text-xs">
                    {`Sold: £${item.soldPrice?.toLocaleString('en-GB')}`}
                  </Text>
                  <Text className="text-white/60 text-xs">
                    {`Fee: £${item.platformFee?.toLocaleString('en-GB')}`}
                  </Text>
                  <Text className="text-[#34d399] text-xs font-bold">
                    {`Net: £${(item.net ?? item.netAmount)?.toLocaleString('en-GB')}`}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
