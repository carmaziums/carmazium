import React, { useEffect } from 'react';
import { Alert } from 'react-native';
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
import { linking } from './src/navigation/linking';
import { OfflineBanner } from './src/components/OfflineBanner';
import { startNetworkMonitor } from './src/lib/network';
import { GlobalToastProvider } from './src/components/GlobalToastProvider';
import { DrawerProvider } from './src/context/DrawerContext';
import { GlobalDrawer } from './src/components/GlobalDrawer';
import { LocationPromptSheet } from './src/components/LocationPromptSheet';
import { ProfileCompletionPromptSheet } from './src/components/ProfileCompletionPromptSheet';
import { Colors } from './src/constants/colors';
import { ChatProvider } from './src/context/ChatContext';
import { LocationProvider } from './src/context/LocationContext';
import { useAuthStore } from './src/store/authStore';
import { supabase } from './src/lib/supabase';
import * as Notifications from 'expo-notifications';
import { addNotificationListeners, registerForPushNotifications } from './src/lib/pushNotifications';
import { navigationRef } from './src/lib/navigationRef';
import { isDealerInviteUrl, extractDealerInviteToken } from './src/lib/dealerInviteLink';
import { markNotificationRead } from './src/lib/notificationsApi';
import { resolveMobileNotificationTarget } from './src/lib/notificationRouting';

import { SplashScreen as AppSplashScreen } from './src/screens/loading/SplashScreen';

import { GlobalAIChatBot } from './src/components/GlobalAIChatBot';

SplashScreen.preventAutoHideAsync();

