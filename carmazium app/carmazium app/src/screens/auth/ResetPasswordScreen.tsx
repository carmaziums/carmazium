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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Logo } from '../../components/Logo';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { KeyboardStickyView } from '../../components/KeyboardStickyView';
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { adaptLegacyLightStyles } from '../../theme/appearancePalette';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '../../components/IconButton';
export const ResetPasswordScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? adaptLegacyLightStyles(styles) : styles;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newFocused, setNewFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const confirmRef = useRef<TextInput>(null);
  const logout = useAuthStore((state) => state.logout);
  const insets = useSafeAreaInsets();

  const validate = (): string | null => {
    if (newPassword.length < 8) return 'Password must be at least 8 characters';
    if (newPassword !== confirmPassword) return 'Passwords don\'t match';
    return null;
  };

  const isFormValid =
    newPassword.length >= 8 && confirmPassword.length >= 8 && newPassword === confirmPassword;

  const handleSetPassword = async () => {
    const error = validate();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setSubmitError(null);
    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setSubmitError(updateError.message);
        return;
      }
      setSucceeded(true);
      await logout();
      setTimeout(() => {
        navigation?.navigate('Login');
      }, 1800);
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={ts.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={[Colors.accentAlpha08, Colors.bgPrimary, Colors.bgPrimary]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardStickyView behavior="padding" style={ts.flex}>
        <ScrollView
          contentContainerStyle={[
            ts.scrollContent,
            { paddingTop: insets.top + (Platform.OS === 'ios' ? 20 : 24) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Logo size="sm" style={ts.logoAlign} />

          <View style={ts.headerSection}>
            <Text style={ts.titleText}>
              New <Text style={ts.titleAccent}>password.</Text>
            </Text>
            <Text style={ts.subtitleText}>
              Enter your new password below. Make it strong.
            </Text>
          </View>

          <View style={ts.formContainer}>
            {succeeded ? (
              <View style={ts.successContainer}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.success} style={ts.successIcon} />
                <Text style={ts.successTitle}>Password updated!</Text>
                <Text style={ts.successBody}>
                  Taking you back to sign in...
                </Text>
                <TouchableOpacity
                  style={ts.signInBtn}
                  onPress={() => navigation?.navigate('Login')}
                  activeOpacity={0.7}
                >
                  <Text style={ts.signInBtnText}>Sign in</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* New Password */}
                <View style={ts.fieldGroup}>
                  <Text style={ts.fieldLabel}>NEW PASSWORD</Text>
                  <View style={[ts.inputWrapper, newFocused && ts.inputFocused]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={newFocused ? Colors.accent : Colors.textMuted}
                      style={ts.inputIcon}
                    />
                    <TextInput
                      style={ts.input}
                      value={newPassword}
                      onChangeText={(text) => {
                        setNewPassword(text);
                        setValidationError(null);
                      }}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.inputPlaceholder}
                      secureTextEntry={!showNew}
                      returnKeyType="next"
                      onFocus={() => setNewFocused(true)}
                      onBlur={() => setNewFocused(false)}
                      onSubmitEditing={() => confirmRef.current?.focus()}
                    />
                    <IconButton style={ts.eyeBtn} icon={<Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />} onPress={() => setShowNew(!showNew)} accessibilityLabel={showNew ? 'Hide password' : 'Show password'} />
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={ts.fieldGroup}>
                  <Text style={ts.fieldLabel}>CONFIRM PASSWORD</Text>
                  <View style={[ts.inputWrapper, confirmFocused && ts.inputFocused]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={confirmFocused ? Colors.accent : Colors.textMuted}
                      style={ts.inputIcon}
                    />
                    <TextInput
                      ref={confirmRef}
                      style={ts.input}
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        setValidationError(null);
                      }}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.inputPlaceholder}
                      secureTextEntry={!showConfirm}
                      returnKeyType="done"
                      onFocus={() => setConfirmFocused(true)}
                      onBlur={() => setConfirmFocused(false)}
                      onSubmitEditing={isFormValid ? handleSetPassword : undefined}
                    />
                    <IconButton style={ts.eyeBtn} icon={<Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />} onPress={() => setShowConfirm(!showConfirm)} accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'} />
                  </View>
                </View>

                {validationError ? (
                  <Text style={ts.validationError}>{validationError}</Text>
                ) : null}

                <View style={ts.ctaWrapper}>
                  <PrimaryCTA
                    label="SET NEW PASSWORD"
                    onPress={handleSetPassword}
                    isLoading={isLoading}
                    disabled={!isFormValid}
                    hasChamfer={true}
                  />
                </View>

                {submitError ? (
                  <Text style={ts.submitError}>{submitError}</Text>
                ) : null}
              </>
            )}

            <View style={ts.backRow}>
              <TouchableOpacity onPress={() => navigation?.navigate('Login')} activeOpacity={0.7}>
                <Text style={ts.backLink}>Back to sign in</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={ts.bottomSpacer} />
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
  },
  logoAlign: {
    alignSelf: 'flex-start',
    marginBottom: 36,
  },
  headerSection: {
    marginBottom: 32,
  },
  titleText: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['4xl'],
    color: Colors.white,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  titleAccent: {
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
    borderRadius: Radius.inline,
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
    fontSize: FontSize.base,
    color: Colors.white,
    height: '100%',
  },
  eyeBtn: {
    padding: 4,
  },
  validationError: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.error,
    marginBottom: 16,
    marginTop: -8,
  },
  ctaWrapper: {
    marginTop: 8,
    marginBottom: 12,
  },
  submitError: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['2xl'],
    color: Colors.white,
    marginBottom: 10,
    textAlign: 'center',
  },
  successBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  signInBtn: {
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  signInBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  backRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  backLink: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.accent,
  },
  bottomSpacer: {
    height: 60,
  },
});
