import { useEffect } from 'react';
import { Tabs, Redirect, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useNotificationsStore } from '@/store/notification.store';
import { CZM, FONT } from '@/constants/tokens';

export default function TabsLayout() {
  const { user, loading } = useAuthStore();
  const router = useRouter();

  // Cold-start deep-link: _layout.tsx cannot call router.push() before the
  // navigator mounts. We stored the link in Zustand — consume it here once
  // the tab navigator is ready.
  useEffect(() => {
    const { pendingDeepLink, clearPendingDeepLink } = useNotificationsStore.getState();
    if (pendingDeepLink) {
      clearPendingDeepLink();
      router.push(pendingDeepLink as any);
    }
  }, []);

  if (!loading && !user) return <Redirect href="/(auth)/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor:  'rgba(10,13,20,0.85)',
          borderTopColor:   'rgba(255,255,255,0.08)',
          borderTopWidth:   1,
          height:           68,
          paddingBottom:    12,
          paddingTop:       8,
          position:         'absolute',
        },
        tabBarActiveTintColor:   CZM.red,
        tabBarInactiveTintColor: CZM.fg3,
        tabBarLabelStyle: {
          fontFamily:    FONT.bodyBold,
          fontSize:      9.5,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginTop:     2,
        },
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Home'   }} />
      <Tabs.Screen name="search"  options={{ title: 'Search' }} />
      <Tabs.Screen name="live"    options={{ title: 'Live'   }} />
      <Tabs.Screen name="saved"   options={{ title: 'Saved'  }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile'}} />
    </Tabs>
  );
}
