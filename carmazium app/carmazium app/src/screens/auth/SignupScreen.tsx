import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Ionicons, GoogleIcon, AppleIcon } from '@/components/BrandIcon';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { KeyboardStickyView } from '../../components/KeyboardStickyView';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Colors } from '../../constants/colors';
import { useNativeAppearance } from '../../theme/NativeAppearanceProvider';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';

import { IconButton } from '../../components/IconButton';
type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const { palette, resolvedAppearance } = useNativeAppearance();
  const themed = useSignupScreenPalette();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  // Public account choice matches web: Personal Account (BUYER) or Partner
  // Account (DEALER compatibility role). SELLER is not a separate signup type:
  // a Personal Account may both buy and sell. Additional Partner capabilities
  // are additive and are granted/verified after signup.
  //
  // Choosing Partner Account does not make a dealer verified. Dealer bidding
  // and other protected trade tools still require the normal KYC approval.
  const [role, setRole] = useState<'BUYER' | 'DEALER'>('BUYER');

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const { signup, isLoading } = useAuthStore();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;
  const isFormValid = !!(name && email && password.length >= 8 && passwordsMatch && agreeTerms);

  const handleGoogleSignIn = async () => {
    setFormError(null);
    setIsGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `carmazium://auth/callback?role=${encodeURIComponent(role)}`,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        await Linking.openURL(data.url);
      } else {
        throw new Error('Could not get sign-in URL. Is Google enabled in Supabase?');
      }
    } catch (err: any) {
      setFormError(err.message || 'Unable to start Google sign-in.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setFormError(null);
    setIsAppleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `carmazium://auth/callback?role=${encodeURIComponent(role)}`,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        await Linking.openURL(data.url);
      } else {
        throw new Error('Could not get Apple sign-in URL.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Unable to start Apple sign-in.');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const getPasswordStrength = (): { activeBars: number; label: string; color: string } => {
    const len = password.length;
    if (len === 0) return { activeBars: 0, label: '', color: Colors.error };
    if (len <= 5) return { activeBars: 1, label: 'WEAK', color: Colors.error };
    if (len <= 7) return { activeBars: 2, label: 'FAIR', color: Colors.warning };
    if (len <= 10) return { activeBars: 3, label: 'STRONG', color: Colors.success };
    return { activeBars: 4, label: 'VERY STRONG', color: Colors.success };
  };

  const passwordStrength = getPasswordStrength();

  const handleSignup = async () => {
    if (!isFormValid) return;
    setFormError(null);
    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please try again.');
      return;
    }
    try {
      await signup(email.trim(), password, name, role);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred during account creation.');
    }
  };

  return (
    <View style={themed.container}>
      <StatusBar barStyle={resolvedAppearance === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor={palette.bgBody} />

      {/* Background gradient with top glow */}
      <LinearGradient
        colors={[Colors.accentAlpha08, Colors.bgPrimary, Colors.bgPrimary]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardStickyView behavior="padding" style={themed.flex}>
        <ScrollView
          contentContainerStyle={themed.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button with circle border */}
          <IconButton style={themed.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />

          {/* Header section */}
          <View style={themed.headerSection}>
            <Text style={themed.stepIndicator}>STEP 1 OF 3</Text>
            <Text style={themed.titleText}>
              Create your <Text style={themed.titleRed}>account.</Text>
            </Text>
            <Text style={themed.subtitleText}>
              Auction listing is free. Retail listing is £1. Choose the account that matches how you will use CarMazium.
            </Text>
          </View>

          {/* Form Fields */}
          <View style={themed.formContainer}>
            {formError ? (
              <View style={{ marginBottom: 16 }}>
                <ErrorBanner message={formError} />
              </View>
            ) : null}
            {/* Account type (AUTH-005) — mobile previously hardcoded BUYER with
                no way to register as a dealer at all. */}
            <View style={themed.fieldGroup}>
              <Text style={themed.fieldLabel}>I AM A</Text>
              <View style={themed.roleRow}>
                {([
                  { value: 'BUYER' as const, label: 'Buyer / Seller', hint: 'Buy and sell vehicles', icon: 'person-outline' as const },
                  { value: 'DEALER' as const, label: 'Partner Account', hint: 'Trade vehicles; bidding and services require approval', icon: 'business-outline' as const },
                ]).map(opt => {
                  const selected = role === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[themed.roleCard, selected && styles.roleCardActive]}
                      onPress={() => setRole(opt.value)}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${opt.label}. ${opt.hint}`}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={18}
                        color={selected ? Colors.accent : Colors.textMuted}
                      />
                      <Text style={[themed.roleCardLabel, selected && styles.roleCardLabelActive]}>{opt.label}</Text>
                      <Text style={themed.roleCardHint}>{opt.hint}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {role === 'DEALER' && (
                <Text style={themed.roleNote}>
                  Complete business/KYC verification before dealer-auction bidding. Additional service capabilities may require separate approval.
                </Text>
              )}
            </View>

            {/* Full Name */}
            <View style={themed.fieldGroup}>
              <Text style={themed.fieldLabel}>FULL NAME</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'name' && styles.inputFocused,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={focusedField === 'name' ? Colors.accent : Colors.textMuted}
                  style={themed.inputIcon}
                />
                <TextInput
                  style={themed.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Alex Thompson"
                  placeholderTextColor={Colors.inputPlaceholder}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

            {/* Email Address */}
            <View style={themed.fieldGroup}>
              <Text style={themed.fieldLabel}>EMAIL ADDRESS</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'email' && styles.inputFocused,
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={focusedField === 'email' ? Colors.accent : Colors.textMuted}
                  style={themed.inputIcon}
                />
                <TextInput
                  ref={emailRef}
                  style={themed.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor={Colors.inputPlaceholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            </View>

            {/* Password */}
            <View style={themed.fieldGroup}>
              <Text style={themed.fieldLabel}>PASSWORD</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'password' && styles.inputFocused,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={focusedField === 'password' ? Colors.accent : Colors.textMuted}
                  style={themed.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={themed.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.inputPlaceholder}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                />
                <IconButton style={themed.eyeBtn} icon={<Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />} onPress={() => setShowPassword(!showPassword)} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} />
              </View>
            </View>

            {/* Password Strength Indicator */}
            <View style={themed.strengthContainer}>
              <View style={themed.strengthBars}>
                {[1, 2, 3, 4].map((bar) => (
                  <View
                    key={bar}
                    style={[
                      styles.strengthBar,
                      bar <= passwordStrength.activeBars && {
                        backgroundColor: passwordStrength.color,
                      },
                    ]}
                  />
                ))}
              </View>
              {passwordStrength.label ? (
                <Text style={[themed.strengthText, { color: passwordStrength.color }]}>
                  {passwordStrength.label}
                </Text>
              ) : null}
            </View>

            {/* Confirm Password */}
            <View style={themed.fieldGroup}>
              <Text style={themed.fieldLabel}>CONFIRM PASSWORD</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'confirmPassword' && styles.inputFocused,
                  confirmPassword.length > 0 && !passwordsMatch && styles.inputError,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={focusedField === 'confirmPassword' ? Colors.accent : Colors.textMuted}
                  style={themed.inputIcon}
                />
                <TextInput
                  ref={confirmPasswordRef}
                  style={themed.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.inputPlaceholder}
                  secureTextEntry={!showConfirmPassword}
                  returnKeyType="done"
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={handleSignup}
                />
                <IconButton style={themed.eyeBtn} icon={<Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />} onPress={() => setShowConfirmPassword(!showConfirmPassword)} accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'} />
              </View>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <Text style={themed.fieldError}>Passwords do not match</Text>
              )}
            </View>

            {/* Terms checkbox */}
            <TouchableOpacity
              style={themed.checkboxContainer}
              activeOpacity={0.8}
              onPress={() => setAgreeTerms(!agreeTerms)}
            >
              <View style={[themed.checkbox, agreeTerms && styles.checkboxChecked]}>
                {agreeTerms && <Ionicons name="checkmark" size={12} color={Colors.white} />}
              </View>
              <Text style={themed.checkboxLabel}>
                I agree to the{' '}
                <Text style={themed.boldText} onPress={() => navigation.navigate('Terms')}>Terms</Text> and{' '}
                <Text style={themed.boldText} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>.
              </Text>
            </TouchableOpacity>

            {/* CTA Button */}
            <View style={themed.ctaWrapper}>
              <PrimaryCTA
                label="CONTINUE"
                onPress={handleSignup}
                isLoading={isLoading}
                disabled={!isFormValid}
                hasChamfer={true}
                icon={<Ionicons name="arrow-forward" size={16} color={Colors.white} />}
                iconPosition="right"
              />
            </View>

            {/* Divider */}
            <View style={themed.dividerRow}>
              <View style={themed.dividerLine} />
              <Text style={themed.dividerText}>OR CONTINUE WITH</Text>
              <View style={themed.dividerLine} />
            </View>

            {/* Google Sign-Up */}
            <TouchableOpacity
              style={[themed.googleBtn, isGoogleLoading && styles.googleBtnDisabled]}
              activeOpacity={0.8}
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading || isAppleLoading || isLoading}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <GoogleIcon size={18} />
              )}
              <Text style={themed.googleBtnText}>CONTINUE WITH GOOGLE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[themed.googleBtn, isAppleLoading && styles.googleBtnDisabled]}
              activeOpacity={0.8}
              onPress={handleAppleSignIn}
              disabled={isGoogleLoading || isAppleLoading || isLoading}
            >
              {isAppleLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <AppleIcon size={18} color={Colors.white} />
              )}
              <Text style={themed.googleBtnText}>CONTINUE WITH APPLE</Text>
            </TouchableOpacity>

            {/* Login Link */}
            <View style={themed.loginRow}>
              <Text style={themed.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={themed.loginLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={themed.bottomSpacer} />
        </ScrollView>
      </KeyboardStickyView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    backgroundColor: Colors.whiteAlpha03,
  },
  headerSection: {
    marginBottom: 32,
  },
  stepIndicator: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.accent,
    letterSpacing: 2,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleText: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['4xl'],
    color: Colors.white,
    letterSpacing: -0.5,
  },
  titleRed: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['4xl'],
    color: Colors.accent,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  formContainer: {
    width: '100%',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleCard: {
    flex: 1,
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.whiteAlpha04,
  },
  roleCardActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentAlpha10,
  },
  roleCardLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.textSecondary,
  },
  roleCardLabelActive: { color: Colors.white },
  roleCardHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  roleNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.inline,
    paddingHorizontal: 16,
    height: 54,
  },
  inputFocused: {
    borderColor: Colors.accent,
  },
  inputError: {
    borderColor: Colors.error,
  },
  fieldError: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.error,
    marginTop: 6,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.white,
    height: '100%',
  },
  eyeBtn: {
    padding: 4,
  },
  // Password Strength
  strengthContainer: {
    marginBottom: 24,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderSubtle,
  },
  strengthText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.success,
    letterSpacing: 1.5,
  },
  // Checkbox
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSecondary,
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkboxLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size14,
    color: Colors.textSecondary,
  },
  boldText: {
    color: Colors.white,
    fontFamily: FontFamily.semiBold,
  },
  // CTA
  ctaWrapper: {
    marginBottom: 28,
  },
  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.whiteAlpha08,
  },
  dividerText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  // Google button
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    backgroundColor: Colors.bgSecondary,
    marginBottom: 24,
  },
  googleBtnDisabled: {
    opacity: 0.6,
  },
  googleBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
    letterSpacing: 1,
  },
  // Login link
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.accent,
  },
  bottomSpacer: {
    height: 60,
  },
});

function useSignupScreenPalette() {
  const { palette } = useNativeAppearance();
  return React.useMemo(() => ({
    ...styles,
    container: [styles.container, { backgroundColor: palette.bgBody }],
    backBtn: [styles.backBtn, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    headerSection: [styles.headerSection, { backgroundColor: palette.bgBody }],
    titleText: [styles.titleText, { color: palette.textPrimary }],
    subtitleText: [styles.subtitleText, { color: palette.textSecondary }],
    fieldLabel: [styles.fieldLabel, { color: palette.textSecondary }],
    roleCard: [styles.roleCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    roleCardLabel: [styles.roleCardLabel, { color: palette.textPrimary }],
    roleCardHint: [styles.roleCardHint, { color: palette.textMuted }],
    roleNote: [styles.roleNote, { color: palette.textSecondary }],
    inputWrapper: [styles.inputWrapper, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    input: [styles.input, { color: palette.textPrimary }],
    fieldError: [styles.fieldError, { color: palette.accent }],
    strengthText: [styles.strengthText, { color: palette.textMuted }],
    checkbox: [styles.checkbox, { borderColor: palette.borderDefault }],
    checkboxLabel: [styles.checkboxLabel, { color: palette.textSecondary }],
    dividerLine: [styles.dividerLine, { backgroundColor: palette.borderDefault }],
    dividerText: [styles.dividerText, { color: palette.textMuted }],
    googleBtn: [styles.googleBtn, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    googleBtnText: [styles.googleBtnText, { color: palette.textPrimary }],
    loginText: [styles.loginText, { color: palette.textSecondary }],
  }), [palette]);
}
