import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { GlobalToastContext } from '../../components/GlobalToastProvider';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { KeyboardStickyView } from '../../components/KeyboardStickyView';
import { Colors } from '../../constants/colors';

import { IconButton } from '../../components/IconButton';
export const DealerOnboardingScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { role, user, accountRole, initializeAuth, setRole } = useAuthStore();
  const { showToast } = useContext(GlobalToastContext);

  // Form states — start EMPTY. These previously shipped pre-filled with fake
  // demo business details ("Knightsbridge Motors Ltd", a fake Companies House
  // number, VAT number, address & phone), so a real dealer who didn't notice
  // and clear them could submit fabricated registration data as their own.
  // Hint text now lives in `placeholder` props instead.
  const [tradingName, setTradingName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ tradingName?: string; vatNumber?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Self-contained guard: DealerProfile/KYC verification persists per-user
  // forever (never reset when a dealer switches to buyer/seller view), so a
  // previously-verified user landing here — from any entry point, not just
  // the one drawer link that was fixed directly — should never see this
  // form again. Re-elevate silently if needed (no wizard, matching web's
  // dashboard/dealer/layout.tsx gate, which checks isVerified alone) and
  // jump straight past both onboarding and KYC.
  const [reactivating, setReactivating] = useState(!!user?.isVerified);
  useEffect(() => {
    if (!user?.isVerified) return;
    let cancelled = false;
    (async () => {
      try {
        if (accountRole !== 'dealer') {
          await apiClient('/users/elevate', {
            method: 'POST',
            body: JSON.stringify({ newRole: 'DEALER' }),
          });
          await initializeAuth();
        }
        if (cancelled) return;
        setRole('dealer');
        showToast('Welcome back — your dealer account is already verified', 'success');
        navigation?.goBack();
      } catch (err: any) {
        if (cancelled) return;
        setReactivating(false);
        setSubmitError(err?.message || 'Could not switch to dealer mode. Please try again.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Submits the business details to the backend and advances the user into
  // verification (DealerKYCScreen). Two real backend calls:
  //   1. POST /users/elevate    — grants the DEALER role (only needed once)
  //   2. PATCH /users/dealer-profile — creates/updates the DealerProfile record
  // Previously this just did `setStep('payments')` — nothing was ever persisted.
  const handleContinue = async () => {
    const trimmedName = tradingName.trim();
    const trimmedVat = vatNumber.trim();
    setSubmitError(null);

    const nextFieldErrors: { tradingName?: string; vatNumber?: string } = {};
    if (!trimmedName) nextFieldErrors.tradingName = 'Trading name is required';
    if (!trimmedVat) nextFieldErrors.vatNumber = 'VAT number is required';
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setSubmitting(true);
    try {
      // Step 1: elevate to DEALER if this account isn't one yet.
      if (role !== 'dealer') {
        await apiClient('/users/elevate', {
          method: 'POST',
          body: JSON.stringify({ newRole: 'DEALER' }),
        });
        // Refresh local auth state so `role` reflects the new DEALER status —
        // /users/dealer-profile requires the account to already be a dealer.
        await initializeAuth();
      }

      // Step 2: create/update the dealer profile with the submitted details.
      await apiClient('/users/dealer-profile', {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: trimmedName,
          vatNumber: trimmedVat,
          ...(regNumber.trim() && { registrationNumber: regNumber.trim() }),
          ...(address.trim() && { businessAddress: address.trim() }),
          ...(phone.trim() && { phone: phone.trim() }),
        }),
      });

      showToast('Dealership details saved — let’s verify your business', 'success');
      navigation?.navigate('DealerKYC');
    } catch (err: any) {
      setSubmitError(err?.message || 'Please check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (reactivating) {
    return (
      <View style={[styles.container, styles.reactivatingWrap]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.reactivatingText}>Your dealer account is already verified — switching you over…</Text>
      </View>
    );
  }

  return (
    <KeyboardStickyView style={styles.container} behavior="padding">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha03, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />
      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 14 }]}>

          {/* Header */}
          <View style={styles.header}>
            <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
            <View style={styles.headerCenter}>
              <Text style={styles.headerSubRed}>DEALER PRO</Text>
              <Text style={styles.headerTitle}>Set up your dealership</Text>
            </View>
            <View style={{ width: 38 }} />
          </View>

          {/* Stepper — Business (this screen) → Verify (DealerKYCScreen next) */}
          <View style={styles.stepperWrap}>
            <View style={styles.stepperItem}>
              <View style={[styles.stepperCircle, styles.stepperCircleActive]}>
                 <Text style={[styles.stepperNum, styles.stepperNumActive]}>1</Text>
              </View>
              <Text style={[styles.stepperLabel, styles.stepperLabelActive]}>Business</Text>
            </View>
            <View style={styles.stepperLine} />

            <View style={styles.stepperItem}>
              <View style={styles.stepperCircle}>
                 <Text style={styles.stepperNum}>2</Text>
              </View>
              <Text style={styles.stepperLabel}>Verify</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>BUSINESS DETAILS</Text>

          {submitError ? (
            <View style={{ marginBottom: 16 }}>
              <ErrorBanner message={submitError} />
            </View>
          ) : null}

          {/* Form Inputs */}
          <View style={styles.formGroup}>
             <Text style={styles.inputLabel}>TRADING NAME</Text>
             <View style={styles.inputWrap}>
                <Ionicons name="business-outline" size={18} color={Colors.iconMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={tradingName}
                  onChangeText={v => { setTradingName(v); if (fieldErrors.tradingName) setFieldErrors(prev => ({ ...prev, tradingName: undefined })); }}
                  placeholder="e.g. Knightsbridge Motors Ltd"
                  placeholderTextColor={Colors.iconMuted}
                />
                <Ionicons name="pencil-outline" size={16} color={Colors.iconMuted} style={styles.inputIconRight} />
             </View>
             {fieldErrors.tradingName ? <Text style={styles.fieldErrorText}>{fieldErrors.tradingName}</Text> : null}
          </View>

          <View style={styles.formGroup}>
             <Text style={styles.inputLabel}>COMPANIES HOUSE REG</Text>
             <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="pound" size={18} color={Colors.iconMuted} style={styles.inputIcon} />
                <TextInput style={styles.textInput} value={regNumber} onChangeText={setRegNumber} keyboardType="numeric" placeholder="e.g. 12345678" placeholderTextColor={Colors.iconMuted} />
                <Ionicons name="pencil-outline" size={16} color={Colors.iconMuted} style={styles.inputIconRight} />
             </View>
          </View>

          <View style={styles.formGroup}>
             <Text style={styles.inputLabel}>VAT NUMBER</Text>
             <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="file-document-outline" size={18} color={Colors.iconMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={vatNumber}
                  onChangeText={v => { setVatNumber(v); if (fieldErrors.vatNumber) setFieldErrors(prev => ({ ...prev, vatNumber: undefined })); }}
                  placeholder="e.g. GB 123 456 789"
                  placeholderTextColor={Colors.iconMuted}
                />
                <Ionicons name="pencil-outline" size={16} color={Colors.iconMuted} style={styles.inputIconRight} />
             </View>
             {fieldErrors.vatNumber ? <Text style={styles.fieldErrorText}>{fieldErrors.vatNumber}</Text> : null}
          </View>

          <View style={styles.formGroup}>
             <Text style={styles.inputLabel}>BUSINESS ADDRESS</Text>
             <View style={styles.inputWrap}>
                <Ionicons name="location-outline" size={18} color={Colors.iconMuted} style={styles.inputIcon} />
                <TextInput style={styles.textInput} value={address} onChangeText={setAddress} placeholder="e.g. 42 Sloane St, SW1X 9LT" placeholderTextColor={Colors.iconMuted} />
                <Ionicons name="pencil-outline" size={16} color={Colors.iconMuted} style={styles.inputIconRight} />
             </View>
          </View>

          <View style={styles.formGroup}>
             <Text style={styles.inputLabel}>BUSINESS PHONE</Text>
             <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={Colors.iconMuted} style={styles.inputIcon} />
                <TextInput style={styles.textInput} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="e.g. +44 20 7123 4567" placeholderTextColor={Colors.iconMuted} />
                <Ionicons name="pencil-outline" size={16} color={Colors.iconMuted} style={styles.inputIconRight} />
             </View>
          </View>

          <View style={styles.signInRow}>
             <Text style={styles.signInText}>Already have a dealer account? <Text style={styles.signInLink}>Sign in</Text></Text>
          </View>

        </ScrollView>

        {/* Continue CTA */}
        <View style={[styles.bottomCTA, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            label="CONTINUE"
            onPress={handleContinue}
            loading={submitting}
            size="lg"
            fullWidth
            icon={<Ionicons name="arrow-forward" size={18} color={Colors.white} />}
          />
        </View>
      </View>
    </KeyboardStickyView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  reactivatingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  reactivatingText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubRed: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.accent,
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.xl,
    color: Colors.white,
    letterSpacing: -0.5,
  },

  // Stepper
  stepperWrap: {
     flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 24, marginBottom: 32
  },
  stepperItem: {
     flexDirection: 'row', alignItems: 'center', gap: 8
  },
  stepperCircle: {
     width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.whiteAlpha05,
     borderWidth: 1, borderColor: Colors.whiteAlpha10, alignItems: 'center', justifyContent: 'center'
  },
  stepperCircleActive: {
     backgroundColor: Colors.accent, borderColor: Colors.accentGlow,
  },
  stepperNum: {
     fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.iconMuted
  },
  stepperNumActive: {
     color: Colors.white
  },
  stepperLabel: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.iconMuted
  },
  stepperLabelActive: {
     color: Colors.white
  },
  stepperLine: {
     flex: 1, height: 1, backgroundColor: Colors.whiteAlpha10, marginHorizontal: 12
  },

  sectionLabel: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.white, letterSpacing: 1.5,
     marginLeft: 24, marginBottom: 16
  },

  // Form
  formGroup: {
     marginHorizontal: 24, marginBottom: 16
  },
  inputLabel: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.iconMuted, letterSpacing: 1.2, marginBottom: 8
  },
  fieldErrorText: {
     fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.error, marginTop: 6,
  },
  inputWrap: {
     flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: Radius.inline,
     backgroundColor: Colors.whiteAlpha03, borderWidth: 1, borderColor: Colors.whiteAlpha06,
     paddingHorizontal: 16
  },
  inputIcon: {
     marginRight: 10
  },
  textInput: {
     flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.size14, color: Colors.white
  },
  inputIconRight: {
     marginLeft: 10
  },
  signInRow: {
     alignItems: 'center', marginTop: 24
  },
  signInText: {
     fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.iconMuted
  },
  signInLink: {
     fontFamily: FontFamily.bold, color: Colors.accent
  },

  bottomCTA: {
     position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16,
     backgroundColor: 'rgba(10,10,12,0.95)', borderTopWidth: 1, borderTopColor: Colors.whiteAlpha05
  },
});