// navigationRef is now a module-level singleton from src/lib/navigationRef.ts
// so it can be imported by GlobalAIChatBot and other non-screen components safely.

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const authInitialized = useAuthStore((state) => state.authInitialized);
  const subscribeToAuthChanges = useAuthStore.getState().subscribeToAuthChanges;
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
    const handleNotificationResponse = (
      response: Notifications.NotificationResponse | null,
    ) => {
      if (!response) return;
      const rawData = response.notification.request.content.data as
        | Record<string, any>
        | undefined;
      if (!rawData) return;

      let attempts = 0;

      const resolveAndNavigate = async () => {
        const auth = useAuthStore.getState();

        if (!navigationRef.isReady() || !auth.authInitialized) {
          attempts += 1;
          if (attempts <= 120) {
            setTimeout(() => { void resolveAndNavigate(); }, 100);
          }
          return;
        }

        if (!auth.isAuthenticated) return;

        if (typeof rawData.notifId === 'string') {
          markNotificationRead(rawData.notifId).catch(() => {});
        }

        const target = await resolveMobileNotificationTarget(
          rawData,
          auth.role,
        ).catch(() => null);

        const resolved = target ?? { screen: 'Notifications' };

        (navigationRef.current as any)?.navigate('Main', {
          screen: resolved.screen,
          params: resolved.params,
        });
      };

      void resolveAndNavigate();
    };

    const cleanup = addNotificationListeners(
      (_notification) => {
        // Foreground presentation is handled by GlobalToastProvider. Taps still
        // enter through the shared response handler above.
      },
      handleNotificationResponse,
    );

    // Cold-start: Expo retains the response that launched the app.
    Notifications.getLastNotificationResponseAsync()
      .then(handleNotificationResponse)
      .catch(() => {});

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

  // Only the nine variants actually referenced anywhere in src/ are loaded.
  // This used to load twenty — including all six weights of Inter, which the
  // app never uses at all (typography.ts pairs Poppins with Montserrat), plus
  // four other unreferenced weights. Every one of them was read from disk
  // before the splash screen could be dismissed, so the app held a blank
  // screen loading fonts nothing would ever render in. Verified by grepping
  // every literal font-family string in src/ — if you add a weight to
  // FontFamily or TextPresets, add it here too or it will silently fall back
  // to the system font.
  const [fontsLoaded] = useFonts({
    'Poppins_600SemiBold': require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
    'Poppins_700Bold': require('@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf'),
    'Poppins_800ExtraBold': require('@expo-google-fonts/poppins/800ExtraBold/Poppins_800ExtraBold.ttf'),
    'Montserrat_400Regular': require('@expo-google-fonts/montserrat/400Regular/Montserrat_400Regular.ttf'),
    'Montserrat_500Medium': require('@expo-google-fonts/montserrat/500Medium/Montserrat_500Medium.ttf'),
    'Montserrat_600SemiBold': require('@expo-google-fonts/montserrat/600SemiBold/Montserrat_600SemiBold.ttf'),
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

  // One app-wide Supabase auth subscription (AUTH-013). Mounted here rather
  // than inside a screen so it observes a remote sign-out or a failed token
  // refresh wherever the user happens to be.
  useEffect(() => subscribeToAuthChanges(), [subscribeToAuthChanges]);

  // Reachability monitor (CROSS-015). Started once, for the life of the app,
  // so apiClient's OFFLINE sentinel and the banner share one source of truth.
  useEffect(() => startNetworkMonitor(), []);

  useEffect(() => {
    // Supabase auth callbacks only. Everything else routes through React
    // Navigation's `linking` config (navigation/linking.ts), whose `filter`
    // excludes exactly the URLs this handler claims, so the two never both act
    // on one link.
    //
    // Web handles seven ordered branches (`auth/callback/page.tsx:44-199`);
    // mobile handled two — implicit tokens and a bare PKCE exchange — with no
    // error branch, no rescue when the code was already consumed, and no
    // timeout, so a link that failed left the user on the splash with no
    // feedback at all (AUTH-019). The branch order below mirrors web's.
    const handleDeepLink = async (url: string | null) => {
      if (!url) return;

      // On cold start the Auth navigator is the only mounted stack for a
      // signed-out user. Save trusted dealer-invite links until that invited
      // account has signed in and finished its required onboarding. Linking's
      // filter routes these links exclusively here to avoid duplicate dispatch.
      if (isDealerInviteUrl(url)) {
        const token = extractDealerInviteToken(url);
        if (token) {
          useAuthStore.getState().captureDealerInviteToken(token);
        } else {
          Alert.alert('Invalid invitation', 'Use the complete link from your invitation email.');
        }
        return;
      }

      const hashFragment = url.includes('#') ? url.split('#')[1] : '';
      const queryFragment = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
      const hashParams = new URLSearchParams(hashFragment);
      const queryParams = new URLSearchParams(queryFragment);

      // 1. Error param — Supabase reports failures this way (expired link,
      //    already-used link). Previously ignored entirely, so an expired
      //    verification link looked identical to a working one that did nothing.
      const errorCode = queryParams.get('error') || hashParams.get('error');
      if (errorCode) {
        const description =
          queryParams.get('error_description') || hashParams.get('error_description') || errorCode;
        Alert.alert('Sign-in link problem', decodeURIComponent(description.replace(/\+/g, ' ')));
        return;
      }

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      const code = queryParams.get('code');
      // Supabase PKCE recovery redirects can lack ?type=recovery. The native
      // reset-password destination itself is authoritative when it carries
      // the exchange code; a recovery hash may instead carry the type.
      const isRecovery =
        type === 'recovery' ||
        queryParams.get('type') === 'recovery' ||
        /^carmazium:\/\/reset-password(?:[?#]|$)/i.test(url);
      const auth = useAuthStore.getState();
      // A cold URL and a foreground URL event can deliver the SAME one-time
      // code. Suppress a second redemption while the first is still opening.
      if (isRecovery && auth.passwordRecoveryStatus !== 'idle') return;
      const recoveryFlow = isRecovery && !!((accessToken && refreshToken) || code);
      if (recoveryFlow) auth.startPasswordRecovery();

      const callbackRoleRaw = queryParams.get('role');
      const callbackRole =
        callbackRoleRaw === 'BUYER' || callbackRoleRaw === 'DEALER'
          ? callbackRoleRaw
          : undefined;

      // A link that reaches none of the branches below must not leave the user
      // staring at a splash screen forever — web keeps a 15s safety timer for
      // the same reason.
      let settled = false;
      let timedOut = false;
      const safety = setTimeout(() => {
        if (!settled) {
          timedOut = true;
          if (recoveryFlow) {
            // An in-flight SDK exchange cannot be aborted reliably. Keep the
            // recovery guard active until it settles; a late SIGNED_IN event
            // must never hydrate recovery credentials as normal auth.
            Alert.alert('Recovery link is slow', 'The secure link is still being checked. If it completes too late, request a fresh reset link.');
          } else {
            Alert.alert('Sign-in link timed out', 'Please try opening the link again, or sign in manually.');
          }
        }
      }, 15000);

      const discardLateExchange = async (): Promise<boolean> => {
        if (!timedOut) return false;
        // Never let a recovery session arriving after the safety deadline
        // become an ordinary authenticated dashboard session.
        if (recoveryFlow) await supabase.auth.signOut();
        return true;
      };

      try {
        // 2. Implicit flow — tokens in the hash (email links, Google OAuth).
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (await discardLateExchange()) return;
          if (recoveryFlow) {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user || !session.access_token) throw new Error('Recovery session unavailable. Request a new link.');
            if (await discardLateExchange()) return;
            useAuthStore.getState().finishPasswordRecovery();
          } else {
            await reinitializeAuth(callbackRole);
          }
          return;
        }

        // 3. PKCE — exchange the code, with the two rescues web needs.
        if (code) {
          // An already-signed-in user may open a stale recovery URL. Never
          // interpret their pre-existing session as proof that a bad recovery
          // code was successfully redeemed.
          const priorAccessToken = recoveryFlow
            ? (await supabase.auth.getSession()).data.session?.access_token
            : undefined;
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              // The code may already have been consumed by the global
              // onAuthStateChange subscription (AUTH-013) racing us to it. A
              // session existing is success, not failure.
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.user || (recoveryFlow && session.access_token === priorAccessToken)) {
                throw new Error(error.message);
              }
            }
          } catch (exchangeErr: any) {
            // Same rescue for the abort case, which is what that race throws.
            const aborted =
              exchangeErr?.name === 'AbortError' || String(exchangeErr?.message ?? '').includes('aborted');
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user || (recoveryFlow && session.access_token === priorAccessToken)) {
              throw new Error(
                aborted ? 'Please try opening the link again.' : (exchangeErr?.message ?? 'Unknown error'),
              );
            }
          }

          if (await discardLateExchange()) return;
          if (recoveryFlow) {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user || !session.access_token) throw new Error('Recovery session unavailable. Request a new link.');
            if (await discardLateExchange()) return;
            useAuthStore.getState().finishPasswordRecovery();
          } else {
            await reinitializeAuth(callbackRole);
          }
          return;
        }

        // 4. No tokens and no code — if a session already exists this link was
        //    redundant, which is fine. Otherwise it is not ours to handle and
        //    React Navigation's linking config will have taken it.
      } catch (err: any) {
        if (recoveryFlow) {
          // A partial/invalid recovery exchange must not leave a restricted
          // Supabase session usable after the recovery guard is removed.
          await supabase.auth.signOut().catch(() => {});
          useAuthStore.getState().clearPasswordRecovery();
        }
        Alert.alert('Could not complete sign-in', err?.message ?? 'Please try again.');
      } finally {
        // Invalid and expired recovery links must never leave a loading screen
        // or be mistaken for a verified ordinary sign-in.
        if (recoveryFlow && useAuthStore.getState().passwordRecoveryStatus === 'opening') {
          useAuthStore.getState().clearPasswordRecovery();
        }
        settled = true;
        clearTimeout(safety);
      }
    };

    Linking.getInitialURL().then(handleDeepLink);

    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  // Wait for the session check as well as the fonts. Gating on fonts alone
  // mounted RootNavigator while initializeAuth was still running, with
  // isAuthenticated still at its initial false — so a signed-in user saw the
  // Login screen flash before their session was restored (AUTH-035).
  if (!fontsLoaded || !authInitialized) {
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
        // AUTH-020: the container had no `linking` prop at all, so React
        // Navigation never routed an inbound URL and every deep link fell to
        // the ad-hoc listener above, which only understood Supabase tokens.
        linking={linking}
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
          {/* Same nudge pattern for name/phone (DASH-003). Defers to the
              location prompt when both would fire, so two bottom sheets never
              stack. */}
          <ProfileCompletionPromptSheet />
          {/* Above everything and outside the navigator, so it covers every
              route including ones added later. Renders null when online. */}
          <OfflineBanner />
        </DrawerProvider>
        <StatusBar style="light" />
      </NavigationContainer>
    </SafeAreaProvider>
    </StripeProvider>
    </GestureHandlerRootView>
  );
}
