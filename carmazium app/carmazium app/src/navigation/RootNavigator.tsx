import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainStackNavigator, MainStackParamList } from './MainStackNavigator';
import { PostSignupOnboardingScreen } from '../screens/auth/PostSignupOnboardingScreen';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';

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

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#0A0A0C' },
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
