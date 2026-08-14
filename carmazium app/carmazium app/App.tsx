import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { RootNavigator } from './src/navigation/RootNavigator';
import { GlobalToastProvider } from './src/components/GlobalToastProvider';
import { DrawerProvider } from './src/context/DrawerContext';
import { GlobalDrawer } from './src/components/GlobalDrawer';
import { LocationPromptSheet } from './src/components/LocationPromptSheet';
import { Colors } from './src/constants/colors';
import { ChatProvider } from './src/context/ChatContext';
import { LocationProvider } from './src/context/LocationContext';
import { useAuthStore } from './src/store/authStore';
import { supabase } from './src/lib/supabase';
import * as Notifications from 'expo-notifications';
import { addNotificationListeners, registerForPushNotifications } from './src/lib/pushNotifications';
import { navigationRef } from './src/lib/navigationRef';

import { SplashScreen as AppSplashScreen } from './src/screens/loading/SplashScreen';

import { GlobalAIChatBot } from './src/components/GlobalAIChatBot';

SplashScreen.preventAutoHideAsync();

// navigationRef is now a module-level singleton from src/lib/navigationRef.ts
// so it can be imported by GlobalAIChatBot and other non-screen components safely.

// ── Notification type → screen mapping for deep-linking ──────────────────
// Used as a client-side fallback when the backend doesn't include a 'screen'
// field in the notification payload (backend may only send 'type').
const NOTIFICATION_SCREEN_MAP: Record<string, { screen: string; paramsKeys: string[] }> = {
  BID_PLACED:       { screen: 'LiveAuctionDetailed', paramsKeys: ['auctionId'] },
  OUTBID:           { screen: 'LiveAuctionDetailed', paramsKeys: ['auctionId'] },
  AUCTION_ENDING:   { screen: 'LiveAuctionDetailed', paramsKeys: ['auctionId'] },
  AUCTION_WON:      { screen: 'AuctionComplete',     paramsKeys: ['listingId', 'auctionId', 'hammerPrice'] },
  AUCTION_ENDED:    { screen: 'LiveAuctionDetailed', paramsKeys: ['auctionId'] },
  OFFER_RECEIVED:   { screen: 'SellerOffers',        paramsKeys: [] },
  COUNTER_RECEIVED: { screen: 'BuyerOffers',         paramsKeys: [] },
  OFFER_ACCEPTED:   { screen: 'BuyerOffers',         paramsKeys: [] },
  OFFER_REJECTED:   { screen: 'BuyerOffers',         paramsKeys: [] },
  PAYOUT_FAILED:    { screen: 'Settings',            paramsKeys: [] },
};

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const reinitializeAuth = useAuthStore.getState().initializeAuth;

  // ── OTA Updates ────────────────────────────────────────────────
  useEffect(() => {
    const checkUpdates = async () => {
      if (__DEV__) return; // Skip in development
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Non-fatal — user will get the update next launch
      }
    };
    checkUpdates();
  }, []);

  // ── Push Notification listeners ─────────────────────────────────
  useEffect(() => {
    const handleNotificationResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const rawData = response.notification.request.content.data as Record<string, any> | undefined;
      if (!rawData) return;

      // Resolve screen: prefer explicit 'screen' field from backend, fall back to type map
      let targetScreen: string | undefined = rawData.screen;
      let params: Record<string, any> = {};

      if (!targetScreen && rawData.type) {
        const mapping = NOTIFICATION_SCREEN_MAP[rawData.type as string];
        if (mapping) {
          targetScreen = mapping.screen;
          // Build params from the notification data based on notification type
          if (
            rawData.type === 'BID_PLACED' ||
            rawData.type === 'OUTBID' ||
            rawData.type === 'AUCTION_ENDING' ||
            rawData.type === 'AUCTION_ENDED'
          ) {
            // LiveAuctionDetailed expects: { listing: { id: auctionId } }
            params = { listing: { id: rawData.auctionId ?? rawData.entityId } };
          } else if (rawData.type === 'AUCTION_WON') {
            params = {
              listingId: rawData.listingId ?? rawData.entityId,
              auctionId: rawData.auctionId,
              hammerPrice: rawData.hammerPrice ?? 0,
            };
          }
          // For SellerOffers, BuyerOffers, Settings: no params needed
        }
      }

      // Also parse params if backend sent them as JSON string
      if (!Object.keys(params).length && rawData.params) {
        try {
          params = typeof rawData.params === 'string' ? JSON.parse(rawData.params) : rawData.params;
        } catch {
          // ignore
        }
      }

      if (!targetScreen) return; // no screen to navigate to

      // Wait for navigation container to be ready — critical for cold-start
      const navigate = () => {
        if (navigationRef.isReady()) {
          (navigationRef.current as any)?.navigate('Main', {
            screen: targetScreen,
            params,
          });
        } else {
          setTimeout(navigate, 100); // retry every 100ms until nav is ready
        }
      };
      navigate();
    };

    const cleanup = addNotificationListeners(
      (_notification) => {
        // Notification received while app is foregrounded — handled by GlobalToastProvider
      },
      handleNotificationResponse,
    );

    // Handle cold-start: check if app was opened via a notification tap while killed
    // Safe to call on every mount — resolves with null if no pending response
    Notifications.getLastNotificationResponseAsync().then(handleNotificationResponse);

    return cleanup;
  }, []);

  // Register this device for push once the user is authenticated.
  //
  // registerForPushNotifications() was fully implemented but never called from
  // anywhere in the app, so no device was ever registered and no user has ever
  // received a push. It has to run after auth because the token is stored on
  // the user's profile — before sign-in there is nobody to store it against.
  //
  // Keyed on the user id so switching accounts on one device re-registers the
  // token against the account that's now signed in, rather than leaving the
  // previous user's profile holding this device's token.
  const authedUserId = useAuthStore((s) => (s.isAuthenticated ? s.user?.id : undefined));
  useEffect(() => {
    if (!authedUserId) return;
    // Fire-and-forget: it already swallows its own failures, and a failed
    // registration must never block the app from starting.
    registerForPushNotifications(authedUserId);
  }, [authedUserId]);

  const [fontsLoaded] = useFonts({
    'Inter_400Regular': require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
    'Inter_500Medium': require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
    'Inter_600SemiBold': require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
    'Inter_700Bold': require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
    'Inter_800ExtraBold': require('@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf'),
    'Inter_900Black': require('@expo-google-fonts/inter/900Black/Inter_900Black.ttf'),
    'Poppins_300Light': require('@expo-google-fonts/poppins/300Light/Poppins_300Light.ttf'),
    'Poppins_400Regular': require('@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf'),
    'Poppins_500Medium': require('@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf'),
    'Poppins_600SemiBold': require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
    'Poppins_700Bold': require('@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf'),
    'Poppins_800ExtraBold': require('@expo-google-fonts/poppins/800ExtraBold/Poppins_800ExtraBold.ttf'),
    'Montserrat_300Light': require('@expo-google-fonts/montserrat/300Light/Montserrat_300Light.ttf'),
    'Montserrat_400Regular': require('@expo-google-fonts/montserrat/400Regular/Montserrat_400Regular.ttf'),
    'Montserrat_500Medium': require('@expo-google-fonts/montserrat/500Medium/Montserrat_500Medium.ttf'),
    'Montserrat_600SemiBold': require('@expo-google-fonts/montserrat/600SemiBold/Montserrat_600SemiBold.ttf'),
    'Montserrat_700Bold': require('@expo-google-fonts/montserrat/700Bold/Montserrat_700Bold.ttf'),
    'JetBrainsMono_400Regular': require('@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf'),
    'JetBrainsMono_700Bold': require('@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf'),
    'JetBrainsMono_800ExtraBold': require('@expo-google-fonts/jetbrains-mono/800ExtraBold/JetBrainsMono_800ExtraBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      initializeAuth().finally(() => {
        SplashScreen.hideAsync();
      });
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const handleDeepLink = async (url: string | null) => {
      if (!url) return;

      // Parse both hash (implicit flow) and query string (PKCE flow)
      const hashFragment = url.includes('#') ? url.split('#')[1] : '';
      const queryFragment = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
      const hashParams = new URLSearchParams(hashFragment);
      const queryParams = new URLSearchParams(queryFragment);

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      const code = queryParams.get('code'); // PKCE flow

      if (accessToken && refreshToken) {
        // Implicit flow — tokens arrive in the URL hash (email links + Google OAuth)
        try {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (type === 'recovery') {
            setTimeout(() => {
              (navigationRef.current as any)?.navigate('Auth', { screen: 'ResetPassword' });
            }, 300);
          } else {
            await reinitializeAuth();
          }
        } catch (err) {
          console.warn('Failed to set session from link:', err);
        }
      } else if (code) {
        // PKCE flow — exchange the code for a session (fallback safety net)
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) await reinitializeAuth();
        } catch (err) {
          console.warn('Failed to exchange OAuth code for session:', err);
        }
      }
    };

    Linking.getInitialURL().then(handleDeepLink);

    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return <AppSplashScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
      merchantIdentifier="merchant.uk.carmazium.app"
      urlScheme="carmazium"
    >
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        theme={{
          dark: true,
          colors: {
            primary: Colors.accent,
            background: Colors.bgPrimary,
            card: Colors.bgSecondary,
            text: Colors.textPrimary,
            border: Colors.glassBorder,
            notification: Colors.accent,
          },
          fonts: {
            regular: { fontFamily: 'System', fontWeight: 'normal' },
            medium: { fontFamily: 'System', fontWeight: '500' },
            bold: { fontFamily: 'System', fontWeight: 'bold' },
            heavy: { fontFamily: 'System', fontWeight: '900' },
          } as any,
        }}
      >
        <DrawerProvider>
          <LocationProvider>
            <ChatProvider>
              <GlobalToastProvider>
                <RootNavigator />
              </GlobalToastProvider>
            </ChatProvider>
          </LocationProvider>
          {/* GlobalDrawer sits inside DrawerProvider but renders as a Modal,
              so it overlays every screen automatically */}
          <GlobalDrawer />
          {/* Global AI Chat Bot floating over every screen */}
          <GlobalAIChatBot />
          {/* Asks accounts predating the mandatory location/postcode fields
              (backend 53c5acca) to supply them — those users never went
              through a step that collects them. Renders itself only when
              genuinely missing, and gates internally on being authenticated
              and past onboarding. */}
          <LocationPromptSheet />
        </DrawerProvider>
        <StatusBar style="light" />
      </NavigationContainer>
    </SafeAreaProvider>
    </StripeProvider>
    </GestureHandlerRootView>
  );
}
