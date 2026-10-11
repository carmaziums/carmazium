import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, TextInput, ActivityIndicator, Switch, AppState, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
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
import { useNativeAppearance } from '../../theme/NativeAppearanceProvider';

import { IconButton } from '../../components/IconButton';
import { BottomSheet } from '../../components/BottomSheet';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { useSingleColumnSettings } from '../../lib/nativeLayoutParity';
import { getOrCreateSupportRoom } from '../../lib/chatApi';
type NavProp = NativeStackNavigationProp<MainStackParamList>;
type SettingsCategory = 'personal' | 'business' | 'verification' | 'notifications' | 'payouts' | 'appearance' | 'security' | 'reviews' | 'account';
const isSettingsCategory = (value: unknown): value is SettingsCategory =>
  typeof value === 'string' &&
  ['personal', 'business', 'verification', 'notifications', 'payouts', 'appearance', 'security', 'reviews', 'account'].includes(value);

// ─────────────────────────── helpers ──────────────────────────────

type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer?: { displayName?: string };
  target?: { displayName?: string };
};

const SectionHeader: React.FC<{ icon: string; label: string }> = ({ icon, label }) => {
  const { palette } = useNativeAppearance();
  const themed = useSettingsThemeStyles();
  return (
  <View style={themed.sectionHeader}>
    <View style={themed.sectionIconWrap}>
      <Ionicons name={icon as any} size={14} color={Colors.accent} />
    </View>
    <Text style={themed.sectionLabel}>{label}</Text>
  </View>
  );
};

const FieldLabel: React.FC<{ label: string }> = ({ label }) => {
  const themed = useSettingsThemeStyles();
  return <Text style={themed.fieldLabel}>{label}</Text>;
};

// ══════════════════════════ COMPONENT ════════════════════════════

