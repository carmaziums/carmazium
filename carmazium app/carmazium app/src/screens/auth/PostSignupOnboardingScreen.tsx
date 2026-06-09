import React, { useState, useRef, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { Logo } from '../../components/Logo';

type Step = 1 | 2 | 3;

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;

const BODY_TYPES = ['SUV', 'Saloon', 'Hatchback', 'Coupé', 'Estate', 'Convertible'] as const;
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'Plug-in'] as const;

const BUDGET_OPTIONS: { label: string; value: number }[] = [
  { label: 'Under £10k', value: 10000 },
  { label: '£10–25k', value: 25000 },
  { label: '£25–50k', value: 50000 },
  { label: '£50–100k', value: 100000 },
  { label: '£100k+', value: 999999 },
];

// ─── Step Dots ───────────────────────────────────────────────────────────────

const StepDots: React.FC<{ step: Step }> = ({ step }) => (
  <View style={dotStyles.row}>
    {([1, 2, 3] as Step[]).map((n) => (
      <View
        key={n}
        style={[
          dotStyles.dot,
          step === n ? dotStyles.dotActive : dotStyles.dotInactive,
        ]}
      />
    ))}
  </View>
);

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    borderRadius: 99,
  },
  dotActive: {
    width: 20,
    height: 8,
    backgroundColor: Colors.accent,
  },
  dotInactive: {
    width: 8,
    height: 8,
    backgroundColor: Colors.textDisabled,
  },
});

// ─── Chip ────────────────────────────────────────────────────────────────────

