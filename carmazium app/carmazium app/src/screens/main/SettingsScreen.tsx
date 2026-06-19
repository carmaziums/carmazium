import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { FontFamily } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─────────────────────────── helpers ──────────────────────────────

const C = {
  bg: '#0A0A0C',
  card: '#111115',
  border: 'rgba(255,255,255,0.07)',
  accent: '#DC1F26',
  success: '#22C55E',
  warning: '#F59E0B',
  white: '#FFFFFF',
  muted: '#606070',
  secondary: '#A0A0AB',
};

const SectionHeader: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionIconWrap}>
      <Ionicons name={icon as any} size={14} color={C.accent} />
    </View>
    <Text style={styles.sectionLabel}>{label}</Text>
  </View>
);

const FieldLabel: React.FC<{ label: string }> = ({ label }) => (
  <Text style={styles.fieldLabel}>{label}</Text>
);

// ══════════════════════════ COMPONENT ════════════════════════════

export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user, refreshUser } = useAuthStore();

  // ── Profile state ──────────────────────────────────────────────
  const [profileEmail] = useState(user?.email ?? '');
  const [profilePhone, setProfilePhone] = useState(user?.phone ?? '');
  const [profileSaving, setProfileSaving] = useState(false);

  // ── Password state ─────────────────────────────────────────────
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // ── Stripe Connect state ───────────────────────────────────────
  const [stripeStatus, setStripeStatus] = useState<{
    accountId?: string;
    detailsSubmitted?: boolean;
    chargesEnabled?: boolean;
  } | null>(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [stripeConnecting, setStripeConnecting] = useState(false);

  // ── Bank details state ─────────────────────────────────────────
  const [bankName, setBankName] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankSaving, setBankSaving] = useState(false);

  // ── Load Stripe status ──
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient<{ success: boolean; data: any }>('/users/stripe-connect/status');
        if (res?.success) setStripeStatus(res.data);
      } catch { /* offline — show connect button */ }
      finally { setStripeLoading(false); }
    })();
  }, []);

  // ── Save phone number ──
  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      await apiClient('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ phone: profilePhone }),
      });
      await (refreshUser as any)?.();
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Update password ──
  const handleUpdatePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      Alert.alert('Missing fields', 'Please fill in all password fields.');
      return;
    }
    if (newPwd !== confirmPwd) {
      Alert.alert('Passwords do not match', 'New password and confirmation must match.');
      return;
    }
    if (newPwd.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }
    setPwdSaving(true);
    try {
      await apiClient('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      Alert.alert('Password updated', 'Your password has been changed successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update password.');
    } finally {
      setPwdSaving(false);
    }
  };

  // ── Stripe Connect onboard ──
  const handleConnectStripe = async () => {
    setStripeConnecting(true);
    try {
      const res = await apiClient<{ success: boolean; data: { url: string } }>(
        '/users/stripe-connect/onboard',
        {
          method: 'POST',
          body: JSON.stringify({
            returnUrl: 'carmazium://settings',
            refreshUrl: 'carmazium://settings',
          }),
        }
      );
      if (res?.success && res.data?.url) {
        const { Linking } = require('react-native');
        await Linking.openURL(res.data.url);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not start Stripe onboarding.');
    } finally {
      setStripeConnecting(false);
    }
  };

  // ── Save bank details ──
  const handleSaveBank = async () => {
    if (!bankName || !sortCode || !accountNumber) {
      Alert.alert('Missing fields', 'Please fill in all bank detail fields.');
      return;
    }
    setBankSaving(true);
    try {
      await apiClient('/users/me/bank-details', {
        method: 'PATCH',
        body: JSON.stringify({
          bankAccountName: bankName,
          bankSortCode: sortCode,
          bankAccountNumber: accountNumber,
          payoutPreference: 'BANK',
        }),
      });
      Alert.alert('Saved', 'Bank details saved successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save bank details.');
    } finally {
      setBankSaving(false);
    }
  };

  const stripeOnboarded = stripeStatus?.detailsSubmitted === true;
  const stripePartial = stripeStatus?.accountId && !stripeStatus.detailsSubmitted;

  // ────────────────────────── render ────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.04)', 'rgba(10,10,12,0)', '#0A0A0C']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── 1. PROFILE INFORMATION ── */}
        <SectionHeader icon="person-circle-outline" label="PROFILE INFORMATION" />
        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldWrap}>
              <FieldLabel label="EMAIL ADDRESS" />
              <Text style={styles.fieldValueReadonly}>{profileEmail || '—'}</Text>
            </View>
            <View style={styles.fieldDividerV} />
            <View style={styles.fieldWrap}>
              <FieldLabel label="PHONE NUMBER" />
              <TextInput
                style={styles.fieldInput}
                value={profilePhone}
                onChangeText={setProfilePhone}
                placeholder="Not set"
                placeholderTextColor={C.muted}
                keyboardType="phone-pad"
              />
            </View>
          </View>
          <View style={styles.cardDivider} />
          <TouchableOpacity
            style={[styles.saveBtn, profileSaving && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleSaveProfile}
            disabled={profileSaving}
          >
            {profileSaving
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.saveBtnText}>SAVE PROFILE</Text>}
          </TouchableOpacity>
        </View>

        {/* ── 2. SECURITY & PASSWORD ── */}
        <SectionHeader icon="lock-closed-outline" label="SECURITY & PASSWORD" />
        <View style={styles.card}>
          <FieldLabel label="CURRENT PASSWORD" />
          <View style={styles.pwdInputWrap}>
            <TextInput
              style={styles.pwdInput}
              value={currentPwd}
              onChangeText={setCurrentPwd}
              placeholder="••••••••"
              placeholderTextColor={C.muted}
              secureTextEntry={!showCurrentPwd}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowCurrentPwd(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={showCurrentPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.pwdRow}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="NEW PASSWORD" />
              <View style={styles.pwdInputWrap}>
                <TextInput
                  style={styles.pwdInput}
                  value={newPwd}
                  onChangeText={setNewPwd}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={C.muted}
                  secureTextEntry={!showNewPwd}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNewPwd(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showNewPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <FieldLabel label="CONFIRM NEW PASSWORD" />
              <View style={styles.pwdInputWrap}>
                <TextInput
                  style={styles.pwdInput}
                  value={confirmPwd}
                  onChangeText={setConfirmPwd}
                  placeholder="••••••••"
                  placeholderTextColor={C.muted}
                  secureTextEntry={!showConfirmPwd}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmPwd(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showConfirmPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.cardDivider} />
          <TouchableOpacity
            style={[styles.updatePwdBtn, pwdSaving && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleUpdatePassword}
            disabled={pwdSaving}
          >
            {pwdSaving
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.saveBtnText}>UPDATE PASSWORD</Text>}
          </TouchableOpacity>
        </View>

        {/* ── 3. PAYOUTS ── */}
        <SectionHeader icon="card-outline" label="PAYOUTS" />
        <View style={styles.card}>
          <Text style={styles.payoutDesc}>
            Connect a bank account to receive your £100 seller bonus after a successful auction handover is verified.
          </Text>

          {stripeLoading ? (
            <ActivityIndicator size="small" color={C.accent} style={{ marginVertical: 16 }} />
          ) : stripeOnboarded ? (
            <View style={styles.stripeConnected}>
              <Ionicons name="checkmark-circle" size={18} color={C.success} />
              <Text style={styles.stripeConnectedText}>Stripe account connected</Text>
            </View>
          ) : (
            <>
              {stripePartial && (
                <View style={styles.stripeWarning}>
                  <Ionicons name="alert-circle-outline" size={14} color={C.warning} />
                  <Text style={styles.stripeWarningText}>
                    Your Stripe account was created but onboarding is incomplete. Click below to finish.
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.stripeBtn, stripeConnecting && { opacity: 0.6 }]}
                activeOpacity={0.8}
                onPress={handleConnectStripe}
                disabled={stripeConnecting}
              >
                {stripeConnecting
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <>
                      <Ionicons name="arrow-redo-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.stripeBtnText}>CONNECT BANK ACCOUNT</Text>
                    </>}
              </TouchableOpacity>
              <Text style={styles.stripeNote}>
                You will be taken to Stripe's secure onboarding — this takes about 2 minutes.
              </Text>
            </>
          )}
        </View>

        {/* ── 4. BANK ACCOUNT DETAILS ── */}
        <SectionHeader icon="business-outline" label="BANK ACCOUNT DETAILS" />
        <View style={styles.card}>
          <Text style={styles.payoutDesc}>
            Provide your UK bank details as a fallback. CarMazium can manually transfer your £100 bonus if Stripe Connect isn't available.
          </Text>

          <FieldLabel label="ACCOUNT HOLDER NAME" />
          <TextInput
            style={styles.inputField}
            value={bankName}
            onChangeText={setBankName}
            placeholder="e.g. John Smith"
            placeholderTextColor={C.muted}
            autoCapitalize="words"
          />

          <View style={styles.bankRow}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="SORT CODE" />
              <TextInput
                style={styles.inputField}
                value={sortCode}
                onChangeText={setSortCode}
                placeholder="e.g. 00-00-00"
                placeholderTextColor={C.muted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <FieldLabel label="ACCOUNT NUMBER" />
              <TextInput
                style={styles.inputField}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="e.g. 12345678"
                placeholderTextColor={C.muted}
                keyboardType="numeric"
                maxLength={8}
              />
            </View>
          </View>

          <View style={styles.cardDivider} />
          <TouchableOpacity
            style={[styles.bankSaveBtn, bankSaving && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleSaveBank}
            disabled={bankSaving}
          >
            {bankSaving
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.saveBtnText}>SAVE BANK DETAILS</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
};

// ══════════════════════════ STYLES ════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, marginBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: FontFamily.bold, fontSize: 18, color: C.white },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, gap: 8 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 10 },
  sectionIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(220,31,38,0.10)', alignItems: 'center', justifyContent: 'center',
  },
  sectionLabel: { fontFamily: FontFamily.bold, fontSize: 11, color: C.white, letterSpacing: 1.2 },

  // Card
  card: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 18, gap: 14,
  },
  cardDivider: { height: 1, backgroundColor: C.border, marginHorizontal: -2 },

  // Field label
  fieldLabel: { fontFamily: FontFamily.bold, fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 6 },

  // Profile info row
  fieldRow: { flexDirection: 'row', gap: 0 },
  fieldWrap: { flex: 1 },
  fieldDividerV: { width: 1, backgroundColor: C.border, marginHorizontal: 14 },
  fieldValueReadonly: { fontFamily: FontFamily.regular, fontSize: 13, color: C.secondary, paddingVertical: 10 },
  fieldInput: {
    fontFamily: FontFamily.regular, fontSize: 13, color: C.white,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },

  // Password
  pwdInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
  },
  pwdInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: 14, color: C.white },
  pwdRow: { flexDirection: 'row' },

  // Buttons
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 10, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  updatePwdBtn: {
    backgroundColor: '#1D2030', borderRadius: 10, height: 44,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.accent,
  },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: 13, color: C.white, letterSpacing: 0.5 },

  // Stripe
  payoutDesc: { fontFamily: FontFamily.regular, fontSize: 13, color: C.secondary, lineHeight: 18 },
  stripeConnected: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  stripeConnectedText: { fontFamily: FontFamily.bold, fontSize: 13, color: C.success },
  stripeWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)', padding: 12,
  },
  stripeWarningText: { flex: 1, fontFamily: FontFamily.regular, fontSize: 12, color: C.warning, lineHeight: 17 },
  stripeBtn: {
    backgroundColor: C.accent, borderRadius: 10, height: 44,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  stripeBtnText: { fontFamily: FontFamily.bold, fontSize: 13, color: C.white, letterSpacing: 0.5 },
  stripeNote: { fontFamily: FontFamily.regular, fontSize: 11, color: C.muted, textAlign: 'center', marginTop: -4 },

  // Bank details
  inputField: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: FontFamily.regular, fontSize: 14, color: C.white,
  },
  bankRow: { flexDirection: 'row' },
  bankSaveBtn: {
    backgroundColor: C.warning, borderRadius: 10, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
});
