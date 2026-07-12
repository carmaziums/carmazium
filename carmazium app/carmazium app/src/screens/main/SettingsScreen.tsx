import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import {FontFamily, FontSize } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';
import { convertAndCompress, uploadToStorage } from '../../lib/storageHelper';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';

import { IconButton } from '../../components/IconButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─────────────────────────── helpers ──────────────────────────────

const SectionHeader: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionIconWrap}>
      <Ionicons name={icon as any} size={14} color={Colors.accent} />
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
  const { user, updateUser } = useAuthStore();

  // ── Profile state ──────────────────────────────────────────────
  const [profileEmail] = useState(user?.email ?? '');
  const [profilePhone, setProfilePhone] = useState(user?.phone ?? '');
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [profileImage, setProfileImage] = useState(user?.profileImage ?? '');
  // Preferences default to on, matching web's seller settings page defaults
  // before the real values load — same fields, same PATCH /users/me shape.
  const [notifyOnSale, setNotifyOnSale] = useState(true);
  const [showPublicProfile, setShowPublicProfile] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── Load full profile (fields not carried on the lightweight auth-store User) ──
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient<{ success: boolean; data: any }>('/users/me');
        if (res?.success && res.data) {
          const p = res.data;
          setFirstName(p.firstName ?? '');
          setLastName(p.lastName ?? '');
          setProfileImage(p.profileImage ?? '');
          if (typeof p.notifyOnSale === 'boolean') setNotifyOnSale(p.notifyOnSale);
          if (typeof p.showPublicProfile === 'boolean') setShowPublicProfile(p.showPublicProfile);
        }
      } catch { /* keep store-derived defaults */ }
    })();
  }, []);

  const initials = (firstName ? firstName[0] : profileEmail ? profileEmail[0] : '?').toUpperCase();

  const handlePickProfilePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsMultipleSelection: false,
      quality: 1.0,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingPhoto(true);
    try {
      const jpegUri = await convertAndCompress(result.assets[0].uri);
      const userId = user?.id ?? 'anon';
      const url = await uploadToStorage(jpegUri, 'listings', `${userId}/profile/${Date.now()}.jpg`, 'image/jpeg');
      setProfileImage(url);
      // Auto-save immediately, same as web — a photo shouldn't need a
      // separate "Save" tap to stick.
      await apiClient('/users/me', { method: 'PATCH', body: JSON.stringify({ profileImage: url }) });
      updateUser({ profileImage: url });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

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

  // ── Save profile ──
  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Missing fields', 'First and last name are required.');
      return;
    }
    setProfileSaving(true);
    try {
      await apiClient('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: profilePhone,
          notifyOnSale,
          showPublicProfile,
        }),
      });
      updateUser({ firstName: firstName.trim(), lastName: lastName.trim(), phone: profilePhone });
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
        colors={[Colors.accentAlpha04, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
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
          <TouchableOpacity
            style={styles.avatarRow}
            activeOpacity={0.8}
            onPress={handlePickProfilePhoto}
            disabled={uploadingPhoto}
          >
            <View style={styles.avatarCircle}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>
            <View>
              <Text style={styles.avatarChangeText}>Change photo</Text>
              <Text style={styles.avatarHintText}>JPG or PNG, square works best</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.fieldRow}>
            <View style={styles.fieldWrap}>
              <FieldLabel label="FIRST NAME" />
              <TextInput
                style={styles.fieldInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={Colors.iconMuted}
              />
            </View>
            <View style={styles.fieldDividerV} />
            <View style={styles.fieldWrap}>
              <FieldLabel label="LAST NAME" />
              <TextInput
                style={styles.fieldInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={Colors.iconMuted}
              />
            </View>
          </View>

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
                placeholderTextColor={Colors.iconMuted}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Email me when a listing is sold</Text>
            </View>
            <Switch
              value={notifyOnSale}
              onValueChange={setNotifyOnSale}
              trackColor={{ false: Colors.whiteAlpha10, true: Colors.accent }}
              thumbColor={Colors.white}
              ios_backgroundColor={Colors.whiteAlpha10}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Show my profile publicly</Text>
            </View>
            <Switch
              value={showPublicProfile}
              onValueChange={setShowPublicProfile}
              trackColor={{ false: Colors.whiteAlpha10, true: Colors.accent }}
              thumbColor={Colors.white}
              ios_backgroundColor={Colors.whiteAlpha10}
            />
          </View>

          <View style={styles.cardDivider} />
          <TouchableOpacity
            style={[styles.saveBtn, profileSaving && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleSaveProfile}
            disabled={profileSaving}
          >
            {profileSaving
              ? <ActivityIndicator size="small" color={Colors.white} />
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
              placeholderTextColor={Colors.iconMuted}
              secureTextEntry={!showCurrentPwd}
              autoCapitalize="none"
            />
            <IconButton icon={<Ionicons name={showCurrentPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.iconMuted} />} onPress={() => setShowCurrentPwd(v => !v)} accessibilityLabel={showCurrentPwd ? 'Hide password' : 'Show password'} />
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
                  placeholderTextColor={Colors.iconMuted}
                  secureTextEntry={!showNewPwd}
                  autoCapitalize="none"
                />
                <IconButton icon={<Ionicons name={showNewPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.iconMuted} />} onPress={() => setShowNewPwd(v => !v)} accessibilityLabel={showNewPwd ? 'Hide password' : 'Show password'} />
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
                  placeholderTextColor={Colors.iconMuted}
                  secureTextEntry={!showConfirmPwd}
                  autoCapitalize="none"
                />
                <IconButton icon={<Ionicons name={showConfirmPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.iconMuted} />} onPress={() => setShowConfirmPwd(v => !v)} accessibilityLabel={showConfirmPwd ? 'Hide password' : 'Show password'} />
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
              ? <ActivityIndicator size="small" color={Colors.white} />
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
            <ActivityIndicator size="small" color={Colors.accent} style={{ marginVertical: 16 }} />
          ) : stripeOnboarded ? (
            <View style={styles.stripeConnected}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.stripeConnectedText}>Stripe account connected</Text>
            </View>
          ) : (
            <>
              {stripePartial && (
                <View style={styles.stripeWarning}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} />
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
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <>
                      <Ionicons name="arrow-redo-outline" size={16} color={Colors.white} />
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
            placeholderTextColor={Colors.iconMuted}
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
                placeholderTextColor={Colors.iconMuted}
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
                placeholderTextColor={Colors.iconMuted}
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
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.saveBtnText}>SAVE BANK DETAILS</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
};

// ══════════════════════════ STYLES ════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, marginBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.whiteAlpha04, borderWidth: 1, borderColor: Colors.whiteAlpha07,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, gap: 8 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 10 },
  sectionIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: Colors.accentAlpha10, alignItems: 'center', justifyContent: 'center',
  },
  sectionLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 1.2 },

  // Card
  card: {
    backgroundColor: Colors.bgSecondary, borderRadius: 16, borderWidth: 1, borderColor: Colors.whiteAlpha07,
    padding: 18, gap: 14,
  },
  cardDivider: { height: 1, backgroundColor: Colors.whiteAlpha07, marginHorizontal: -2 },

  // Field label
  fieldLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.iconMuted, letterSpacing: 1, marginBottom: 6 },

  // Profile info row
  fieldRow: { flexDirection: 'row', gap: 0 },
  fieldWrap: { flex: 1 },
  fieldDividerV: { width: 1, backgroundColor: Colors.whiteAlpha07, marginHorizontal: 14 },
  fieldValueReadonly: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, paddingVertical: 10 },
  fieldInput: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.white,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha07,
  },

  // Avatar / photo upload
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.whiteAlpha04, borderWidth: 1, borderColor: Colors.whiteAlpha10,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  avatarInitials: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textSecondary },
  avatarChangeText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.accent },
  avatarHintText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted, marginTop: 2 },

  // Preference toggles
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleTextWrap: { flex: 1, paddingRight: 12 },
  toggleTitle: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary },

  // Password
  pwdInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.whiteAlpha04, borderRadius: 10, borderWidth: 1, borderColor: Colors.whiteAlpha07,
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
  },
  pwdInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size14, color: Colors.white },
  pwdRow: { flexDirection: 'row' },

  // Buttons
  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: 10, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  updatePwdBtn: {
    backgroundColor: Colors.darkBlue_1d2030, borderRadius: 10, height: 44,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.accent,
  },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, letterSpacing: 0.5 },

  // Stripe
  payoutDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  stripeConnected: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  stripeConnectedText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.success },
  stripeWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.warningAlpha08, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.warningAlpha25, padding: 12,
  },
  stripeWarningText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.warning, lineHeight: 17 },
  stripeBtn: {
    backgroundColor: Colors.accent, borderRadius: 10, height: 44,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  stripeBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, letterSpacing: 0.5 },
  stripeNote: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted, textAlign: 'center', marginTop: -4 },

  // Bank details
  inputField: {
    backgroundColor: Colors.whiteAlpha04, borderRadius: 10, borderWidth: 1, borderColor: Colors.whiteAlpha07,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: FontFamily.regular, fontSize: FontSize.size14, color: Colors.white,
  },
  bankRow: { flexDirection: 'row' },
  bankSaveBtn: {
    backgroundColor: Colors.warning, borderRadius: 10, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
});
