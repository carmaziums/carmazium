import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { CZM } from '@/constants/tokens';

export default function DashboardIndex() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CZM.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={CZM.red} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/onboarding" />;
  if (user.role === 'DEALER') return <Redirect href="/dashboard/dealer" />;
  if (user.role === 'SELLER') return <Redirect href="/dashboard/seller" />;
  return <Redirect href="/dashboard/buyer" />;
}
