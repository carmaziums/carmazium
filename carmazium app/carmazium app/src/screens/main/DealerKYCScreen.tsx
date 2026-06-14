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
import { apiClient } from '../../lib/apiClient';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { haptics } from '../../lib/haptics';

// ─── Inline form-field helper ────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  optional?: boolean;
  keyboardType?: 'default' | 'url' | 'email-address' | 'numeric';
  multiline?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  optional = false,
  keyboardType = 'default',
  multiline = false,
}) => (
  <View style={{ marginBottom: 16 }}>
    <Text
      style={{
        fontFamily: FontFamily.bold,
        fontSize: 9,
        color: '#A0A0AB',
        letterSpacing: 1,
        marginBottom: 6,
      }}
    >
      {label.toUpperCase()}
      {optional ? ' (OPTIONAL)' : ' *'}
    </Text>
    <TextInput
      style={{
        backgroundColor: '#111115',
        borderWidth: 1,
        borderColor: '#2A2A32',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: multiline ? 12 : 0,
        height: multiline ? 80 : 52,
        color: '#FFFFFF',
        fontFamily: FontFamily.regular,
        fontSize: 15,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#5C5C6B"
      keyboardType={keyboardType}
      multiline={multiline}
      autoCapitalize="none"
    />
  </View>
);

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
    <View style={{ marginBottom: 20, height: 60, borderRadius: 14, backgroundColor: '#18181E', opacity: 0.5 }} />
    <View style={{ marginBottom: 28, height: 80, borderRadius: 14, backgroundColor: '#18181E', opacity: 0.5 }} />
    {/* section label */}
    <View style={{ width: '40%', height: 12, borderRadius: 6, backgroundColor: '#18181E', opacity: 0.5, marginBottom: 16 }} />
    {/* fields */}
    {[52, 52, 52, 80].map((h, i) => (
      <View key={i} style={{ marginBottom: 16, height: h, borderRadius: 12, backgroundColor: '#18181E', opacity: 0.5 }} />
    ))}
    {/* section label */}
    <View style={{ width: '40%', height: 12, borderRadius: 6, backgroundColor: '#18181E', opacity: 0.5, marginBottom: 16 }} />
    {[52, 52].map((h, i) => (
      <View key={i} style={{ marginBottom: 16, height: h, borderRadius: 12, backgroundColor: '#18181E', opacity: 0.5 }} />
    ))}
  </View>
);

// ─── Main screen ─────────────────────────────────────────────────────────────

export const DealerKYCScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [existingKyc, setExistingKyc] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    paymentReference: '',
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
            paymentReference: k.paymentReference || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  // ── Form field updater ──────────────────────────────────────────────────────
  const setField = (key: keyof typeof form) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  // ── Submit handler ──────────────────────────────────────────────────────────
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
      'paymentReference',
    ];

    const missing = required.filter((k) => !form[k]?.trim());
    if (missing.length > 0) {
      Alert.alert('Missing Fields', 'Please fill in all required fields before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: any = { ...form };
      if (!payload.tradingAddress) delete payload.tradingAddress;
      if (!payload.googleReviewsLink) delete payload.googleReviewsLink;

      const res = await apiClient<{ success: boolean; data: any }>('/dealers/kyc', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        haptics.success();
        setExistingKyc(res.data ?? { status: 'PENDING' });
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={['rgba(220,31,38,0.03)', 'rgba(0,0,0,0)', '#0A0A0C']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.5 }}
        />
        <View style={{ height: insets.top }} />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation?.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Business Verification</Text>
          <View style={{ width: 38 }} />
        </View>
        <KycSkeleton />
      </View>
    );
  }

  const kycStatus: string | null = existingKyc?.status ?? null;
  const isApproved = kycStatus === 'APPROVED';
  const isPending = kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW';

  // ── Status banner config ────────────────────────────────────────────────────
  const getBannerConfig = () => {
    if (!kycStatus) return null;
    if (isPending)
      return {
        bg: 'rgba(245,158,11,0.12)',
        border: 'rgba(245,158,11,0.25)',
        text: '#F59E0B',
        icon: 'time-outline' as const,
        message: 'Under Review — Your application is being reviewed by our team.',
      };
    if (kycStatus === 'APPROVED')
      return {
        bg: 'rgba(34,197,94,0.12)',
        border: 'rgba(34,197,94,0.25)',
        text: '#22C55E',
        icon: 'checkmark-circle-outline' as const,
        message: 'Verified — Your dealership is fully verified.',
      };
    if (kycStatus === 'REJECTED')
      return {
        bg: 'rgba(239,68,68,0.12)',
        border: 'rgba(239,68,68,0.25)',
        text: '#EF4444',
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
        colors={['rgba(220,31,38,0.03)', 'rgba(0,0,0,0)', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      {/* Status bar spacer */}
      <View style={{ height: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Business Verification</Text>

        <View style={{ width: 38 }} />
      </View>

      {/* PENDING STATE — replaces the form when under review */}
      {isPending ? (
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                colors={['rgba(59,130,246,0.08)', 'rgba(59,130,246,0.02)']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.infoCardHeader}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="shield-outline" size={20} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoCardTitle}>Business KYC Verification</Text>
                  <Text style={styles.infoCardDesc}>
                    Complete this form to get your dealership verified. Approval unlocks full
                    platform features.
                  </Text>
                  <Text style={styles.infoCardAmber}>
                    £1 bank transfer is required to confirm your banking details.
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
            />
            <FormField
              label="Registration Number"
              value={form.companyRegistrationNumber}
              onChange={setField('companyRegistrationNumber')}
              placeholder="e.g. 12345678"
            />
            <FormField
              label="VAT Number"
              value={form.vatNumber}
              onChange={setField('vatNumber')}
              placeholder="e.g. GB123456789"
            />
            <FormField
              label="Registered Address"
              value={form.businessRegisteredAddress}
              onChange={setField('businessRegisteredAddress')}
              placeholder="Full registered address"
              multiline
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
            />
            <FormField
              label="Job Title"
              value={form.representativePosition}
              onChange={setField('representativePosition')}
              placeholder="e.g. Managing Director"
            />
            <FormField
              label="Person of Significant Control"
              value={form.personOfSignificantControl}
              onChange={setField('personOfSignificantControl')}
              placeholder="Full name of PSC"
            />

            {/* ── SECTION 3: DIRECTOR ─────────────────────────────────────── */}
            <SectionLabel title="DIRECTOR" />

            <FormField
              label="Director Name"
              value={form.directorName}
              onChange={setField('directorName')}
              placeholder="e.g. James Wilson"
            />

            {/* ── SECTION 4: PAYMENT VERIFICATION ────────────────────────── */}
            <SectionLabel title="PAYMENT VERIFICATION" />

            <View style={styles.paymentInfoBox}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#F59E0B"
                style={{ marginRight: 10, marginTop: 1, flexShrink: 0 }}
              />
              <Text style={styles.paymentInfoText}>
                Make a £1 bank transfer to{' '}
                <Text style={{ color: '#FFFFFF', fontFamily: FontFamily.bold }}>
                  CARMAZIUM TRADING LTD
                </Text>
                {', Sort: 20-34-56, Acc: 12345678, using your company name as reference. Then enter the reference below.'}
              </Text>
            </View>

            <FormField
              label="Payment Reference"
              value={form.paymentReference}
              onChange={setField('paymentReference')}
              placeholder="Your company name as used in transfer"
            />

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
                  style={{ backgroundColor: '#22C55E' }}
                />
              ) : (
                <PrimaryCTA
                  label="SUBMIT APPLICATION"
                  onPress={handleSubmit}
                  isLoading={submitting}
                  disabled={
                    submitting ||
                    !form.companyHouseName.trim() ||
                    !form.representativeName.trim() ||
                    !form.vatNumber.trim() ||
                    !form.paymentReference.trim()
                  }
                />
              )}
            </View>

            {/* Bottom spacer for tab bar */}
            <View style={{ height: 110 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
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
    fontSize: 13,
    lineHeight: 20,
  },

  // Info card
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    backgroundColor: '#111115',
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
    backgroundColor: 'rgba(59,130,246,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  infoCardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#A0A0AB',
    lineHeight: 18,
  },
  infoCardAmber: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 6,
    lineHeight: 16,
  },

  // Section eyebrow
  sectionEyebrow: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#606070',
    letterSpacing: 1.8,
    marginBottom: 16,
    marginTop: 8,
  },

  // Payment info
  paymentInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.15)',
    padding: 14,
    marginBottom: 16,
  },
  paymentInfoText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#A0A0AB',
    lineHeight: 19,
  },

  // Submit
  submitWrapper: {
    marginTop: 8,
  },

  // Pending view
  pendingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  pendingIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pendingHeading: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  pendingBody: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
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
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pendingInfoText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.warning,
  },
});
