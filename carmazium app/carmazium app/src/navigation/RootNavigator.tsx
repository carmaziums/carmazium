import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainStackNavigator, MainStackParamList } from './MainStackNavigator';
import { PostSignupOnboardingScreen } from '../screens/auth/PostSignupOnboardingScreen';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';
import { Colors } from '../constants/colors';
import { navigationRef } from '../lib/navigationRef';

export type RootStackParamList = {
  Auth: undefined;
  VerifyEmail: undefined;
  PostSignupOnboarding: undefined;
  Main: NavigatorScreenParams<MainStackParamList> | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const pendingEmailVerification = useAuthStore((s) => s.pendingEmailVerification);
  const postLoginRedirect = useAuthStore((s) => s.postLoginRedirect);
  const consumePostLoginRedirect = useAuthStore((s) => s.consumePostLoginRedirect);

  // Restore the screen the user was on when their session expired, once the
  // Main stack actually exists to navigate within (AUTH-034). Web does this
  // with `?redirect=`; here the destination is captured in forceLogout() and
  // consumed exactly once.
  const canRestore = isAuthenticated && hasCompletedOnboarding && !!postLoginRedirect;
  useEffect(() => {
    if (!canRestore) return;
    // One frame after the stack swap: navigating in the same tick targets the
    // navigator that is being unmounted. The existing deep-link handler in
      // App.tsx defers for the same reason.
    const id = setTimeout(() => {
      const target = consumePostLoginRedirect();
      if (!target) return;
      try {
        if (navigationRef.isReady()) {
          (navigationRef.navigate as (name: string, params?: object) => void)('Main', { screen: target.name, params: target.params });
        }
      } catch {
        // A route that no longer exists must not strand the user on a blank
        // screen — they are signed in, and Main's default route is a fine
        // place to be.
      }
    }, 300);
    return () => clearTimeout(id);
  }, [canRestore, consumePostLoginRedirect]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: Colors.bgPrimary },
      }}
    >
      {pendingEmailVerification ? (
        // Signed up but email not yet verified — no real Supabase session exists.
        // Show VerifyEmail screen; it subscribes to onAuthStateChange and calls
        // initializeAuth() automatically when the user clicks the link.
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      ) : !isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !hasCompletedOnboarding ? (
        <Stack.Screen name="PostSignupOnboarding" component={PostSignupOnboardingScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainStackNavigator} />
      )}
    </Stack.Navigator>
  );
};