const Chip: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
}> = ({ label, selected, onPress }) => (
  <TouchableOpacity
    style={[chipStyles.chip, selected && chipStyles.chipSelected]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Text style={[chipStyles.label, selected && chipStyles.labelSelected]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassBg,
    marginRight: 8,
    marginBottom: 10,
  },
  chipSelected: {
    backgroundColor: Colors.accentSubtle,
    borderColor: Colors.accent,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  labelSelected: {
    color: Colors.accent,
    fontFamily: FontFamily.semiBold,
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export const PostSignupOnboardingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);

  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendLabel, setResendLabel] = useState('Resend email');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyWarning, setVerifyWarning] = useState('');
  const [showSkip, setShowSkip] = useState(false);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 state
  const [postcode, setPostcode] = useState('');
  const [postcodeError, setPostcodeError] = useState('');
  const [postcodeFocused, setPostcodeFocused] = useState(false);

  // Step 3 state
  const [selectedBodyTypes, setSelectedBodyTypes] = useState<string[]>([]);
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState('');

  // ── Step 1 handlers ──────────────────────────────────────────────────────

  const handleResend = useCallback(async () => {
    if (!user?.email || resendDisabled) return;
    setResendDisabled(true);
    setResendLabel('Sent!');
    try {
      await supabase.auth.resend({ type: 'signup', email: user.email });
    } catch {
      // silently ignore — user can try again after cooldown
    }
    let remaining = 30;
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        setResendDisabled(false);
        setResendLabel('Resend email');
      } else {
        setResendLabel(`Resend in ${remaining}s`);
      }
    }, 1000);
  }, [user?.email, resendDisabled]);

  const handleVerifyCheck = useCallback(async () => {
    setVerifyLoading(true);
    setVerifyWarning('');
    setShowSkip(false);
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);

    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.user?.email_confirmed_at) {
        setStep(2);
        return;
      }
    } catch {
      // fall through to warning
    } finally {
      setVerifyLoading(false);
    }

    setVerifyWarning("We couldn't confirm your email yet. Try again or continue anyway.");
    skipTimerRef.current = setTimeout(() => {
      setShowSkip(true);
    }, 3000);
  }, []);

  // ── Step 2 handlers ──────────────────────────────────────────────────────

  const normalisePostcode = (raw: string) => raw.trim().toUpperCase();

  const validatePostcode = (raw: string) => {
    const normalised = normalisePostcode(raw);
    return UK_POSTCODE_REGEX.test(normalised);
  };

  const handlePostcodeChange = (text: string) => {
    setPostcode(text);
    if (postcodeError && validatePostcode(text)) {
      setPostcodeError('');
    }
  };

  const handlePostcodeBlur = () => {
    setPostcodeFocused(false);
    if (postcode.trim() && !validatePostcode(postcode)) {
      setPostcodeError('Please enter a valid UK postcode');
    } else {
      setPostcodeError('');
    }
  };

  const isPostcodeValid = postcode.trim() !== '' && validatePostcode(postcode);

  const handlePostcodeContinue = () => {
    if (!isPostcodeValid) {
      setPostcodeError('Please enter a valid UK postcode');
      return;
    }
    setStep(3);
  };

  const handlePostcodeSkip = () => {
    setPostcode('');
    setPostcodeError('');
    setStep(3);
  };

  // ── Step 3 handlers ──────────────────────────────────────────────────────

  const toggleBodyType = (type: string) => {
    setSelectedBodyTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleFuelType = (type: string) => {
    setSelectedFuelTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleFinish = useCallback(async () => {
    setSaving(true);
    setSaveToast('');

    const normPostcode = postcode.trim() ? normalisePostcode(postcode) : undefined;
    const preferences = {
      bodyTypes: selectedBodyTypes,
      fuelTypes: selectedFuelTypes,
      ...(selectedBudget !== null ? { maxBudget: selectedBudget } : {}),
    };

    try {
      await apiClient('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          ...(normPostcode ? { location: normPostcode } : {}),
          preferences,
        }),
      });
    } catch {
      setSaveToast('Saved locally');
      setTimeout(() => setSaveToast(''), 3000);
    } finally {
      setSaving(false);
    }

    await completeOnboarding();
    // RootNavigator gate automatically switches to Main
  }, [postcode, selectedBodyTypes, selectedFuelTypes, selectedBudget, completeOnboarding]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Logo size="sm" style={styles.logo} />

          {/* Progress dots */}
          <StepDots step={step} />

          {/* ── Step 1: Email Verification ─────────────────────────────── */}
          {step === 1 && (
            <View>
              <Text style={styles.stepIndicator}>STEP 1 OF 3</Text>
              <Text style={styles.titleText}>
                Verify your <Text style={styles.titleAccent}>email.</Text>
              </Text>
              <Text style={styles.subtitleText}>
                We sent a confirmation email to {user?.email ?? 'your address'}. Check your
                inbox and click the link.
              </Text>

              {/* Email display card */}
              <View style={styles.emailCard}>
                <View style={styles.emailCardIcon}>
                  <Ionicons name="mail" size={22} color={Colors.accent} />
                </View>
                <Text style={styles.emailCardText} numberOfLines={1}>
                  {user?.email ?? '—'}
                </Text>
              </View>

              {/* Resend button */}
              <TouchableOpacity
                style={[styles.ghostBtn, resendDisabled && styles.ghostBtnDisabled]}
                onPress={handleResend}
                disabled={resendDisabled}
                activeOpacity={0.75}
              >
                <Text style={styles.ghostBtnText}>{resendLabel}</Text>
              </TouchableOpacity>

              {/* Inline warning */}
              {verifyWarning !== '' && (
                <View style={styles.warningRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} />
                  <Text style={styles.warningText}>{verifyWarning}</Text>
                </View>
              )}

              {/* Skip for now */}
              {showSkip && (
                <TouchableOpacity
                  style={styles.skipLink}
                  onPress={() => setStep(2)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.skipLinkText}>Skip for now</Text>
                </TouchableOpacity>
              )}

              {/* Primary CTA */}
              <View style={styles.ctaWrapper}>
                <PrimaryCTA
                  label="I'VE VERIFIED MY EMAIL"
                  onPress={handleVerifyCheck}
                  isLoading={verifyLoading}
                  hasChamfer={true}
                  icon={<Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                  iconPosition="right"
                />
              </View>
            </View>
          )}

          {/* ── Step 2: Location ───────────────────────────────────────── */}
          {step === 2 && (
            <View>
              <Text style={styles.stepIndicator}>STEP 2 OF 3</Text>
              <Text style={styles.titleText}>
                Where are <Text style={styles.titleAccent}>you based?</Text>
              </Text>
              <Text style={styles.subtitleText}>
                We'll show you vehicles near you first.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>UK POSTCODE</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    postcodeFocused && styles.inputFocused,
                    postcodeError !== '' && styles.inputError,
                  ]}
                >
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color={
                      postcodeError !== ''
                        ? Colors.error
                        : postcodeFocused
                        ? Colors.accent
                        : Colors.textMuted
                    }
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={postcode}
                    onChangeText={handlePostcodeChange}
                    placeholder="e.g. SW1X 7LY"
                    placeholderTextColor={Colors.inputPlaceholder}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    onFocus={() => setPostcodeFocused(true)}
                    onBlur={handlePostcodeBlur}
                  />
                </View>
                {postcodeError !== '' && (
                  <Text style={styles.errorText}>{postcodeError}</Text>
                )}
              </View>

              <View style={styles.ctaWrapper}>
                <PrimaryCTA
                  label="CONTINUE"
                  onPress={handlePostcodeContinue}
                  disabled={postcode.trim() === '' || postcodeError !== ''}
                  hasChamfer={true}
                  icon={<Ionicons name="arrow-forward" size={16} color="#FFFFFF" />}
                  iconPosition="right"
                />
              </View>

              <TouchableOpacity
                style={styles.skipLink}
                onPress={handlePostcodeSkip}
                activeOpacity={0.7}
              >
                <Text style={styles.skipLinkText}>Skip</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 3: Preferences ────────────────────────────────────── */}
          {step === 3 && (
            <View>
              <Text style={styles.stepIndicator}>STEP 3 OF 3</Text>
              <Text style={styles.titleText}>
                What are you <Text style={styles.titleAccent}>looking for?</Text>
              </Text>
              <Text style={styles.subtitleText}>
                Select all that apply. You can change these any time.
              </Text>

              {/* Body Types */}
              <Text style={styles.sectionLabel}>BODY TYPES</Text>
              <View style={styles.chipRow}>
                {BODY_TYPES.map((type) => (
                  <Chip
                    key={type}
                    label={type}
                    selected={selectedBodyTypes.includes(type)}
                    onPress={() => toggleBodyType(type)}
                  />
                ))}
              </View>

              {/* Fuel Type */}
              <Text style={styles.sectionLabel}>FUEL TYPE</Text>
              <View style={styles.chipRow}>
                {FUEL_TYPES.map((type) => (
                  <Chip
                    key={type}
                    label={type}
                    selected={selectedFuelTypes.includes(type)}
                    onPress={() => toggleFuelType(type)}
                  />
                ))}
              </View>

              {/* Budget */}
              <Text style={styles.sectionLabel}>BUDGET</Text>
              <View style={styles.chipRow}>
                {BUDGET_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    selected={selectedBudget === opt.value}
                    onPress={() =>
                      setSelectedBudget(selectedBudget === opt.value ? null : opt.value)
                    }
                  />
                ))}
              </View>

              {/* Toast */}
              {saveToast !== '' && (
                <View style={styles.toastRow}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                  <Text style={styles.toastText}>{saveToast}</Text>
                </View>
              )}

              <View style={styles.ctaWrapper}>
                <PrimaryCTA
                  label="FINISH & GO"
                  onPress={handleFinish}
                  isLoading={saving}
                  hasChamfer={true}
                  icon={
                    saving ? undefined : (
                      <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                    )
                  }
                  iconPosition="right"
                />
              </View>
            </View>
          )}

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
    paddingBottom: 40,
  },
  logo: {
    marginBottom: 40,
  },
  // Step indicator
  stepIndicator: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 2,
    marginBottom: 12,
  },
  // Title
  titleText: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['4xl'],
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 12,
    lineHeight: FontSize['4xl'] * 1.15,
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
    lineHeight: FontSize.base * 1.6,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  // Email card
  emailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 20,
  },
  emailCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailCardText: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  // Ghost button
  ghostBtn: {
    borderWidth: 1,
    borderColor: Colors.glassBorderStrong,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.glassBg,
    marginBottom: 20,
  },
  ghostBtnDisabled: {
    opacity: 0.45,
  },
  ghostBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  // Warning
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  warningText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.warning,
    lineHeight: FontSize.sm * 1.6,
  },
  // Skip link
  skipLink: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  skipLinkText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  // CTA wrapper
  ctaWrapper: {
    marginBottom: 16,
    marginTop: 8,
  },
  // Form field (Step 2)
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: '#2A2A32',
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
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    height: '100%',
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.error,
    marginTop: 6,
    letterSpacing: 0.3,
  },
  // Section labels (Step 3)
  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  // Toast
  toastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    borderRadius: 10,
  },
  toastText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.success,
  },
  bottomSpacer: {
    height: 60,
  },
});
