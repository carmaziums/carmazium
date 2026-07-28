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
import { Ionicons, GoogleIcon } from '@/components/BrandIcon';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { KeyboardStickyView } from '../../components/KeyboardStickyView';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

import { IconButton } from '../../components/IconButton';
type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const { signup, isLoading } = useAuthStore();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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
          redirectTo: 'carmazium://auth/callback',
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
      await signup(email.trim(), password, name);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred during account creation.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient with top glow */}
      <LinearGradient
        colors={[Colors.accentAlpha08, Colors.bgPrimary, Colors.bgPrimary]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardStickyView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button with circle border */}
          <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />

          {/* Header section */}
          <View style={styles.headerSection}>
            <Text style={styles.stepIndicator}>STEP 1 OF 3</Text>
            <Text style={styles.titleText}>
              Create your <Text style={styles.titleRed}>account.</Text>
            </Text>
            <Text style={styles.subtitleText}>
              Free forever. Pay only when you list above the free tier.
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {formError ? (
              <View style={{ marginBottom: 16 }}>
                <ErrorBanner message={formError} />
              </View>
            ) : null}
            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
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
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
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
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
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
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={emailRef}
                  style={styles.input}
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
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
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
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
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
                <IconButton style={styles.eyeBtn} icon={<Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textMuted} />} onPress={() => setShowPassword(!showPassword)} accessibilityLabel={showPassword ? 'Show password' : 'Hide password'} />
              </View>
            </View>

            {/* Password Strength Indicator */}
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBars}>
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
                <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                  {passwordStrength.label}
                </Text>
              ) : null}
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
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
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.input}
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
                <IconButton style={styles.eyeBtn} icon={<Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textMuted} />} onPress={() => setShowConfirmPassword(!showConfirmPassword)} accessibilityLabel={showConfirmPassword ? 'Show password' : 'Hide password'} />
              </View>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <Text style={styles.fieldError}>Passwords do not match</Text>
              )}
            </View>

            {/* Terms checkbox */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              activeOpacity={0.8}
              onPress={() => setAgreeTerms(!agreeTerms)}
            >
              <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                {agreeTerms && <Ionicons name="checkmark" size={12} color={Colors.white} />}
              </View>
              <Text style={styles.checkboxLabel}>
                I agree to the{' '}
                <Text style={styles.boldText} onPress={() => navigation.navigate('Terms')}>Terms</Text> and{' '}
                <Text style={styles.boldText}>Privacy Policy</Text>.
              </Text>
            </TouchableOpacity>

            {/* CTA Button */}
            <View style={styles.ctaWrapper}>
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
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-Up */}
            <TouchableOpacity
              style={[styles.googleBtn, isGoogleLoading && styles.googleBtnDisabled]}
              activeOpacity={0.8}
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <GoogleIcon size={18} />
              )}
              <Text style={styles.googleBtnText}>CONTINUE WITH GOOGLE</Text>
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 12,
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
    borderRadius: 12,
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
