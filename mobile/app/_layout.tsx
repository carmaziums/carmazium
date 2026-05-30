import '../global.css';
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Montserrat_400Regular,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { dashboardApi } from '@/lib/api';
import { apiRequest } from '@/lib/api/client';
import { ENDPOINTS } from '@/constants/api';
import { registerForPushNotificationsAsync } from '@/hooks/usePushNotifications';
import { useNotifSocket } from '@/hooks/useNotifSocket';
import { useNotificationsStore } from '@/store/notification.store';

// ─── Module-level notification setup ─────────────────────────────────────────
// These must run before any component mounts.

// Controls how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

// Android 8+ requires channels to exist before the first notification arrives.
// Creating channels is idempotent — safe to call every launch.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('carmazium-default', {
    name:             'Carmazium Notifications',
    importance:       Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor:       '#ff0037',
    showBadge:        true,
  });
  Notifications.setNotificationChannelAsync('carmazium-bids', {
    name:             'Auction Bids',
    importance:       Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 100, 100, 100],
    lightColor:       '#ff0037',
    showBadge:        true,
  });
  Notifications.setNotificationChannelAsync('carmazium-messages', {
    name:      'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    showBadge: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Montserrat_400Regular,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    JetBrainsMono_700Bold,
  });

  const { setUser, setLoading } = useAuthStore();

  // Holds the push-token rotation subscription so it can be removed on re-auth
  const tokenSubRef = useRef<Notifications.Subscription | null>(null);

  // ── Auth state + push token registration ──────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          try {
            const user = await dashboardApi.me();
            setUser(user);

            // Register device for push notifications after session confirmed
            const token = await registerForPushNotificationsAsync();

            if (token) {
              // Listen for token rotation and keep backend in sync
              tokenSubRef.current?.remove();
              tokenSubRef.current = Notifications.addPushTokenListener(
                async ({ data: newToken }: { data: string }) => {
                  try {
                    await apiRequest(ENDPOINTS.USERS_ME, {
                      method: 'PATCH' as any,
                      body: { preferences: { expoPushToken: newToken } },
                    });
                  } catch (err) {
                    console.error('[Push] Token rotation update failed', err);
                  }
                },
              );
            }
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
          // Remove token rotation listener on sign-out
          tokenSubRef.current?.remove();
          tokenSubRef.current = null;
        }
        setLoading(false);
      },
    );

    return () => {
      subscription.unsubscribe();
      tokenSubRef.current?.remove();
    };
  }, []);

  // ── Notification response listeners (deep-link routing) ───────────────────
  useEffect(() => {
    const { setPendingDeepLink } = useNotificationsStore.getState();

    // Warm-start: app in background, user taps a notification
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const link = response.notification.request.content.data?.link as string | undefined;
        if (link) {
          router.push(link as any);
        }
      },
    );

    // Cold-start: app was killed when notification arrived — router not mounted yet.
    // Store the link in Zustand; (tabs)/_layout.tsx consumes it once the navigator mounts.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const link = response.notification.request.content.data?.link as string | undefined;
        if (link) {
          setPendingDeepLink(link);
        }
      }
    });

    return () => responseListener.remove();
  }, []);

  // ── Socket bridge: /notifications → local push banner ─────────────────────
  useNotifSocket();

  // ── Splash screen ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0d14' } }}>
            <Stack.Screen name="(auth)"                    options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)"                    options={{ animation: 'none' }} />
            <Stack.Screen name="vehicle/[id]"              options={{ presentation: 'card',  animation: 'slide_from_right' }} />
            <Stack.Screen name="auction/[id]"              options={{ presentation: 'modal' }} />
            <Stack.Screen name="messages/index"            options={{ presentation: 'card',  animation: 'slide_from_right' }} />
            <Stack.Screen name="messages/[roomId]"         options={{ presentation: 'card',  animation: 'slide_from_right' }} />
            <Stack.Screen name="notifications/index"       options={{ presentation: 'card',  animation: 'slide_from_right' }} />
            <Stack.Screen name="notification-prefs/index"  options={{ presentation: 'card',  animation: 'slide_from_right' }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
