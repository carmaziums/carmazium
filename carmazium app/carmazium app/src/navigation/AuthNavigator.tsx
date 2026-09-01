import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { TermsScreen } from '../screens/main/TermsScreen';
import { Colors } from '../constants/colors';
import { useAuthStore } from '../store/authStore';

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  // Registered here too (not just MainStackNavigator) so a pre-signup user can
  // actually read the Terms they're being asked to agree to — RootNavigator
  // renders Auth/Main as mutually exclusive stacks, so MainStackNavigator's
  // copy of this screen is unreachable before login (mobile-production-
  // readiness-plan.md F13).
  Terms: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  // The carousel is marketing shown once, not a gate. It used to be the initial
  // route on every signed-out launch, and tapping through it wrote the
  // post-signup wizard's completion flag (AUTH-003) — so it was both repetitive
  // and destructive. Now it has its own flag and is skipped once seen.
  // `hasSeenIntro` is hydrated by initializeAuth before this renders; the worst
  // case if that read fails is the carousel showing once more, never a skipped
  // wizard.
  const hasSeenIntro = useAuthStore((s) => s.hasSeenIntro);

  return (
    <Stack.Navigator
      initialRouteName={hasSeenIntro ? 'Login' : 'Onboarding'}
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
        contentStyle: { backgroundColor: Colors.bgPrimary },
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
};
