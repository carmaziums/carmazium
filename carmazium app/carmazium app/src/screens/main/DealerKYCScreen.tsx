import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { apiClient } from '../../lib/apiClient';
import { convertAndCompress, uploadToStorage } from '../../lib/storageHelper';
import { useAuthStore } from '../../store/authStore';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { haptics } from '../../lib/haptics';
import { StripeCheckoutModal } from '../../components/StripeCheckoutModal';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
// ─── Inline form-field helper ────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  optional?: boolean;
  keyboardType?: 'default' | 'url' | 'email-address' | 'numeric';
  multiline?: boolean;
  error?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  optional = false,
  keyboardType = 'default',
  multiline = false,
  error,
}) => (
  <View style={formFieldStyles.wrap}>
    <Text style={formFieldStyles.label}>
      {label.toUpperCase()}
      {optional ? ' (OPTIONAL)' : ' *'}
    </Text>
    <TextInput
      style={[
        formFieldStyles.input,
        multiline ? formFieldStyles.inputMultiline : formFieldStyles.inputSingleLine,
        error ? { borderColor: Colors.error } : null,
      ]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      keyboardType={keyboardType}
      multiline={multiline}
      autoCapitalize="none"
    />
    {error ? <Text style={formFieldStyles.errorText}>{error}</Text> : null}
  </View>
);

const formFieldStyles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: Colors.white,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
  },
  inputSingleLine: {
    paddingVertical: 0,
    height: 52,
    textAlignVertical: 'center',
  },
  inputMultiline: {
    paddingVertical: 12,
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.error,
    marginTop: 6,
  },
});

// ─── Section eyebrow label ────────────────────────────────────────────────────

const SectionLabel: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionEyebrow}>{title}</Text>
);

// ─── Pending state view ───────────────────────────────────────────────────────

const PendingView: React.FC = () => (
  <View style={styles.pendingContainer}>
    <View style={styles.pendingIconCircle}>
      <Ionicons name="shield-outline" size={36} color={Colors.warning} />
    </View>
    <Text style={styles.pendingHeading}>Verification in progress</Text>
    <Text style={styles.pendingBody}>
      Your documents are under review. We'll notify you once verified.
    </Text>
    <View style={styles.pendingInfoRow}>
      <Ionicons name="time-outline" size={14} color={Colors.warning} />
      <Text style={styles.pendingInfoText}>Typically reviewed within 2–3 business days</Text>
    </View>
  </View>
);

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const KycSkeleton: React.FC = () => (
  <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
    {/* status + info card area */}
    <View style={{ marginBottom: 20, height: 60, borderRadius: 14, backgroundColor: Colors.bgTertiary, opacity: 0.5 }} />
    <View style={{ marginBottom: 28, height: 80, borderRadius: 14, backgroundColor: Colors.bgTertiary, opacity: 0.5 }} />
    {/* section label */}
    <View style={{ width: '40%', height: 12, borderRadius: 6, backgroundColor: Colors.bgTertiary, opacity: 0.5, marginBottom: 16 }} />
    {/* fields */}
    {[52, 52, 52, 80].map((h, i) => (
      <View key={i} style={{ marginBottom: 16, height: h, borderRadius: 12, backgroundColor: Colors.bgTertiary, opacity: 0.5 }} />
    ))}
    {/* section label */}
    <View style={{ width: '40%', height: 12, borderRadius: 6, backgroundColor: Colors.bgTertiary, opacity: 0.5, marginBottom: 16 }} />
    {[52, 52].map((h, i) => (
      <View key={i} style={{ marginBottom: 16, height: h, borderRadius: 12, backgroundColor: Colors.bgTertiary, opacity: 0.5 }} />
    ))}
  </View>
);

// ─── Main screen ─────────────────────────────────────────────────────────────