export const SettingsScreen: React.FC = () => {
  const { palette, resolvedAppearance } = useNativeAppearance();
  const themed = useSettingsThemeStyles();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth, fontScale } = useWindowDimensions();
  const singleColumnSettings = useSingleColumnSettings(viewportWidth, fontScale);
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<MainStackParamList, 'Settings'>>();
  const { user, accountRole, updateUser, initializeAuth, logout } = useAuthStore();
  const isDealerAccount = accountRole === 'dealer';
  const isDealerStaff = !!user?.isDealerStaff;
  // A team member may edit their OWN personal settings, but is not the dealer owner.
  // Do not display ownership-sensitive business forms or KYC entry points to staff.
  const canManageBusiness = isDealerAccount && !isDealerStaff;
  const requestedSection = route.params?.section;
  const resolveCategory = (section: unknown): SettingsCategory =>
    isSettingsCategory(section) && (section !== 'business' || canManageBusiness)
      ? section : 'personal';
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(() =>
    resolveCategory(requestedSection)
  );
  const [supportLoading, setSupportLoading] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<{ average: number; count: number } | null>(null);
  const [ratingReceived, setRatingReceived] = useState<ReviewItem[]>([]);
  const [ratingGiven, setRatingGiven] = useState<ReviewItem[]>([]);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  useEffect(() => {
    // A deep link is external input: unknown and dealer-only categories must
    // never land other roles on an empty settings page.
    if (requestedSection) setActiveCategory(resolveCategory(requestedSection));
  }, [requestedSection, canManageBusiness]);
  useEffect(() => {
    if (!canManageBusiness && activeCategory === 'business') setActiveCategory('personal');
  }, [canManageBusiness, activeCategory]);
  const scrollRef = React.useRef<ScrollView>(null);
  // Match the website's /profile Account Settings nine-section hierarchy,
  // while keeping native-specific account verification functionality.
  const categories: { id: SettingsCategory; label: string; icon: string }[] = [
    { id: 'personal', label: 'Personal details', icon: 'person-outline' },
    ...(canManageBusiness ? [{ id: 'business' as const, label: 'Business profile', icon: 'business-outline' }] : []),
    { id: 'verification', label: 'Verification', icon: 'shield-checkmark-outline' },
    { id: 'notifications', label: 'Notifications & privacy', icon: 'notifications-outline' },
    { id: 'payouts', label: 'Payouts', icon: 'wallet-outline' },
    { id: 'appearance', label: 'Appearance', icon: 'color-palette-outline' },
    { id: 'security', label: 'Security', icon: 'lock-closed-outline' },
    { id: 'reviews', label: 'Ratings & reviews', icon: 'star-outline' },
    { id: 'account', label: 'Account type', icon: 'settings-outline' },
  ];
  const handleContactSupport = async () => {
    if (supportLoading) return;
    setSupportLoading(true);
    try {
      // Same real in-app support room as the existing navigation drawer.
      const room = await getOrCreateSupportRoom();
      navigation.navigate('ChatScreen', { threadId: room.id });
    } catch (error: any) {
      Alert.alert('Support unavailable', error?.message || 'Please try again.');
    } finally {
      setSupportLoading(false);
    }
  };

  useEffect(() => {
    if (activeCategory !== 'reviews' || !user?.id) return;
    let active = true;
    setRatingLoading(true);
    setRatingError(null);
    // Website /profile uses these same read-only reputation endpoints.
    Promise.all([
      apiClient<{ success: boolean; data: { rating: { average: number; count: number } } }>(`/profiles/${user.id}`),
      apiClient<{ success: boolean; data: { data: ReviewItem[] } }>(`/profiles/${user.id}/reviews?limit=20`),
      apiClient<{ success: boolean; data: { data: ReviewItem[] } }>(`/profiles/me/reviews/given?limit=20`),
    ]).then(([summary, received, given]) => {
      if (!active) return;
      if (!summary?.data?.rating || !Array.isArray(received?.data?.data)
        || !Array.isArray(given?.data?.data)) throw new Error('Reputation details are unavailable');
      setRatingSummary(summary.data.rating);
      setRatingReceived(received.data.data);
      setRatingGiven(given.data.data);
    }).catch(() => {
      if (active) setRatingError('Reviews could not be loaded. Previously shown information may be out of date.');
    }).finally(() => { if (active) setRatingLoading(false); });
    return () => { active = false; };
  }, [activeCategory, user?.id]);

  const selectCategory = (category: SettingsCategory) => {
    setActiveCategory(category);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

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
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  // Do not overwrite privacy preferences with defaults if /users/me fails.
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferencesFetchComplete, setPreferencesFetchComplete] = useState(false);
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
          // /users/me also returns the saved payout fallback. A blank bank
          // form previously looked like the user's details had been lost and
          // could overwrite a known account on the next save.
          setBankName(p.bankAccountName ?? '');
          setSortCode(p.bankSortCode ?? '');
          setAccountNumber(p.bankAccountNumber ?? '');
          if (typeof p.notifyOnSale === 'boolean' && typeof p.showPublicProfile === 'boolean') {
            setPreferencesLoaded(true);
          }
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
            setDealerBusinessType(dp.kyc?.businessType === 'SOLE_PROPRIETORSHIP' ? 'SOLE_PROPRIETORSHIP' : 'PRIVATE_LIMITED');
            setDealerKycStatus(dp.kyc?.status ?? null);
          }
        }
      } catch { /* keep store-derived defaults */ }
      finally { setPreferencesFetchComplete(true); }
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
  const [dealerBusinessType, setDealerBusinessType] = useState<'PRIVATE_LIMITED' | 'SOLE_PROPRIETORSHIP'>('PRIVATE_LIMITED');
  const [dealerKycStatus, setDealerKycStatus] = useState<string | null>(null);
  const isSoleTraderDealer = dealerBusinessType === 'SOLE_PROPRIETORSHIP';

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
    if (!trimmedCompany) nextFieldErrors.companyName = isSoleTraderDealer ? 'Trading name is required' : 'Company name is required';
    if (!isSoleTraderDealer && !trimmedVat) nextFieldErrors.vatNumber = 'VAT number is required';
    setDealerFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setDealerSaving(true);
    try {
      await apiClient('/users/dealer-profile', {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: trimmedCompany,
          ...(!isSoleTraderDealer ? {
            vatNumber: trimmedVat,
            registrationNumber: dealerRegNumber.trim(),
          } : {}),
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
    payoutsEnabled?: boolean;
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
      Alert.alert('Address verified', 'Your address verification has been saved. Other required account checks remain separate.');
    } catch (err: any) {
      setVerifyError(err?.message || 'Incorrect or expired code. Please try again.');
    } finally {
      setVerifyConfirming(false);
    }
  };

  // Read current server payout eligibility, including after returning from
  // Stripe's browser onboarding. Submission alone does not guarantee payouts
  // are enabled; only the provider's payoutsEnabled state is authoritative.
  const refreshStripeStatus = useCallback(async () => {
    setStripeLoading(true);
    try {
      const res = await apiClient<{ success: boolean; data: any }>('/users/stripe-connect/status');
      if (res?.success) setStripeStatus(res.data);
    } catch { /* retain last known status; no success is invented */ }
    finally { setStripeLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    if (activeCategory === 'payouts') void refreshStripeStatus();
  }, [activeCategory, refreshStripeStatus]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && activeCategory === 'payouts') void refreshStripeStatus();
    });
    return () => subscription.remove();
  }, [activeCategory, refreshStripeStatus]);

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

  const handleSavePreferences = async () => {
    if (!preferencesLoaded || preferencesSaving) return;
    setPreferencesSaving(true);
    try {
      await apiClient('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ notifyOnSale, showPublicProfile }),
      });
      Alert.alert('Saved', 'Notification and privacy preferences updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update your preferences.');
    } finally {
      setPreferencesSaving(false);
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
            returnUrl: 'carmazium://settings?section=payouts',
            refreshUrl: 'carmazium://settings?section=payouts',
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

  const stripeOnboarded = stripeStatus?.payoutsEnabled === true;
  const stripePartial = !!stripeStatus?.accountId && !stripeOnboarded;

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
    <View style={themed.container}>
      <StatusBar barStyle={resolvedAppearance === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor={palette.bgBody} />
      <LinearGradient
        colors={[Colors.accentAlpha04, 'rgba(10,10,12,0)', palette.bgBody]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <WebsiteTopBar />
      <View style={themed.settingsPageHeader}>
        <Text style={themed.settingsPageTitle}>Account Settings</Text>
        <Text style={themed.settingsPageSubtitle}>
          One place for your profile, business, notifications, payouts and security.
        </Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to previous screen"
          onPress={() => navigation.goBack()} style={themed.settingsBackLink}>
          <Ionicons name="arrow-back" size={16} color={Colors.accent} />
          <Text style={themed.settingsBackText}>Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        ref={scrollRef}
        style={themed.scroll}
        contentContainerStyle={[themed.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >

        <View style={themed.accountToolsPanel}>
          <Text style={themed.accountToolsHeading}>YOUR ACCOUNT TOOLS</Text>
          <Text style={themed.accountToolsSub}>Quick access to the same conversations and saved vehicles on web and app.</Text>
          <View style={themed.accountToolsGrid}>
            {[
              { id: 'saved', label: 'Saved Cars', icon: 'heart-outline',
                action: () => navigation.navigate('Tabs', { screen: 'Saved' }) },
              { id: 'messages', label: 'Messages', icon: 'chatbubbles-outline',
                action: () => navigation.navigate('Messages') },
              { id: 'notifications', label: 'Notifications', icon: 'notifications-outline',
                action: () => navigation.navigate('Notifications') },
            ].map(tool => (
              <TouchableOpacity key={tool.id} style={[themed.accountToolButton, singleColumnSettings && styles.fullWidthTool]}
                accessibilityRole="button" accessibilityLabel={tool.label}
                onPress={tool.action}>
                <Ionicons name={tool.icon as any} size={19} color={Colors.accent} />
                <Text style={themed.accountToolLabel}>{tool.label}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[themed.accountToolButton, singleColumnSettings && styles.fullWidthTool]} accessibilityRole="button"
              accessibilityLabel="Contact Support" disabled={supportLoading}
              onPress={() => { void handleContactSupport(); }}>
              <Ionicons name="help-circle-outline" size={19} color={Colors.accent} />
              <Text style={themed.accountToolLabel}>
                {supportLoading ? 'Opening support…' : 'Contact Support'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={themed.categoryGrid} accessibilityLabel="Account settings categories">
          {categories.map(category => {
            const selected = activeCategory === category.id;
            return (
              <TouchableOpacity
                key={category.id}
                style={[themed.categoryButton, singleColumnSettings && styles.fullWidthCategory, selected && styles.categoryButtonSelected]}
                onPress={() => selectCategory(category.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={category.label}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={category.icon as any}
                  size={19}
                  color={selected ? Colors.white : Colors.textSecondary}
                />
                <Text style={[themed.categoryLabel, selected && styles.categoryLabelSelected]}>
                  {category.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeCategory === 'personal' && (
          <>
        {/* ── 1. PROFILE INFORMATION ── */}
        <SectionHeader icon="person-circle-outline" label="PROFILE INFORMATION" />
        <View style={themed.card}>
          <TouchableOpacity
            style={themed.avatarRow}
            activeOpacity={0.8}
            onPress={handlePickProfilePhoto}
            disabled={uploadingPhoto}
          >
            <View style={themed.avatarCircle}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : profileImage ? (
                <Image source={{ uri: profileImage }} style={themed.avatarImage} contentFit="cover" />
              ) : (
                <Text style={themed.avatarInitials}>{initials}</Text>
              )}
            </View>
            <View>
              <Text style={themed.avatarChangeText}>Change photo</Text>
              <Text style={themed.avatarHintText}>JPG or PNG, square works best</Text>
            </View>
          </TouchableOpacity>

          <View style={themed.fieldRow}>
            <View style={themed.fieldWrap}>
              <FieldLabel label="FIRST NAME" />
              <TextInput
                style={themed.fieldInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={palette.textMuted}
              />
            </View>
            <View style={themed.fieldDividerV} />
            <View style={themed.fieldWrap}>
              <FieldLabel label="LAST NAME" />
              <TextInput
                style={themed.fieldInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={palette.textMuted}
              />
            </View>
          </View>

          <View style={themed.fieldRow}>
            <View style={themed.fieldWrap}>
              <FieldLabel label="EMAIL ADDRESS" />
              <Text style={themed.fieldValueReadonly}>{profileEmail || '—'}</Text>
            </View>
            <View style={themed.fieldDividerV} />
            <View style={themed.fieldWrap}>
              <FieldLabel label="PHONE NUMBER" />
              <TextInput
                style={themed.fieldInput}
                value={profilePhone}
                onChangeText={setProfilePhone}
                placeholder="Not set"
                placeholderTextColor={palette.textMuted}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={themed.cardDivider} />
          <TouchableOpacity
            style={[themed.saveBtn, profileSaving && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleSaveProfile}
            disabled={profileSaving}
          >
            {profileSaving
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={themed.saveBtnText}>SAVE PROFILE</Text>}
          </TouchableOpacity>
        </View>
          </>
        )}

        {activeCategory === 'notifications' && (
          <>
            <SectionHeader icon="notifications-outline" label="NOTIFICATIONS & PRIVACY" />
            <TouchableOpacity
          style={themed.notificationShortcut}
          onPress={() => navigation.navigate('NotificationSettings')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Manage notification preferences"
        >
          <View style={themed.notificationShortcutIcon}>
            <Ionicons name="notifications-outline" size={22} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={themed.notificationShortcutTitle}>Notification preferences</Text>
            <Text style={themed.notificationShortcutHint}>Choose auction, offer and email alerts</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
            <View style={themed.card}>
          {!preferencesFetchComplete && (
            <Text style={themed.preferenceNotice}>Loading your saved notification and privacy preferences…</Text>
          )}
          {preferencesFetchComplete && !preferencesLoaded && (
            <Text style={themed.preferenceNotice}>Your saved preferences could not be confirmed. They will not be changed until they can be loaded.</Text>
          )}
          <View style={themed.toggleRow}>
            <View style={themed.toggleTextWrap}>
              <Text style={themed.toggleTitle}>Email me when a listing is sold</Text>
            </View>
            <Switch
              value={notifyOnSale}
              onValueChange={setNotifyOnSale}
              disabled={!preferencesLoaded}
              accessibilityLabel="Email me when a listing is sold"
              trackColor={{ false: Colors.whiteAlpha10, true: Colors.accent }}
              thumbColor={Colors.white}
              ios_backgroundColor={Colors.whiteAlpha10}
            />
          </View>
          <View style={themed.toggleRow}>
            <View style={themed.toggleTextWrap}>
              <Text style={themed.toggleTitle}>Show my profile publicly</Text>
            </View>
            <Switch
              value={showPublicProfile}
              onValueChange={setShowPublicProfile}
              disabled={!preferencesLoaded}
              accessibilityLabel="Show my profile publicly"
              trackColor={{ false: Colors.whiteAlpha10, true: Colors.accent }}
              thumbColor={Colors.white}
              ios_backgroundColor={Colors.whiteAlpha10}
            />
          </View>
              <View style={themed.cardDivider} />
              <TouchableOpacity
                style={[themed.saveBtn, (preferencesSaving || !preferencesLoaded) && { opacity: 0.55 }]}
                activeOpacity={0.8}
                onPress={handleSavePreferences}
                disabled={preferencesSaving || !preferencesLoaded}
                accessibilityRole="button"
                accessibilityLabel="Save notification and privacy preferences"
              >
                {preferencesSaving
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={themed.saveBtnText}>SAVE PREFERENCES</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}

        {activeCategory === 'business' && (
          <>
        {/* ── 2. DEALERSHIP PROFILE (dealers only) ── */}
        {canManageBusiness && (
          <>
            <SectionHeader icon="storefront-outline" label="DEALERSHIP PROFILE" />
            <View style={themed.card}>
              <TouchableOpacity
                style={themed.avatarRow}
                activeOpacity={0.8}
                onPress={handlePickDealerLogo}
                disabled={uploadingLogo}
              >
                <View style={themed.avatarCircle}>
                  {uploadingLogo ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : dealerLogo ? (
                    <Image source={{ uri: dealerLogo }} style={themed.avatarImage} contentFit="cover" />
                  ) : (
                    <Ionicons name="storefront-outline" size={22} color={Colors.iconMuted} />
                  )}
                </View>
                <View>
                  <Text style={themed.avatarChangeText}>Change logo</Text>
                  <Text style={themed.avatarHintText}>JPG or PNG, square works best</Text>
                </View>
              </TouchableOpacity>

              <View>
                <FieldLabel label={isSoleTraderDealer ? "TRADING NAME" : "COMPANY NAME"} />
                <TextInput
                  style={themed.inputField}
                  value={dealerCompanyName}
                  onChangeText={v => { setDealerCompanyName(v); if (dealerFieldErrors.companyName) setDealerFieldErrors(prev => ({ ...prev, companyName: undefined })); }}
                  placeholder={isSoleTraderDealer ? "e.g. Smith Motors" : "e.g. Knightsbridge Motors Ltd"}
                  placeholderTextColor={palette.textMuted}
                />
                {dealerFieldErrors.companyName ? <Text style={themed.fieldErrorText}>{dealerFieldErrors.companyName}</Text> : null}
              </View>

              {!isSoleTraderDealer ? (
                <>
                  <View>
                    <FieldLabel label="VAT NUMBER" />
                    <TextInput
                      style={themed.inputField}
                      value={dealerVatNumber}
                      onChangeText={v => { setDealerVatNumber(v); if (dealerFieldErrors.vatNumber) setDealerFieldErrors(prev => ({ ...prev, vatNumber: undefined })); }}
                      placeholder="e.g. GB 123 456 789"
                      placeholderTextColor={palette.textMuted}
                    />
                    {dealerFieldErrors.vatNumber ? <Text style={themed.fieldErrorText}>{dealerFieldErrors.vatNumber}</Text> : null}
                  </View>

                  <View>
                    <FieldLabel label="COMPANIES HOUSE REG" />
                    <TextInput
                      style={themed.inputField}
                      value={dealerRegNumber}
                      onChangeText={setDealerRegNumber}
                      keyboardType="numeric"
                      placeholder="e.g. 12345678"
                      placeholderTextColor={palette.textMuted}
                    />
                  </View>
                </>
              ) : null}

              <View>
                <FieldLabel label="BUSINESS ADDRESS" />
                <TextInput
                  style={themed.inputField}
                  value={dealerAddress}
                  onChangeText={setDealerAddress}
                  placeholder="e.g. 42 Sloane St, SW1X 9LT"
                  placeholderTextColor={palette.textMuted}
                />
              </View>

              <View style={themed.bankRow}>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="BUSINESS PHONE" />
                  <TextInput
                    style={themed.inputField}
                    value={dealerPhone}
                    onChangeText={setDealerPhone}
                    keyboardType="phone-pad"
                    placeholder="e.g. +44 20 7123 4567"
                    placeholderTextColor={palette.textMuted}
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <FieldLabel label="WEBSITE" />
                  <TextInput
                    style={themed.inputField}
                    value={dealerWebsite}
                    onChangeText={setDealerWebsite}
                    autoCapitalize="none"
                    keyboardType="url"
                    placeholder="e.g. yourdealer.co.uk"
                    placeholderTextColor={palette.textMuted}
                  />
                </View>
              </View>

              <View>
                <FieldLabel label="DESCRIPTION / TAGLINE" />
                <TextInput
                  style={[themed.inputField, { height: 72, paddingTop: 12, textAlignVertical: 'top' }]}
                  value={dealerDescription}
                  onChangeText={setDealerDescription}
                  placeholder="A short line about your dealership"
                  placeholderTextColor={palette.textMuted}
                  multiline
                />
              </View>

              <View style={themed.cardDivider} />
              <TouchableOpacity
                style={[themed.saveBtn, dealerSaving && { opacity: 0.6 }]}
                activeOpacity={0.8}
                onPress={handleSaveDealerProfile}
                disabled={dealerSaving}
              >
                {dealerSaving
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={themed.saveBtnText}>SAVE DEALERSHIP PROFILE</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}

          </>
        )}

        {activeCategory === 'verification' && (
          <>
        {canManageBusiness && (
          <>
            <SectionHeader icon="shield-checkmark-outline" label="BUSINESS VERIFICATION" />
            <View style={themed.card}>
              <Text style={themed.payoutDesc}>
                Legal type: {isSoleTraderDealer ? 'Sole Trader' : 'Registered Company'}
                {dealerKycStatus ? ` • Status: ${dealerKycStatus}` : ''}
              </Text>
              <Text style={[themed.payoutDesc, { marginTop: 8 }]}>
                Change your legal business type or update an application under review. If your £1 verification fee has
                already been paid, CarMazium will not charge it again. An approved account stays verified until a
                different legal type is submitted; it then returns to Pending until the new identity is approved.
              </Text>
              <TouchableOpacity
                style={[themed.stripeBtn, { marginTop: 16 }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('DealerKYC', { reverify: dealerKycStatus === 'APPROVED' })}
              >
                <Text style={themed.stripeBtnText}>
                  {dealerKycStatus === 'APPROVED' ? 'CHANGE BUSINESS TYPE / RE-VERIFY' : 'OPEN BUSINESS VERIFICATION'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Dealer team invite entry point (non-dealers only) ── */}
        {/* Web's invite email links to a plain https:// page mobile can't
            intercept (no Universal/App Links configured) — this gives
            invited users a reachable way in: paste the link/code here. */}
        {!isDealerAccount && !isDealerStaff && (
          <TouchableOpacity
            style={themed.inviteRow}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AcceptInvite')}
          >
            <View style={themed.inviteIconWrap}>
              <Ionicons name="mail-open-outline" size={16} color={Colors.accent} />
            </View>
            <Text style={themed.inviteRowText}>Have a dealer team invite? Accept it here</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.iconMuted} />
          </TouchableOpacity>
        )}

        {/* ── 3. TRADER VERIFICATION ── */}
        <SectionHeader icon={isAddressVerified ? 'shield-checkmark-outline' : 'shield-outline'} label="TRADER VERIFICATION" />
        <View style={themed.card}>
          <Text style={themed.payoutDesc}>
            {isAddressVerified
              ? 'Your address is verified. Dealer KYC and other account verification checks are tracked separately.'
              : 'Verify your address to complete this part of account verification. Other checks may still be required.'}
          </Text>
          {isAddressVerified ? (
            <View style={themed.stripeConnected}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={themed.stripeConnectedText}>Address verified</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={themed.stripeBtn}
              activeOpacity={0.8}
              onPress={() => {
                setVerifyStage('address');
                setVerifyAddressInput('');
                setVerificationCode('');
                setVerifyError(null);
                setVerifyModalVisible(true);
              }}
            >
              <Text style={themed.stripeBtnText}>VERIFY ADDRESS</Text>
            </TouchableOpacity>
          )}
        </View>
          </>
        )}

        {activeCategory === 'security' && (
          <>
        {/* ── 4. SECURITY & PASSWORD ── */}
        <SectionHeader icon="lock-closed-outline" label="SECURITY & PASSWORD" />
        <View style={themed.card}>
          <FieldLabel label="CURRENT PASSWORD" />
          <View style={themed.pwdInputWrap}>
            <TextInput
              style={themed.pwdInput}
              value={currentPwd}
              onChangeText={setCurrentPwd}
              placeholder="••••••••"
              placeholderTextColor={palette.textMuted}
              secureTextEntry={!showCurrentPwd}
              autoCapitalize="none"
            />
            <IconButton icon={<Ionicons name={showCurrentPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.iconMuted} />} onPress={() => setShowCurrentPwd(v => !v)} accessibilityLabel={showCurrentPwd ? 'Hide password' : 'Show password'} />
          </View>

          <View style={themed.pwdRow}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="NEW PASSWORD" />
              <View style={themed.pwdInputWrap}>
                <TextInput
                  style={themed.pwdInput}
                  value={newPwd}
                  onChangeText={setNewPwd}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={palette.textMuted}
                  secureTextEntry={!showNewPwd}
                  autoCapitalize="none"
                />
                <IconButton icon={<Ionicons name={showNewPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.iconMuted} />} onPress={() => setShowNewPwd(v => !v)} accessibilityLabel={showNewPwd ? 'Hide password' : 'Show password'} />
              </View>
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <FieldLabel label="CONFIRM NEW PASSWORD" />
              <View style={themed.pwdInputWrap}>
                <TextInput
                  style={themed.pwdInput}
                  value={confirmPwd}
                  onChangeText={setConfirmPwd}
                  placeholder="••••••••"
                  placeholderTextColor={palette.textMuted}
                  secureTextEntry={!showConfirmPwd}
                  autoCapitalize="none"
                />
                <IconButton icon={<Ionicons name={showConfirmPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.iconMuted} />} onPress={() => setShowConfirmPwd(v => !v)} accessibilityLabel={showConfirmPwd ? 'Hide password' : 'Show password'} />
              </View>
            </View>
          </View>

          <View style={themed.cardDivider} />
          <TouchableOpacity
            style={[themed.updatePwdBtn, pwdSaving && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleUpdatePassword}
            disabled={pwdSaving}
          >
            {pwdSaving
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={themed.saveBtnText}>UPDATE PASSWORD</Text>}
          </TouchableOpacity>
        </View>
          </>
        )}

        {activeCategory === 'payouts' && (
          <>
        {/* ── 5. PAYOUTS ── */}
        <SectionHeader icon="card-outline" label="PAYOUTS" />
        <View style={themed.card}>
          <Text style={themed.payoutDesc}>
            Connect a bank account to receive your £100 seller bonus after a successful auction handover is verified.
          </Text>

          {stripeLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} style={{ marginVertical: 16 }} />
          ) : stripeOnboarded ? (
            <View style={themed.stripeConnected}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={themed.stripeConnectedText}>Stripe payouts enabled</Text>
            </View>
          ) : (
            <>
              {stripePartial && (
                <View style={themed.stripeWarning}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} />
                  <Text style={themed.stripeWarningText}>
                    Stripe payout setup is not yet enabled. Review any outstanding verification or onboarding requirements below.
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[themed.stripeBtn, stripeConnecting && { opacity: 0.6 }]}
                activeOpacity={0.8}
                onPress={handleConnectStripe}
                disabled={stripeConnecting}
              >
                {stripeConnecting
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <>
                      <Ionicons name="arrow-redo-outline" size={16} color={Colors.white} />
                      <Text style={themed.stripeBtnText}>{stripePartial ? 'REVIEW PAYOUT ONBOARDING' : 'CONNECT PAYOUT ACCOUNT'}</Text>
                    </>}
              </TouchableOpacity>
              <Text style={themed.stripeNote}>
                You will be taken to Stripe's secure onboarding — this takes about 2 minutes.
              </Text>
            </>
          )}
        </View>

        {/* ── 6. BANK ACCOUNT DETAILS ── */}
        <SectionHeader icon="business-outline" label="BANK ACCOUNT DETAILS" />
        <View style={themed.card}>
          <Text style={themed.payoutDesc}>
            Provide your UK bank details as a fallback. CarMazium can manually transfer your £100 bonus if Stripe Connect isn't available.
          </Text>

          <FieldLabel label="ACCOUNT HOLDER NAME" />
          <TextInput
            style={themed.inputField}
            value={bankName}
            onChangeText={setBankName}
            placeholder="e.g. John Smith"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="words"
          />

          <View style={themed.bankRow}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="SORT CODE" />
              <TextInput
                style={themed.inputField}
                value={sortCode}
                onChangeText={setSortCode}
                placeholder="e.g. 00-00-00"
                placeholderTextColor={palette.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <FieldLabel label="ACCOUNT NUMBER" />
              <TextInput
                style={themed.inputField}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="e.g. 12345678"
                placeholderTextColor={palette.textMuted}
                keyboardType="numeric"
                maxLength={8}
              />
            </View>
          </View>

          <View style={themed.cardDivider} />
          <TouchableOpacity
            style={[themed.bankSaveBtn, bankSaving && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleSaveBank}
            disabled={bankSaving}
          >
            {bankSaving
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={themed.saveBtnText}>SAVE BANK DETAILS</Text>}
          </TouchableOpacity>
        </View>
          </>
        )}

        {activeCategory === 'security' && (
          <>
        {/* ── Danger zone ── */}
        <View style={themed.dangerCard}>
          <SectionHeader icon="warning-outline" label="DANGER ZONE" />
          <Text style={themed.dangerCopy}>
            Deleting your account is permanent. Your active listings are withdrawn and your
            personal details are removed.
          </Text>
          <TouchableOpacity
            style={themed.deleteBtn}
            activeOpacity={0.8}
            onPress={() => { setDeleteConfirmText(''); setDeleteError(null); setDeleteModalOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
          >
            <Ionicons name="trash-outline" size={15} color={Colors.error} />
            <Text style={themed.deleteBtnText}>DELETE ACCOUNT</Text>
          </TouchableOpacity>
        </View>
          </>
        )}

        {activeCategory === 'appearance' && (
          <View style={themed.accountSectionCard}>
            <SectionHeader icon="color-palette-outline" label="APPEARANCE" />
            <Text style={themed.accountSectionTitle}>Dark appearance</Text>
            <Text style={themed.accountSectionText}>
              The app currently uses the CarMazium website's dark colour palette.
              A live light/dark switch is not yet supported by the native theme engine.
              This screen does not pretend that changing the website theme changes app colours.
            </Text>
          </View>
        )}

        {activeCategory === 'reviews' && (
          <View style={themed.accountSectionCard}>
            <SectionHeader icon="star-outline" label="RATINGS & REVIEWS" />
            <Text style={themed.accountSectionText}>See what others have written about you and the reviews you have given.</Text>
            {ratingLoading && <ActivityIndicator color={Colors.accent} style={{ marginVertical: 10 }} />}
            {!!ratingError && (
              <Text style={themed.accountErrorText}>{ratingError}</Text>
            )}
            {!!ratingSummary && (
              <View style={themed.reviewSummary}>
                <Ionicons name="star" size={20} color={Colors.warning} />
                <Text style={themed.reviewScore}>
                  {Number(ratingSummary.average).toFixed(1)}
                </Text>
                <Text style={themed.accountSectionText}>
                  ({ratingSummary.count.toLocaleString('en-GB')} reviews)
                </Text>
              </View>
            )}
            {!ratingLoading && !ratingError && (
              <>
                {([
                  { label: 'Reviews received', items: ratingReceived, from: 'reviewer' as const },
                  { label: 'Reviews given', items: ratingGiven, from: 'target' as const },
                ]).map(group => (
                  <View key={group.label} style={themed.reviewGroup}>
                    <Text style={themed.accountSectionTitle}>{group.label}</Text>
                    {group.items.length === 0 && (
                      <Text style={themed.accountSectionText}>No {group.label.toLowerCase()} yet.</Text>
                    )}
                    {group.items.map(review => (
                      <View key={review.id} style={themed.reviewRow}>
                        <View style={themed.reviewRowHeading}>
                          <Text style={themed.reviewName}>
                            {group.from === 'reviewer'
                              ? review.reviewer?.displayName || 'CarMazium user'
                              : review.target?.displayName || 'CarMazium user'}
                          </Text>
                          <Text style={themed.reviewStars}>
                            {Number(review.rating).toFixed(1)} / 5
                          </Text>
                        </View>
                        {!!review.comment && <Text style={themed.accountSectionText}>{review.comment}</Text>}
                        <Text style={themed.reviewDate}>
                          {Number.isFinite(new Date(review.createdAt).getTime())
                            ? new Date(review.createdAt).toLocaleDateString('en-GB')
                            : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {activeCategory === 'account' && (
          <View style={themed.accountSectionCard}>
            <SectionHeader icon="settings-outline" label="ACCOUNT TYPE" />
            <Text style={themed.accountSectionTitle}>
              {isDealerStaff ? 'Dealer team member' : isDealerAccount ? 'Partner Account' : 'Personal Account'}
            </Text>
            <Text style={themed.accountSectionText}>
              Personal accounts let individuals buy and sell vehicles.
              Partner accounts manage verified trade and business services.
              Changing your dashboard view does not change your verified account permissions.
            </Text>
            {canManageBusiness ? (
              <TouchableOpacity style={themed.accountAction}
                accessibilityRole="button" accessibilityLabel="Review business verification"
                onPress={() => selectCategory('verification')}>
                <Text style={themed.accountActionText}>Review business verification</Text>
                <Ionicons name="chevron-forward" size={17} color={Colors.white} />
              </TouchableOpacity>
            ) : !isDealerStaff ? (
              <TouchableOpacity style={themed.accountAction}
                accessibilityRole="button" accessibilityLabel="Explore Partner Account"
                onPress={() => navigation.navigate('PartnerDashboard')}>
                <Text style={themed.accountActionText}>Explore Partner Account</Text>
                <Ionicons name="chevron-forward" size={17} color={Colors.white} />
              </TouchableOpacity>
            ) : (
              <Text style={themed.accountSectionText}>
                Business ownership, legal type and verification changes must be made by the dealership owner.
              </Text>
            )}
          </View>
        )}

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
        <View style={themed.verifyModalBody}>
          {deleteError ? (
            <View style={{ marginBottom: 16 }}>
              <ErrorBanner message={deleteError} />
            </View>
          ) : null}
          <Text style={themed.dangerCopy}>
            This is permanent and cannot be undone. Your active listings will be withdrawn and
            your personal details removed. Type DELETE below to confirm.
          </Text>
          <FieldLabel label="CONFIRMATION" />
          <TextInput
            style={themed.inputField}
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            placeholder="Type DELETE"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
          />
          <TouchableOpacity
            style={[themed.deleteConfirmBtn, (!canConfirmDelete || deleting) && { opacity: 0.4 }]
            }
            activeOpacity={0.8}
            onPress={handleDeleteAccount}
            disabled={!canConfirmDelete || deleting}
            accessibilityRole="button"
            accessibilityLabel="Permanently delete my account"
          >
            {deleting
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={themed.deleteConfirmBtnText}>DELETE MY ACCOUNT</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: 14 }}
            onPress={() => { if (!deleting) { setDeleteModalOpen(false); setDeleteError(null); } }}
            disabled={deleting}
          >
            <Text style={themed.resendLinkText}>Cancel</Text>
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
        <View style={themed.verifyModalBody}>
          {verifyError ? (
            <View style={{ marginBottom: 16 }}>
              <ErrorBanner message={verifyError} />
            </View>
          ) : null}
          {verifyStage === 'address' && (
            <View>
              <Text style={themed.verifyStepTitle}>Confirm Your Address</Text>
              <Text style={themed.verifyStepSub}>
                Enter your current residential address. We'll email a 6-digit verification code to {user?.email || 'your account email'}.
              </Text>
              <TextInput
                style={[themed.inputField, { height: 72, paddingTop: 12, textAlignVertical: 'top' }]}
                value={verifyAddressInput}
                onChangeText={setVerifyAddressInput}
                placeholder="Enter your full address"
                placeholderTextColor={palette.textMuted}
                autoCapitalize="words"
                multiline
              />
              <TouchableOpacity
                style={[themed.stripeBtn, { marginTop: 16 }, verifySending && { opacity: 0.6 }]}
                onPress={handleSendVerificationCode}
                disabled={verifySending}
              >
                {verifySending
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={themed.stripeBtnText}>SEND VERIFICATION CODE</Text>}
              </TouchableOpacity>
            </View>
          )}
          {verifyStage === 'code' && (
            <View>
              <Text style={themed.verifyStepTitle}>Enter Verification Code</Text>
              <Text style={themed.verifyStepSub}>
                We've emailed a 6-digit code to {user?.email || 'your account email'}. Enter it below to verify {verifyAddressInput.trim()}.
              </Text>
              <TextInput
                style={themed.inputField}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="Enter 6-digit code"
                placeholderTextColor={palette.textMuted}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                style={[themed.stripeBtn, { marginTop: 16 }, verifyConfirming && { opacity: 0.6 }]}
                onPress={handleConfirmVerificationCode}
                disabled={verifyConfirming}
              >
                {verifyConfirming
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={themed.stripeBtnText}>CONFIRM & VERIFY</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center', marginTop: 14 }} onPress={() => { setVerifyStage('address'); setVerifyError(null); }}>
                <Text style={themed.resendLinkText}>Wrong address? Go back</Text>
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
  settingsPageHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  settingsPageTitle: { fontFamily: FontFamily.extraBold, color: Colors.textPrimary,
    fontSize: 25, lineHeight: 32 },
  settingsPageSubtitle: { fontFamily: FontFamily.medium, color: Colors.textMuted,
    fontSize: 12, lineHeight: 18, marginTop: 3 },
  settingsBackLink: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 8,
    minHeight: 44, alignSelf: 'flex-start' },
  settingsBackText: { color: Colors.accent, fontFamily: FontFamily.bold, fontSize: 12 },
  accountToolsPanel: { borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgCard, borderRadius: 16, padding: 13, marginBottom: 11 },
  accountToolsHeading: { fontFamily: FontFamily.extraBold, color: Colors.textPrimary,
    fontSize: 12, letterSpacing: 0.7 },
  accountToolsSub: { fontFamily: FontFamily.regular, color: Colors.textMuted,
    fontSize: 11, lineHeight: 16, marginTop: 4, marginBottom: 10 },
  accountToolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fullWidthTool: { width: '100%', flexBasis: '100%' },
  fullWidthCategory: { flexBasis: '100%' },
  accountToolButton: { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center',
    gap: 8, minHeight: 48, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.borderSubtle },
  accountToolLabel: { color: Colors.textPrimary, fontFamily: FontFamily.bold,
    fontSize: 11, flex: 1 },
  accountSectionCard: { backgroundColor: Colors.bgCard, padding: 15, marginTop: 8,
    borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 15, gap: 10 },
  accountSectionTitle: { color: Colors.textPrimary, fontFamily: FontFamily.extraBold, fontSize: 15 },
  accountSectionText: { color: Colors.textSecondary, fontFamily: FontFamily.regular,
    fontSize: 12, lineHeight: 19 },
  accountErrorText: { color: Colors.warning, fontFamily: FontFamily.medium, fontSize: 12 },
  reviewSummary: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 5 },
  reviewScore: { fontFamily: FontFamily.extraBold, color: Colors.textPrimary, fontSize: 20 },
  reviewGroup: { gap: 10, marginTop: 11 },
  reviewRow: { padding: 11, gap: 5, backgroundColor: Colors.bgElevated, borderRadius: 10 },
  reviewRowHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  reviewName: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: 12, flex: 1 },
  reviewStars: { color: Colors.warning, fontFamily: FontFamily.bold, fontSize: 12 },
  reviewDate: { color: Colors.textMuted, fontFamily: FontFamily.medium, fontSize: 10 },
  accountAction: { backgroundColor: Colors.accent, borderRadius: 11, minHeight: 46,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 13 },
  accountActionText: { color: Colors.white, fontFamily: FontFamily.bold, fontSize: 12 },
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
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  categoryButton: { flexGrow: 1, flexBasis: '46%', minHeight: 56, flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: Colors.bgCardSolid, borderColor: Colors.borderHi, borderWidth: 1, borderRadius: Radius.inline, paddingHorizontal: 13, paddingVertical: 10 },
  categoryButtonSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  categoryLabel: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.xs, lineHeight: 18, color: Colors.textSecondary },
  categoryLabelSelected: { color: Colors.white },
  notificationShortcut: { flexDirection: 'row', alignItems: 'center', minHeight: 68, padding: 14, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.borderHi, backgroundColor: Colors.bgCardSolid, gap: 12, marginBottom: 6 },
  notificationShortcutIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: Colors.accentAlpha10 },
  notificationShortcutTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white, marginBottom: 3 },
  notificationShortcutHint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17 },
  preferenceNotice: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, lineHeight: 18, color: Colors.warning },

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

  // Mobile forms get a full-width field each, not two narrow desktop columns.
  fieldRow: { flexDirection: 'column', gap: 14 },
  fieldWrap: { flex: 1 },
  fieldDividerV: { display: 'none' },
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

function useSettingsThemeStyles() {
  const { palette } = useNativeAppearance();
  return React.useMemo(() => ({
    ...styles,
    container: [styles.container, { backgroundColor: palette.bgBody }],
    settingsPageTitle: [styles.settingsPageTitle, { color: palette.textPrimary }],
    settingsPageSubtitle: [styles.settingsPageSubtitle, { color: palette.textSecondary }],
    settingsBackText: [styles.settingsBackText, { color: palette.accent }],
    accountToolsPanel: [styles.accountToolsPanel, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    accountToolsHeading: [styles.accountToolsHeading, { color: palette.textPrimary }],
    accountToolsSub: [styles.accountToolsSub, { color: palette.textSecondary }],
    accountToolButton: [styles.accountToolButton, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    accountToolLabel: [styles.accountToolLabel, { color: palette.textPrimary }],
    accountSectionCard: [styles.accountSectionCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    accountSectionTitle: [styles.accountSectionTitle, { color: palette.textPrimary }],
    accountSectionText: [styles.accountSectionText, { color: palette.textSecondary }],
    accountErrorText: [styles.accountErrorText, { color: palette.textMuted }],
    reviewSummary: [styles.reviewSummary, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    reviewScore: [styles.reviewScore, { color: palette.textPrimary }],
    reviewGroup: [styles.reviewGroup, { backgroundColor: palette.bgCard }],
    reviewRow: [styles.reviewRow, { borderBottomColor: palette.borderDefault }],
    reviewName: [styles.reviewName, { color: palette.textPrimary }],
    reviewDate: [styles.reviewDate, { color: palette.textMuted }],
    accountAction: [styles.accountAction, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    accountActionText: [styles.accountActionText, { color: palette.textPrimary }],
    dangerCard: [styles.dangerCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    dangerCopy: [styles.dangerCopy, { color: palette.textSecondary }],
    header: [styles.header, { backgroundColor: palette.bgHeader, borderBottomColor: palette.borderDefault }],
    backBtn: [styles.backBtn, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    title: [styles.title, { color: palette.textPrimary }],
    categoryButton: [styles.categoryButton, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    categoryLabel: [styles.categoryLabel, { color: palette.textSecondary }],
    notificationShortcut: [styles.notificationShortcut, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    notificationShortcutTitle: [styles.notificationShortcutTitle, { color: palette.textPrimary }],
    notificationShortcutHint: [styles.notificationShortcutHint, { color: palette.textSecondary }],
    preferenceNotice: [styles.preferenceNotice, { color: palette.textMuted }],
    inviteRow: [styles.inviteRow, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    inviteRowText: [styles.inviteRowText, { color: palette.textPrimary }],
    sectionHeader: [styles.sectionHeader, { borderBottomColor: palette.borderDefault }],
    sectionIconWrap: [styles.sectionIconWrap, { backgroundColor: palette.bgInput }],
    sectionLabel: [styles.sectionLabel, { color: palette.textPrimary }],
    card: [styles.card, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    cardDivider: [styles.cardDivider, { backgroundColor: palette.borderDefault }],
    fieldLabel: [styles.fieldLabel, { color: palette.textSecondary }],
    fieldErrorText: [styles.fieldErrorText, { color: palette.textMuted }],
    fieldWrap: [styles.fieldWrap, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    fieldValueReadonly: [styles.fieldValueReadonly, { color: palette.textSecondary }],
    fieldInput: [styles.fieldInput, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault, color: palette.textPrimary }],
    avatarChangeText: [styles.avatarChangeText, { color: palette.textPrimary }],
    avatarHintText: [styles.avatarHintText, { color: palette.textMuted }],
    toggleTitle: [styles.toggleTitle, { color: palette.textPrimary }],
    pwdInputWrap: [styles.pwdInputWrap, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    pwdInput: [styles.pwdInput, { color: palette.textPrimary }],
    payoutDesc: [styles.payoutDesc, { color: palette.textSecondary }],
    stripeConnected: [styles.stripeConnected, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    stripeConnectedText: [styles.stripeConnectedText, { color: palette.textPrimary }],
    stripeWarning: [styles.stripeWarning, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    stripeWarningText: [styles.stripeWarningText, { color: palette.textSecondary }],
    stripeNote: [styles.stripeNote, { color: palette.textMuted }],
    inputField: [styles.inputField, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault, color: palette.textPrimary }],
    verifyModalBody: [styles.verifyModalBody, { backgroundColor: palette.bgDropdown }],
    verifyStepTitle: [styles.verifyStepTitle, { color: palette.textPrimary }],
    verifyStepSub: [styles.verifyStepSub, { color: palette.textSecondary }],
    resendLinkText: [styles.resendLinkText, { color: palette.accent }],
  }), [palette]);
}
