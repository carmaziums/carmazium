import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { GlobalToastProvider } from './src/components/GlobalToastProvider';
import { DrawerProvider } from './src/context/DrawerContext';
import { GlobalDrawer } from './src/components/GlobalDrawer';
import { Colors } from './src/constants/colors';
import { ChatProvider } from './src/context/ChatContext';
import { useAuthStore } from './src/store/authStore';
import { supabase } from './src/lib/supabase';
import { addNotificationListeners } from './src/lib/pushNotifications';

import { SplashScreen as AppSplashScreen } from './src/screens/loading/SplashScreen';

import { GlobalAIChatBot } from './src/components/GlobalAIChatBot';

// ── Sentry error monitoring ──────────────────────────────────────
// Fill EXPO_PUBLIC_SENTRY_DSN in .env and eas.json once you create the
// project at https://sentry.io → Settings → Projects → Client Keys (DSN)
if (!__DEV__ && process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: process.env.APP_ENV ?? 'production',
    enableNativeNagger: false,
    tracesSampleRate: 0.2,   // 20% of transactions for performance monitoring
    enableAutoSessionTracking: true,
  });
}

SplashScreen.preventAutoHideAsync();

const navigationRef = React.createRef<NavigationContainerRef<any>>();

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
    const cleanup = addNotificationListeners(
      (_notification) => {
        // Notification received while app is foregrounded — handled silently
      },
      (response) => {
        // User tapped a notification — navigate to relevant screen
        const data = response.notification.request.content.data as Record<string, string>;
        if (data?.screen) {
          (navigationRef.current as any)?.navigate(data.screen, data.params ?? {});
        }
      }
    );
    return cleanup;
  }, []);

  const [fontsLoaded] = useFonts({
    'Inter_400Regular': require('@expo-google-fonts/inter/Inter_400Regular.ttf'),
    'Inter_500Medium': require('@expo-google-fonts/inter/Inter_500Medium.ttf'),
    'Inter_600SemiBold': require('@expo-google-fonts/inter/Inter_600SemiBold.ttf'),
    'Inter_700Bold': require('@expo-google-fonts/inter/Inter_700Bold.ttf'),
    'Inter_800ExtraBold': require('@expo-google-fonts/inter/Inter_800ExtraBold.ttf'),
    'Inter_900Black': require('@expo-google-fonts/inter/Inter_900Black.ttf'),
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

      // Supabase sends tokens in the hash fragment for recovery links
      const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] || '';
      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (accessToken && refreshToken) {
        try {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (type === 'recovery') {
            // Password reset link
            setTimeout(() => {
              (navigationRef.current as any)?.navigate('Auth', { screen: 'ResetPassword' });
            }, 300);
          } else {
            // Email verification link (type === 'signup' or 'email_change') —
            // re-run initializeAuth so the store transitions from
            // pendingEmailVerification → isAuthenticated properly.
            await reinitializeAuth();
          }
        } catch (err) {
          console.warn('Failed to set session from email link:', err);
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
          <ChatProvider>
            <GlobalToastProvider>
              <RootNavigator />
            </GlobalToastProvider>
          </ChatProvider>
          {/* GlobalDrawer sits inside DrawerProvider but renders as a Modal,
              so it overlays every screen automatically */}
          <GlobalDrawer />
          {/* Global AI Chat Bot floating over every screen */}
          <GlobalAIChatBot />
        </DrawerProvider>
        <StatusBar style="light" />
      </NavigationContainer>
    </SafeAreaProvider>
    </StripeProvider>
    </GestureHandlerRootView>
  );
}
