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
import { Radius } from '../../constants/spacing';
import { apiClient } from '../../lib/apiClient';
import { convertAndCompress, uploadToStorage } from '../../lib/storageHelper';
import { startAddressVerification, confirmAddressVerification } from '../../lib/addressVerificationApi';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
import { BottomSheet } from '../../components/BottomSheet';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
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
  const { user, role, updateUser, initializeAuth, logout } = useAuthStore();

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
          if (p.dealerProfile) {
            const dp = p.dealerProfile;
            setDealerCompanyName(dp.companyName ?? '');
            setDealerVatNumber(dp.vatNumber ?? '');
            setDealerRegNumber(dp.registrationNumber ?? '');
            setDealerAddress(dp.businessAddress ?? '');
            setDealerPhone(dp.phone ?? '');
            setDealerWebsite(dp.website ?? '');
            setDealerDescription(dp.description ?? '');
            setDealerLogo(dp.logo ?? '');
          }
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

  // ── Dealership profile state (dealers only) ─────────────────────
  // Web lets dealers edit their company info anytime after onboarding
  // (src/app/dashboard/dealer/settings/page.tsx); mobile's
  // DealerOnboardingScreen only ever wrote these once with no way back in.
  // Same PATCH /users/dealer-profile endpoint, same field set.
  const [dealerCompanyName, setDealerCompanyName] = useState('');
  const [dealerVatNumber, setDealerVatNumber] = useState('');
  const [dealerRegNumber, setDealerRegNumber] = useState('');
  const [dealerAddress, setDealerAddress] = useState('');
  const [dealerPhone, setDealerPhone] = useState('');
  const [dealerWebsite, setDealerWebsite] = useState('');
  const [dealerDescription, setDealerDescription] = useState('');
  const [dealerLogo, setDealerLogo] = useState('');
  const [dealerSaving, setDealerSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [dealerFieldErrors, setDealerFieldErrors] = useState<{ companyName?: string; vatNumber?: string }>({});

  const handlePickDealerLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsMultipleSelection: false,
      quality: 1.0,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingLogo(true);
    try {
      const jpegUri = await convertAndCompress(result.assets[0].uri);
      const userId = user?.id ?? 'anon';
      const url = await uploadToStorage(jpegUri, 'listings', `${userId}/dealer-logo/${Date.now()}.jpg`, 'image/jpeg');
      setDealerLogo(url);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not upload logo. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveDealerProfile = async () => {
    const trimmedCompany = dealerCompanyName.trim();
    const trimmedVat = dealerVatNumber.trim();
    const nextFieldErrors: { companyName?: string; vatNumber?: string } = {};
    if (!trimmedCompany) nextFieldErrors.companyName = 'Company name is required';
    if (!trimmedVat) nextFieldErrors.vatNumber = 'VAT number is required';
    setDealerFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setDealerSaving(true);
    try {
      await apiClient('/users/dealer-profile', {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: trimmedCompany,
          vatNumber: trimmedVat,
          registrationNumber: dealerRegNumber.trim(),
          businessAddress: dealerAddress.trim(),
          phone: dealerPhone.trim(),
          website: dealerWebsite.trim(),
          description: dealerDescription.trim(),
          logo: dealerLogo,
        }),
      });
      Alert.alert('Saved', 'Dealership profile updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update dealership profile.');
    } finally {
      setDealerSaving(false);
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
  // ── Account deletion (AUTH-033 / DASH-030) ──
  // App-store policy generally requires in-app deletion for any app that lets
  // you create an account. A grep of mobile src/ for deleteAccount previously
  // returned nothing at all.
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Trader (address) verification state ─────────────────────────
  // Ported from the dead ProfileScreen.tsx (main/ProfileScreen.tsx), which was
  // fully built but unreachable from anywhere in the app — this was the only
  // genuinely real, backend-wired feature in it that SettingsScreen didn't
  // already cover (the rest duplicated this screen or was mock UI: fake
  // payment-method picker, fake local "help chat"). Moved the real feature
  // here instead of wiring up the dead screen as-is.
  const isAddressVerified = !!user?.isAddressVerified;
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [verifyStage, setVerifyStage] = useState<'address' | 'code'>('address');
  const [verifyAddressInput, setVerifyAddressInput] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifySending, setVerifySending] = useState(false);
  const [verifyConfirming, setVerifyConfirming] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleSendVerificationCode = async () => {
    const address = verifyAddressInput.trim();
    setVerifyError(null);
    if (address.length < 5) {
      setVerifyError('Please enter your full residential address to continue.');
      return;
    }
    setVerifySending(true);
    try {
      const result = await startAddressVerification(address);
      setVerificationCode('');
      setVerifyStage('code');
      Alert.alert('Code sent', result.message || 'Verification code sent to your email');
    } catch (err: any) {
      setVerifyError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setVerifySending(false);
    }
  };

  const handleConfirmVerificationCode = async () => {
    setVerifyError(null);
    if (verificationCode.trim().length !== 6) {
      setVerifyError('Please enter the 6-digit code we emailed you.');
      return;
    }
    setVerifyConfirming(true);
    try {
      await confirmAddressVerification(verificationCode.trim());
      await initializeAuth();
      setVerifyModalVisible(false);
      Alert.alert('Verified!', 'Address verified — Verified Trader badge unlocked.');
    } catch (err: any) {
      setVerifyError(err?.message || 'Incorrect or expired code. Please try again.');
    } finally {
      setVerifyConfirming(false);
    }
  };

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

  // Typed confirmation is not decoration: the backend independently rejects
  // anything other than DELETE (`users.controller.ts:241-243`), so the client
  // check keeps the user from a pointless round trip rather than being the
  // only gate.
  const canConfirmDelete = deleteConfirmText.trim().toUpperCase() === 'DELETE';

  const handleDeleteAccount = async () => {
    if (!canConfirmDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient('/users/me', {
        method: 'DELETE',
        body: JSON.stringify({ confirmation: 'DELETE' }),
      });
      setDeleteModalOpen(false);
      // Reuse the normal sign-out path rather than writing a second teardown.
      // It clears the backend session, Supabase tokens and local state in the
      // right order, and RootNavigator swaps to the Auth stack off the back of
      // it. Its POST /auth/logout is best-effort and already tolerant of the
      // session the server has just destroyed.
      await logout();
    } catch (err: any) {
      // Surface the server's own message. The backend blocks deletion during a
      // live auction you are selling in or actively bidding on
      // (`users.service.ts:117-136`), and those reasons are specific and
      // actionable — replacing them with a generic failure would strand the
      // user with no idea what to do.
      setDeleteError(err?.message || 'Could not delete your account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };
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
        <HamburgerButton />
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

        {/* ── 2. DEALERSHIP PROFILE (dealers only) ── */}
        {role === 'dealer' && (
          <>
            <SectionHeader icon="storefront-outline" label="DEALERSHIP PROFILE" />
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.avatarRow}
                activeOpacity={0.8}
                onPress={handlePickDealerLogo}
                disabled={uploadingLogo}
              >
                <View style={styles.avatarCircle}>
                  {uploadingLogo ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : dealerLogo ? (
                    <Image source={{ uri: dealerLogo }} style={styles.avatarImage} contentFit="cover" />
                  ) : (
                    <Ionicons name="storefront-outline" size={22} color={Colors.iconMuted} />
                  )}
                </View>
                <View>
                  <Text style={styles.avatarChangeText}>Change logo</Text>
                  <Text style={styles.avatarHintText}>JPG or PNG, square works best</Text>
                </View>
              </TouchableOpacity>

              <View>
                <FieldLabel label="COMPANY NAME" />
                <TextInput
                  style={styles.inputField}
                  value={dealerCompanyName}
                  onChangeText={v => { setDealerCompanyName(v); if (dealerFieldErrors.companyName) setDealerFieldErrors(prev => ({ ...prev, companyName: undefined })); }}
                  placeholder="e.g. Knightsbridge Motors Ltd"
                  placeholderTextColor={Colors.iconMuted}
                />
                {dealerFieldErrors.companyName ? <Text style={styles.fieldErrorText}>{dealerFieldErrors.companyName}</Text> : null}
              </View>

              <View>
                <FieldLabel label="VAT NUMBER" />
                <TextInput
                  style={styles.inputField}
                  value={dealerVatNumber}
                  onChangeText={v => { setDealerVatNumber(v); if (dealerFieldErrors.vatNumber) setDealerFieldErrors(prev => ({ ...prev, vatNumber: undefined })); }}
                  placeholder="e.g. GB 123 456 789"
                  placeholderTextColor={Colors.iconMuted}
                />
                {dealerFieldErrors.vatNumber ? <Text style={styles.fieldErrorText}>{dealerFieldErrors.vatNumber}</Text> : null}
              </View>

              <View>
                <FieldLabel label="COMPANIES HOUSE REG" />
                <TextInput
                  style={styles.inputField}
                  value={dealerRegNumber}
                  onChangeText={setDealerRegNumber}
                  keyboardType="numeric"
                  placeholder="e.g. 12345678"
                  placeholderTextColor={Colors.iconMuted}
                />
              </View>

              <View>
                <FieldLabel label="BUSINESS ADDRESS" />
                <TextInput
                  style={styles.inputField}
                  value={dealerAddress}
                  onChangeText={setDealerAddress}
                  placeholder="e.g. 42 Sloane St, SW1X 9LT"
                  placeholderTextColor={Colors.iconMuted}
                />
              </View>

              <View style={styles.bankRow}>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="BUSINESS PHONE" />
                  <TextInput
                    style={styles.inputField}
                    value={dealerPhone}
                    onChangeText={setDealerPhone}
                    keyboardType="phone-pad"
                    placeholder="e.g. +44 20 7123 4567"
                    placeholderTextColor={Colors.iconMuted}
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <FieldLabel label="WEBSITE" />
                  <TextInput
                    style={styles.inputField}
                    value={dealerWebsite}
                    onChangeText={setDealerWebsite}
                    autoCapitalize="none"
                    keyboardType="url"
                    placeholder="e.g. yourdealer.co.uk"
                    placeholderTextColor={Colors.iconMuted}
                  />
                </View>
              </View>

              <View>
                <FieldLabel label="DESCRIPTION / TAGLINE" />
                <TextInput
                  style={[styles.inputField, { height: 72, paddingTop: 12, textAlignVertical: 'top' }]}
                  value={dealerDescription}
                  onChangeText={setDealerDescription}
                  placeholder="A short line about your dealership"
                  placeholderTextColor={Colors.iconMuted}
                  multiline
                />
              </View>

              <View style={styles.cardDivider} />
              <TouchableOpacity
                style={[styles.saveBtn, dealerSaving && { opacity: 0.6 }]}
                activeOpacity={0.8}
                onPress={handleSaveDealerProfile}
                disabled={dealerSaving}
              >
                {dealerSaving
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.saveBtnText}>SAVE DEALERSHIP PROFILE</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Dealer team invite entry point (non-dealers only) ── */}
        {/* Web's invite email links to a plain https:// page mobile can't
            intercept (no Universal/App Links configured) — this gives
            invited users a reachable way in: paste the link/code here. */}
        {role !== 'dealer' && (
          <TouchableOpacity
            style={styles.inviteRow}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AcceptInvite')}
          >
            <View style={styles.inviteIconWrap}>
              <Ionicons name="mail-open-outline" size={16} color={Colors.accent} />
            </View>
            <Text style={styles.inviteRowText}>Have a dealer team invite? Accept it here</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.iconMuted} />
          </TouchableOpacity>
        )}

        {/* ── 3. TRADER VERIFICATION ── */}
        <SectionHeader icon={isAddressVerified ? 'shield-checkmark-outline' : 'shield-outline'} label="TRADER VERIFICATION" />
        <View style={styles.card}>
          <Text style={styles.payoutDesc}>
            {isAddressVerified
              ? 'Address verified! Your account shows a Verified Trader badge to buyers and sellers.'
              : 'Verify your address to earn a Verified Trader badge and build trust with buyers and sellers.'}
          </Text>
          {isAddressVerified ? (
            <View style={styles.stripeConnected}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.stripeConnectedText}>Address verified</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.stripeBtn}
              activeOpacity={0.8}
              onPress={() => {
                setVerifyStage('address');
                setVerifyAddressInput('');
                setVerificationCode('');
                setVerifyError(null);
                setVerifyModalVisible(true);
              }}
            >
              <Text style={styles.stripeBtnText}>VERIFY ADDRESS</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 4. SECURITY & PASSWORD ── */}
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

        {/* ── 5. PAYOUTS ── */}
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

        {/* ── 6. BANK ACCOUNT DETAILS ── */}
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

        {/* ── Danger zone ── */}
        <View style={styles.dangerCard}>
          <SectionHeader icon="warning-outline" label="DANGER ZONE" />
          <Text style={styles.dangerCopy}>
            Deleting your account is permanent. Your active listings are withdrawn and your
            personal details are removed.
          </Text>
          <TouchableOpacity
            style={styles.deleteBtn}
            activeOpacity={0.8}
            onPress={() => { setDeleteConfirmText(''); setDeleteError(null); setDeleteModalOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
          >
            <Ionicons name="trash-outline" size={15} color={Colors.error} />
            <Text style={styles.deleteBtnText}>DELETE ACCOUNT</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Delete account — typed confirmation, mirroring web
          (DeleteAccountSection.tsx:73-97). The backend rejects anything but
          DELETE independently, so this is a guard, not the only gate. */}
      <BottomSheet
        visible={deleteModalOpen}
        onClose={() => { if (!deleting) { setDeleteModalOpen(false); setDeleteError(null); } }}
        title="Delete your account?"
        avoidKeyboard
      >
        <View style={styles.verifyModalBody}>
          {deleteError ? (
            <View style={{ marginBottom: 16 }}>
              <ErrorBanner message={deleteError} />
            </View>
          ) : null}
          <Text style={styles.dangerCopy}>
            This is permanent and cannot be undone. Your active listings will be withdrawn and
            your personal details removed. Type DELETE below to confirm.
          </Text>
          <FieldLabel label="CONFIRMATION" />
          <TextInput
            style={styles.inputField}
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            placeholder="Type DELETE"
            placeholderTextColor={Colors.iconMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
          />
          <TouchableOpacity
            style={[styles.deleteConfirmBtn, (!canConfirmDelete || deleting) && { opacity: 0.4 }]
            }
            activeOpacity={0.8}
            onPress={handleDeleteAccount}
            disabled={!canConfirmDelete || deleting}
            accessibilityRole="button"
            accessibilityLabel="Permanently delete my account"
          >
            {deleting
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.deleteConfirmBtnText}>DELETE MY ACCOUNT</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: 14 }}
            onPress={() => { if (!deleting) { setDeleteModalOpen(false); setDeleteError(null); } }}
            disabled={deleting}
          >
            <Text style={styles.resendLinkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Address Verification Stepper Modal */}
      <BottomSheet
        visible={verifyModalVisible}
        onClose={() => { setVerifyModalVisible(false); setVerifyError(null); }}
        title={`Trader Verification (Step ${verifyStage === 'address' ? 1 : 2}/2)`}
        avoidKeyboard
      >
        <View style={styles.verifyModalBody}>
          {verifyError ? (
            <View style={{ marginBottom: 16 }}>
              <ErrorBanner message={verifyError} />
            </View>
          ) : null}
          {verifyStage === 'address' && (
            <View>
              <Text style={styles.verifyStepTitle}>Confirm Your Address</Text>
              <Text style={styles.verifyStepSub}>
                Enter your current residential address. We'll email a 6-digit verification code to {user?.email || 'your account email'}.
              </Text>
              <TextInput
                style={[styles.inputField, { height: 72, paddingTop: 12, textAlignVertical: 'top' }]}
                value={verifyAddressInput}
                onChangeText={setVerifyAddressInput}
                placeholder="Enter your full address"
                placeholderTextColor={Colors.iconMuted}
                autoCapitalize="words"
                multiline
              />
              <TouchableOpacity
                style={[styles.stripeBtn, { marginTop: 16 }, verifySending && { opacity: 0.6 }]}
                onPress={handleSendVerificationCode}
                disabled={verifySending}
              >
                {verifySending
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.stripeBtnText}>SEND VERIFICATION CODE</Text>}
              </TouchableOpacity>
            </View>
          )}
          {verifyStage === 'code' && (
            <View>
              <Text style={styles.verifyStepTitle}>Enter Verification Code</Text>
              <Text style={styles.verifyStepSub}>
                We've emailed a 6-digit code to {user?.email || 'your account email'}. Enter it below to verify {verifyAddressInput.trim()}.
              </Text>
              <TextInput
                style={styles.inputField}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="Enter 6-digit code"
                placeholderTextColor={Colors.iconMuted}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                style={[styles.stripeBtn, { marginTop: 16 }, verifyConfirming && { opacity: 0.6 }]}
                onPress={handleConfirmVerificationCode}
                disabled={verifyConfirming}
              >
                {verifyConfirming
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.stripeBtnText}>CONFIRM & VERIFY</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center', marginTop: 14 }} onPress={() => { setVerifyStage('address'); setVerifyError(null); }}>
                <Text style={styles.resendLinkText}>Wrong address? Go back</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </BottomSheet>
    </View>
  );
};

// ══════════════════════════ STYLES ════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  dangerCard: {
    backgroundColor: Colors.errorAlpha08,
    borderWidth: 1,
    borderColor: Colors.errorAlpha20,
    borderRadius: Radius.card,
    padding: 16,
    marginTop: 8,
  },
  dangerCopy: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 14,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.errorAlpha30,
    backgroundColor: Colors.errorAlpha10,
  },
  deleteBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.error,
    letterSpacing: 1.1,
  },
  deleteConfirmBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: Radius.inline,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 1.1,
  },
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

  // Dealer invite entry point
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha07,
    padding: 14, marginTop: 16,
  },
  inviteIconWrap: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: Colors.accentAlpha10, alignItems: 'center', justifyContent: 'center',
  },
  inviteRowText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.white },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 10 },
  sectionIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: Colors.accentAlpha10, alignItems: 'center', justifyContent: 'center',
  },
  sectionLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 1.2 },

  // Card
  card: {
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.whiteAlpha07,
    padding: 18, gap: 14,
  },
  cardDivider: { height: 1, backgroundColor: Colors.whiteAlpha07, marginHorizontal: -2 },

  // Field label
  fieldLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.iconMuted, letterSpacing: 1, marginBottom: 6 },
  fieldErrorText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.error, marginTop: 6 },

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
    backgroundColor: Colors.whiteAlpha04, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha07,
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
  },
  pwdInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size14, color: Colors.white },
  pwdRow: { flexDirection: 'row' },

  // Buttons
  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.inline, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  updatePwdBtn: {
    backgroundColor: Colors.darkBlue_1d2030, borderRadius: Radius.inline, height: 44,
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
    backgroundColor: Colors.warningAlpha08, borderRadius: Radius.inline, borderWidth: 1,
    borderColor: Colors.warningAlpha25, padding: 12,
  },
  stripeWarningText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.warning, lineHeight: 17 },
  stripeBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.inline, height: 44,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  stripeBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, letterSpacing: 0.5 },
  stripeNote: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted, textAlign: 'center', marginTop: -4 },

  // Bank details
  inputField: {
    backgroundColor: Colors.whiteAlpha04, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha07,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: FontFamily.regular, fontSize: FontSize.size14, color: Colors.white,
  },
  bankRow: { flexDirection: 'row' },
  bankSaveBtn: {
    backgroundColor: Colors.warning, borderRadius: Radius.inline, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },

  // Address verification modal
  verifyModalBody: { padding: 20 },
  verifyStepTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white, marginBottom: 8 },
  verifyStepSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  resendLinkText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textDecorationLine: 'underline' },
});
