import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Ionicons } from '@/components/BrandIcon';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [postcode, setPostcode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const postcodeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const { signup, isLoading } = useAuthStore();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const isFormValid = name && email && postcode && password.length >= 8 && agreeTerms;

  const handleGoogleSignIn = async () => {
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
      Alert.alert('Sign Up Failed', err.message || 'Unable to start Google sign-in.');
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
    try {
      await signup(email.trim(), password, name);
    } catch (err: any) {
      Alert.alert('Signup Failed', err.message || 'An error occurred during account creation.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient with top glow */}
      <LinearGradient
        colors={['rgba(220, 31, 38, 0.08)', Colors.bgPrimary, Colors.bgPrimary]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button with circle border */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

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
                  onSubmitEditing={() => postcodeRef.current?.focus()}
                />
              </View>
            </View>

            {/* Postcode */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>POSTCODE</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'postcode' && styles.inputFocused,
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={focusedField === 'postcode' ? Colors.accent : Colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={postcodeRef}
                  style={styles.input}
                  value={postcode}
                  onChangeText={setPostcode}
                  placeholder="W1K 7AF"
                  placeholderTextColor={Colors.inputPlaceholder}
                  autoCapitalize="characters"
                  returnKeyType="next"
                  onFocus={() => setFocusedField('postcode')}
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
                  returnKeyType="done"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={handleSignup}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
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

            {/* Terms checkbox */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              activeOpacity={0.8}
              onPress={() => setAgreeTerms(!agreeTerms)}
            >
              <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                {agreeTerms && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
              </View>
              <Text style={styles.checkboxLabel}>
                I agree to the <Text style={styles.boldText}>Terms</Text> and{' '}
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
                icon={<Ionicons name="arrow-forward" size={16} color="#FFFFFF" />}
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
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="logo-google" size={18} color="#FFFFFF" />
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
      </KeyboardAvoidingView>
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
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  headerSection: {
    marginBottom: 32,
  },
  stepIndicator: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
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
    fontSize: 32,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  titleRed: {
    fontFamily: FontFamily.extraBold,
    fontSize: 32,
    color: Colors.accent,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#A0A0AB',
  },
  formContainer: {
    width: '100%',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#A0A0AB',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111115',
    borderWidth: 1,
    borderColor: '#2A2A32',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
  },
  inputFocused: {
    borderColor: Colors.accent,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: '#FFFFFF',
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
    backgroundColor: '#2A2A32',
  },
  strengthText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
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
    borderColor: '#2A2A32',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111115',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkboxLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#A0A0AB',
  },
  boldText: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dividerText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#5C5C6B',
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#111115',
    marginBottom: 24,
  },
  googleBtnDisabled: {
    opacity: 0.6,
  },
  googleBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
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
    fontSize: 15,
    color: '#A0A0AB',
  },
  loginLink: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.accent,
  },
  bottomSpacer: {
    height: 60,
  },
});