export const DealerKYCScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.user?.id) ?? 'anon';

  const [existingKyc, setExistingKyc] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── £1 Verification Fee state (paid via hosted Stripe Checkout — see
  // web's KycOverlayForm.tsx, the source-of-truth reference for this flow).
  // Note: the old manual-bank-transfer `paymentReference`/`paymentScreenshot`
  // fields are retired on web (confirmed: zero references in KycOverlayForm.tsx)
  // and are removed here too — they predate the Stripe checkout flow.
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [kycCheckoutUrl, setKycCheckoutUrl] = useState<string | null>(null);

  // ── Document upload state ───────────────────────────────────────────────────
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [docUploading, setDocUploading] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    companyHouseName: '',
    representativeName: '',
    representativePosition: '',
    vatNumber: '',
    companyRegistrationNumber: '',
    personOfSignificantControl: '',
    directorName: '',
    businessWebsite: '',
    businessRegisteredAddress: '',
    tradingAddress: '',
    googleReviewsLink: '',
  });

  // ── Load existing KYC on mount ──────────────────────────────────────────────
  useEffect(() => {
    apiClient<{ success: boolean; data: any }>('/dealers/kyc')
      .then((res) => {
        if (res.success && res.data) {
          setExistingKyc(res.data);
          const k = res.data;
          setForm({
            companyHouseName: k.companyHouseName || '',
            representativeName: k.representativeName || '',
            representativePosition: k.representativePosition || '',
            vatNumber: k.vatNumber || '',
            companyRegistrationNumber: k.companyRegistrationNumber || '',
            personOfSignificantControl: k.personOfSignificantControl || '',
            directorName: k.directorName || '',
            businessWebsite: k.businessWebsite || '',
            businessRegisteredAddress: k.businessRegisteredAddress || '',
            tradingAddress: k.tradingAddress || '',
            googleReviewsLink: k.googleReviewsLink || '',
          });
          // Populate already-paid state if the dealer has previously cleared the £1 fee.
          if (k.stripeChargedAt) {
            setAlreadyPaid(true);
            setPaidAt(k.stripeChargedAt);
          }
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  // ── Form field updater ──────────────────────────────────────────────────────
  const setField = (key: keyof typeof form) => (val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  // ── Document capture + upload handler ──────────────────────────────────────
  const handleDocumentCapture = async (fieldName: string, type: 'image' | 'pdf') => {
    setDocUploading((prev) => ({ ...prev, [fieldName]: true }));
    try {
      let localUri: string;
      let mimeType = 'image/jpeg';

      if (type === 'image') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images' as any,
          allowsEditing: false,
          quality: 1.0,
        });
        if (result.canceled) return;
        localUri = result.assets[0].uri;
        localUri = await convertAndCompress(localUri);
        mimeType = 'image/jpeg';
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true, // REQUIRED for iOS FileSystem access
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        localUri = asset.uri;
        mimeType = asset.mimeType ?? 'application/pdf';
        // If user picks an image via the document picker, compress it too
        if (mimeType.startsWith('image/')) {
          localUri = await convertAndCompress(localUri);
          mimeType = 'image/jpeg';
        }
      }

      const ext = mimeType === 'application/pdf' ? 'pdf' : 'jpg';
      const path = `kyc/${userId}/${fieldName}-${Date.now()}.${ext}`;
      // Bucket is 'listings' (the only bucket this exists in) with a 'kyc/'
      // path prefix, matching web's KycOverlayForm.tsx
      // (uploadImage(file, "listings", "kyc")) — 'kyc-documents' was never
      // a real bucket, same class of bug as the handover-proof upload
      // (mobile-production-readiness-plan.md F32).
      const url = await uploadToStorage(localUri, 'listings', path, mimeType);
      setDocUrls((prev) => ({ ...prev, [fieldName]: url }));
      haptics.medium();
    } catch (err: any) {
      Alert.alert('Upload failed', err.message ?? 'Could not upload document');
    } finally {
      setDocUploading((prev) => ({ ...prev, [fieldName]: false }));
    }
  };

  // ── Submit handler ──────────────────────────────────────────────────────────
  // Mirrors web's KycOverlayForm.tsx handleSubmit: save form fields, then — unless
  // the £1 fee was already cleared in a previous cycle — kick off the Stripe
  // checkout redirect. Nothing here is considered "submitted" from the dealer's
  // point of view until stripeChargedAt is set (see the isPending gate below).
  const handleSubmit = async () => {
    const required: (keyof typeof form)[] = [
      'companyHouseName',
      'representativeName',
      'representativePosition',
      'vatNumber',
      'companyRegistrationNumber',
      'personOfSignificantControl',
      'directorName',
      'businessWebsite',
      'businessRegisteredAddress',
    ];

    const missing = required.filter((k) => !form[k]?.trim());
    if (missing.length > 0) {
      setFieldErrors(Object.fromEntries(missing.map((k) => [k, 'This field is required'])));
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: any = { ...form, ...docUrls };
      if (!payload.tradingAddress) delete payload.tradingAddress;
      if (!payload.googleReviewsLink) delete payload.googleReviewsLink;

      const res = await apiClient<{ success: boolean; data: any }>('/dealers/kyc', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.success) {
        setSubmitting(false);
        return;
      }
      setExistingKyc(res.data ?? { status: 'PENDING' });

      if (alreadyPaid) {
        // Fee was already cleared in a previous cycle — this submission is just an
        // edit/resubmit, no Stripe redirect needed.
        haptics.success();
        setSubmitting(false);
        return;
      }

      setCheckoutLoading(true);
      const checkout = await apiClient<{ success: boolean; data: { url?: string; alreadyPaid: boolean; chargedAt?: string } }>(
        '/dealers/kyc/checkout',
        { method: 'POST' },
      );

      if (checkout.data?.alreadyPaid) {
        setAlreadyPaid(true);
        setPaidAt(checkout.data.chargedAt ?? null);
        haptics.success();
        setCheckoutLoading(false);
        setSubmitting(false);
        return;
      }

      if (checkout.data?.url) {
        setKycCheckoutUrl(checkout.data.url);
        // Leave submitting/checkoutLoading true — the WebView modal takes over
        // and handleKycCheckoutSuccess/Cancel below will reset them.
        return;
      }

      setSubmitError('Failed to start the verification fee payment. Please try again.');
      setCheckoutLoading(false);
      setSubmitting(false);
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed. Please try again.');
      setCheckoutLoading(false);
      setSubmitting(false);
    }
  };

  // Called when the WebView reaches /checkout/success. The webhook lands slightly
  // after the redirect, so retry the KYC re-fetch a few times (same pattern as
  // VehicleDetailScreen's HPI checkout success handler).
  const handleKycCheckoutSuccess = async () => {
    setKycCheckoutUrl(null);
    haptics.success();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await apiClient<{ success: boolean; data: any }>('/dealers/kyc');
        if (res.success && res.data?.stripeChargedAt) {
          setExistingKyc(res.data);
          setAlreadyPaid(true);
          setPaidAt(res.data.stripeChargedAt);
          break;
        }
      } catch { /* not ready yet — retry */ }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setCheckoutLoading(false);
    setSubmitting(false);
  };

  const handleKycCheckoutCancel = () => {
    setKycCheckoutUrl(null);
    setCheckoutLoading(false);
    setSubmitting(false);
    // The KYC record now exists (saved before the redirect) but is unpaid —
    // the dealer can retap the submit button to retry the Stripe checkout
    // without re-entering any fields (createKycCheckoutSession is idempotent).
  };

  // Re-triggers the £1 Stripe checkout for a PENDING-but-unpaid application
  // without touching the saved form fields — used by the "Payment Outstanding"
  // state below. Mirrors web's KycOverlayForm.tsx handleResumePayment.
  const handleResumePayment = async () => {
    setSubmitError(null);
    setCheckoutLoading(true);
    try {
      const checkout = await apiClient<{ success: boolean; data: { url?: string; alreadyPaid: boolean; chargedAt?: string } }>(
        '/dealers/kyc/checkout',
        { method: 'POST' },
      );
      if (checkout.data?.alreadyPaid) {
        setAlreadyPaid(true);
        setPaidAt(checkout.data.chargedAt ?? null);
        setExistingKyc((prev: any) => (prev ? { ...prev, stripeChargedAt: checkout.data.chargedAt ?? new Date().toISOString() } : prev));
        haptics.success();
        setCheckoutLoading(false);
        return;
      }
      if (checkout.data?.url) {
        setKycCheckoutUrl(checkout.data.url);
        return; // WebView modal takes over; handleKycCheckoutSuccess/Cancel resets checkoutLoading
      }
      setSubmitError('Failed to start the payment. Please try again.');
      setCheckoutLoading(false);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to start the payment. Please try again.');
      setCheckoutLoading(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={[Colors.accentAlpha03, 'rgba(0,0,0,0)', Colors.bgPrimary]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.5 }}
        />
        <View style={{ height: insets.top }} />
        <View style={styles.header}>
          <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
          <Text style={styles.headerTitle}>Business Verification</Text>
          <HamburgerButton />
        </View>
        <KycSkeleton />
      </View>
    );
  }

  const kycStatus: string | null = existingKyc?.status ?? null;
  const isApproved = kycStatus === 'APPROVED';
  // Requires stripeChargedAt too — a PENDING record with fields saved but the £1 fee
  // unpaid (e.g. the dealer backgrounded the app or cancelled the Stripe checkout)
  // must fall through to the form below so they can retry payment, not get stuck
  // behind this hard "Under Review" gate with no way to pay. Mirrors web's
  // KycOverlayForm.tsx identical gate.
  const isPending = (kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW') && !!existingKyc?.stripeChargedAt;
  // Distinct from isPending above: fields were saved on a previous visit but the
  // dealer never completed (or cancelled, or was declined on) the £1 Stripe
  // checkout. Must not look like a fresh, unstarted application — it's one tap
  // away from being submitted. Mirrors web's KycOverlayForm.tsx identical gate.
  const isPaymentOutstanding = kycStatus === 'PENDING' && !existingKyc?.stripeChargedAt;

  // ── Status banner config ────────────────────────────────────────────────────
  const getBannerConfig = () => {
    if (!kycStatus) return null;
    if (isPending)
      return {
        bg: Colors.warningAlpha12,
        border: Colors.warningAlpha25,
        text: Colors.warning,
        icon: 'time-outline' as const,
        message: 'Under Review — Your application is being reviewed by our team.',
      };
    if (kycStatus === 'APPROVED')
      return {
        bg: Colors.successAlpha12,
        border: Colors.successAlpha25,
        text: Colors.success,
        icon: 'checkmark-circle-outline' as const,
        message: 'Verified — Your dealership is fully verified.',
      };
    if (kycStatus === 'REJECTED')
      return {
        bg: 'rgba(239,68,68,0.12)',
        border: Colors.errorAlpha25,
        text: Colors.error,
        icon: 'close-circle-outline' as const,
        message: 'Rejected — Please review and resubmit your documents.',
      };
    return null;
  };

  const bannerConfig = getBannerConfig();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient */}
      <LinearGradient
        colors={[Colors.accentAlpha03, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      {/* Status bar spacer */}
      <View style={{ height: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />

        <Text style={styles.headerTitle}>Business Verification</Text>

        <HamburgerButton />
      </View>

      {/* PAYMENT OUTSTANDING STATE — details saved, £1 fee never cleared */}
      {isPaymentOutstanding ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { flexGrow: 1, justifyContent: 'center' }]}
        >
          <View style={styles.paymentOutstandingContainer}>
            <View style={styles.paymentOutstandingIconCircle}>
              <Ionicons name="lock-closed-outline" size={36} color={Colors.accent} />
            </View>
            <Text style={styles.pendingHeading}>Almost there — payment needed</Text>
            <Text style={styles.pendingBody}>
              Your details are saved — just complete the £1 verification payment. It looks like
              your last attempt didn't go through (card declined, or the checkout page was closed
              before it finished). No need to re-enter anything.
            </Text>

            {submitError ? (
              <View style={{ width: '100%', marginTop: 4, marginBottom: 8 }}>
                <ErrorBanner message={submitError} />
              </View>
            ) : null}

            <PrimaryCTA
              label={checkoutLoading ? 'REDIRECTING TO PAYMENT...' : 'COMPLETE PAYMENT (£1)'}
              onPress={handleResumePayment}
              isLoading={checkoutLoading}
              disabled={checkoutLoading}
              style={{ width: '100%', marginTop: 20 }}
            />
          </View>
        </ScrollView>
      ) : isPending ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Status banner */}
          {bannerConfig && (
            <View
              style={[
                styles.statusBanner,
                { backgroundColor: bannerConfig.bg, borderColor: bannerConfig.border },
              ]}
            >
              <Ionicons
                name={bannerConfig.icon}
                size={18}
                color={bannerConfig.text}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.statusBannerText, { color: bannerConfig.text }]}>
                {bannerConfig.message}
              </Text>
            </View>
          )}
          <PendingView />
          <View style={{ height: 60 }} />
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* STATUS BANNER (approved / rejected) */}
            {bannerConfig && (
              <View
                style={[
                  styles.statusBanner,
                  { backgroundColor: bannerConfig.bg, borderColor: bannerConfig.border },
                ]}
              >
                <Ionicons
                  name={bannerConfig.icon}
                  size={18}
                  color={bannerConfig.text}
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.statusBannerText, { color: bannerConfig.text }]}>
                  {bannerConfig.message}
                </Text>
              </View>
            )}

            {/* INFO CARD */}
            <View style={styles.infoCard}>
              <LinearGradient
                colors={[Colors.infoBlueAlpha08, 'rgba(59,130,246,0.02)']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.infoCardHeader}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="shield-outline" size={20} color={Colors.infoBlue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoCardTitle}>Business KYC Verification</Text>
                  <Text style={styles.infoCardDesc}>
                    Complete this form to get your dealership verified. Approval unlocks full
                    platform features.
                  </Text>
                  <Text style={styles.infoCardAmber}>
                    A £1 card payment is required to confirm your application.
                  </Text>
                </View>
              </View>
            </View>

            {/* ── SECTION 1: COMPANY DETAILS ──────────────────────────────── */}
            <SectionLabel title="COMPANY DETAILS" />

            <FormField
              label="Company House Name"
              value={form.companyHouseName}
              onChange={setField('companyHouseName')}
              placeholder="e.g. Knightsbridge Motors Ltd"
              error={fieldErrors.companyHouseName}
            />
            <FormField
              label="Registration Number"
              value={form.companyRegistrationNumber}
              onChange={setField('companyRegistrationNumber')}
              placeholder="e.g. 12345678"
              error={fieldErrors.companyRegistrationNumber}
            />
            <FormField
              label="VAT Number"
              value={form.vatNumber}
              onChange={setField('vatNumber')}
              placeholder="e.g. GB123456789"
              error={fieldErrors.vatNumber}
            />
            <FormField
              label="Registered Address"
              value={form.businessRegisteredAddress}
              onChange={setField('businessRegisteredAddress')}
              placeholder="Full registered address"
              multiline
              error={fieldErrors.businessRegisteredAddress}
            />
            <FormField
              label="Trading Address"
              value={form.tradingAddress}
              onChange={setField('tradingAddress')}
              placeholder="If different from registered"
              optional
              multiline
            />
            <FormField
              label="Website"
              value={form.businessWebsite}
              onChange={setField('businessWebsite')}
              placeholder="https://yoursite.co.uk"
              keyboardType="url"
              error={fieldErrors.businessWebsite}
            />
            <FormField
              label="Google Reviews Link"
              value={form.googleReviewsLink}
              onChange={setField('googleReviewsLink')}
              placeholder="https://g.page/..."
              optional
              keyboardType="url"
            />

            {/* ── SECTION 2: REPRESENTATIVE ───────────────────────────────── */}
            <SectionLabel title="REPRESENTATIVE" />

            <FormField
              label="Full Name"
              value={form.representativeName}
              onChange={setField('representativeName')}
              placeholder="e.g. James Wilson"
              error={fieldErrors.representativeName}
            />
            <FormField
              label="Job Title"
              value={form.representativePosition}
              onChange={setField('representativePosition')}
              placeholder="e.g. Managing Director"
              error={fieldErrors.representativePosition}
            />
            <FormField
              label="Person of Significant Control"
              value={form.personOfSignificantControl}
              onChange={setField('personOfSignificantControl')}
              placeholder="Full name of PSC"
              error={fieldErrors.personOfSignificantControl}
            />

            {/* ── SECTION 3: DIRECTOR ─────────────────────────────────────── */}
            <SectionLabel title="DIRECTOR" />

            <FormField
              label="Director Name"
              value={form.directorName}
              onChange={setField('directorName')}
              placeholder="e.g. James Wilson"
              error={fieldErrors.directorName}
            />

            {/* ── SECTION 4: DOCUMENT UPLOADS ─────────────────────────────── */}
            <SectionLabel title="DOCUMENT UPLOADS" />

            {/* Document upload helper */}
            {([
              { field: 'vatProof', label: 'VAT Certificate', type: 'pdf' as const },
              { field: 'companyRegistrationProof', label: 'Company Registration Certificate', type: 'pdf' as const },
              { field: 'directorIdProof', label: 'Director ID / Passport Photo', type: 'image' as const },
            ] as const).map(({ field, label, type }) => (
              <View key={field} style={styles.docField}>
                <Text style={styles.docFieldLabel}>{label.toUpperCase()}</Text>
                {docUploading[field] ? (
                  <View style={styles.docUploadingRow}>
                    <ActivityIndicator color={Colors.accent} size="small" />
                    <Text style={styles.docUploadingText}>Uploading…</Text>
                  </View>
                ) : docUrls[field] ? (
                  <View style={styles.docUploadedRow}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                    <Text style={styles.docUploadedText} numberOfLines={1}>Uploaded</Text>
                    <TouchableOpacity
                      onPress={() => handleDocumentCapture(field, type)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.docReplaceLink}>Replace</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.docTapArea}
                    onPress={() => handleDocumentCapture(field, type)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={type === 'pdf' ? 'document-outline' : 'camera-outline'}
                      size={16}
                      color={Colors.textMuted}
                    />
                    <Text style={styles.docTapText}>
                      Tap to upload {type === 'pdf' ? 'PDF or image' : 'photo'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* ── SECTION 5: VERIFICATION FEE ─────────────────────────────── */}
            <SectionLabel title="VERIFICATION FEE" />

            {alreadyPaid ? (
              <View style={[styles.paymentInfoBox, styles.paymentInfoBoxPaid]}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={Colors.success}
                  style={{ marginRight: 10, marginTop: 1, flexShrink: 0 }}
                />
                <Text style={[styles.paymentInfoText, { color: Colors.success }]}>
                  Verification fee paid
                  {paidAt
                    ? ` on ${new Date(paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : ''}
                  . No further payment needed.
                </Text>
              </View>
            ) : (
              <View style={styles.paymentInfoBox}>
                <Ionicons name="information-circle-outline"
                  size={16}
                  color={Colors.warning}
                  style={{ marginRight: 10, marginTop: 1, flexShrink: 0 }}
                accessibilityElementsHidden importantForAccessibility="no" />
                <Text style={styles.paymentInfoText}>
                  A non-refundable £1.00 card payment is required to confirm your application — charged once per dealer account via secure Stripe checkout after you submit below.
                </Text>
              </View>
            )}

            {/* ── INLINE ERROR BANNER ──────────────────────────────────────── */}
            {submitError && (
              <View style={{ marginBottom: 16 }}>
                <ErrorBanner
                  message={submitError}
                  onRetry={() => {
                    setSubmitError(null);
                    handleSubmit();
                  }}
                />
              </View>
            )}

            {/* ── SUBMIT ──────────────────────────────────────────────────── */}
            <View style={styles.submitWrapper}>
              {isApproved ? (
                <PrimaryCTA
                  label="APPLICATION APPROVED"
                  onPress={() => {}}
                  disabled
                  style={{ backgroundColor: Colors.success }}
                />
              ) : (
                <PrimaryCTA
                  label={
                    checkoutLoading
                      ? 'REDIRECTING TO PAYMENT...'
                      : alreadyPaid
                        ? 'SAVE CHANGES'
                        : 'SUBMIT & PAY £1 FEE'
                  }
                  onPress={handleSubmit}
                  isLoading={submitting}
                  disabled={
                    submitting ||
                    !form.companyHouseName.trim() ||
                    !form.representativeName.trim() ||
                    !form.vatNumber.trim()
                  }
                />
              )}
            </View>

            {/* Bottom spacer for tab bar */}
            <View style={{ height: 110 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* £1 VERIFICATION FEE CHECKOUT MODAL — hosted Stripe checkout, same
          WebView pattern as the HPI report checkout on VehicleDetailScreen. */}
      <StripeCheckoutModal
        url={kycCheckoutUrl}
        title="Verification Fee"
        onSuccess={handleKycCheckoutSuccess}
        onCancel={handleKycCheckoutCancel}
        onClose={handleKycCheckoutCancel}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
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
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
    letterSpacing: -0.3,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  statusBannerText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  // Info card
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.infoBlueAlpha20,
    backgroundColor: Colors.bgSecondary,
    padding: 16,
    marginBottom: 28,
    overflow: 'hidden',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.infoBlueAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
    marginBottom: 4,
  },
  infoCardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  infoCardAmber: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.warning,
    marginTop: 6,
    lineHeight: 16,
  },

  // Section eyebrow
  sectionEyebrow: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 1.8,
    marginBottom: 16,
    marginTop: 8,
  },

  // Payment info
  paymentInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.warningAlpha06,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.warningAlpha15,
    padding: 14,
    marginBottom: 16,
  },
  paymentInfoBoxPaid: {
    backgroundColor: Colors.successAlpha06,
    borderColor: Colors.successAlpha15,
  },
  paymentInfoText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    lineHeight: 19,
  },

  // Submit
  submitWrapper: {
    marginTop: 8,
  },

  // Document upload fields
  docField: {
    marginBottom: 16,
  },
  docFieldLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  docTapArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderStyle: 'dashed',
  },
  docTapText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.textMuted,
  },
  docUploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  docUploadingText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.textSecondary,
  },
  docUploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.successAlpha06,
    borderWidth: 1,
    borderColor: Colors.successAlpha20,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  docUploadedText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size14,
    color: Colors.success,
    flex: 1,
  },
  docReplaceLink: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },

  // Pending view
  pendingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  paymentOutstandingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  paymentOutstandingIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.accentAlpha10,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pendingIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.warningAlpha10,
    borderWidth: 1,
    borderColor: Colors.warningAlpha25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pendingHeading: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size22,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  pendingBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  pendingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningAlpha06,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.warningAlpha15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pendingInfoText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.warning,
  },
});
