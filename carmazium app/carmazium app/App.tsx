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
import { Colors } from './src/constants/colors';
import { ChatProvider } from './src/context/ChatContext';
import { useAuthStore } from './src/store/authStore';
import { supabase } from './src/lib/supabase';
import { addNotificationListeners } from './src/lib/pushNotifications';
import { navigationRef } from './src/lib/navigationRef';

import { SplashScreen as AppSplashScreen } from './src/screens/loading/SplashScreen';

import { GlobalAIChatBot } from './src/components/GlobalAIChatBot';

SplashScreen.preventAutoHideAsync();

// navigationRef is now a module-level singleton from src/lib/navigationRef.ts
// so it can be imported by GlobalAIChatBot and other non-screen components safely.

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
    const handleNotificationResponse = (response: any) => {
      const rawData = response?.notification?.request?.content?.data as Record<string, any> | undefined;
      if (!rawData?.screen) return;

      // Params may arrive as a serialised JSON string from some push providers
      let params: Record<string, any> = {};
      if (rawData.params) {
        try {
          params = typeof rawData.params === 'string'
            ? JSON.parse(rawData.params)
            : rawData.params;
        } catch {
          // Not valid JSON — ignore params
        }
      }

      // All authenticated screens live inside "Main" in the root stack.
      // navigate('Main', { screen, params }) properly deep-links through the hierarchy.
      (navigationRef.current as any)?.navigate('Main', {
        screen: rawData.screen,
        params,
      });
    };

    const cleanup = addNotificationListeners(
      (_notification) => {
        // Notification received while app is foregrounded — handled silently
      },
      handleNotificationResponse,
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
