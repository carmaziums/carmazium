import React, { useState } from 'react';
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { supabase } from '../../lib/supabase';
import { Logo } from '../../components/Logo';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { KeyboardStickyView } from '../../components/KeyboardStickyView';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';

import { IconButton } from '../../components/IconButton';
type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSendResetLink = async () => {
    if (!email.trim()) return;
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'carmazium://reset-password',
      });
      if (error) {
        setErrorMessage(error.message);
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

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
          {/* Back button */}
          <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />

          {/* Logo */}
          <Logo size="sm" style={styles.logoAlign} />

          {/* Heading */}
          <View style={styles.headerSection}>
            <Text style={styles.titleText}>
              Reset your <Text style={styles.titleAccent}>password.</Text>
            </Text>
            <Text style={styles.subtitleText}>
              Enter your email and we'll send you a reset link.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {sent ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconWrapper}>
                  <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
                </View>
                <Text style={styles.successTitle}>Check your inbox</Text>
                <Text style={styles.successBody}>
                  We've sent a password reset link to{' '}
                  <Text style={styles.successEmail}>{email.trim()}</Text>.
                  Check your spam folder if it doesn't arrive within a minute.
                </Text>
              </View>
            ) : (
              <>
                {/* Email Field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>EMAIL</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      emailFocused && styles.inputFocused,
                      errorMessage ? styles.inputError : null,
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={emailFocused ? Colors.accent : Colors.textMuted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="your@email.com"
                      placeholderTextColor={Colors.inputPlaceholder}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      returnKeyType="send"
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      onSubmitEditing={handleSendResetLink}
                    />
                  </View>
                  {errorMessage ? (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  ) : null}
                </View>

                {/* CTA */}
                <View style={styles.ctaWrapper}>
                  <PrimaryCTA
                    label="SEND RESET LINK"
                    onPress={handleSendResetLink}
                    isLoading={isLoading}
                    disabled={!email.trim()}
                    hasChamfer={true}
                  />
                </View>
              </>
            )}

            {/* Back to sign in */}
            <View style={styles.backToSignInRow}>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                <Text style={styles.backToSignInText}>Back to sign in</Text>
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
    marginBottom: 24,
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
  inputError: {
    borderColor: Colors.error,
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
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.error,
    marginTop: 8,
  },
  ctaWrapper: {
    marginBottom: 28,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  successIconWrapper: {
    marginBottom: 16,
  },
  successTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.size22,
    color: Colors.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  successBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  successEmail: {
    fontFamily: FontFamily.semiBold,
    color: Colors.white,
  },
  backToSignInRow: {
    alignItems: 'center',
  },
  backToSignInText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.accent,
  },
  bottomSpacer: {
    height: 60,
  },
});
