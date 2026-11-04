import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { Button } from '../../components/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Colors } from '../../constants/colors';
import { FontFamily, Type } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import { getPendingKycList, reviewKyc, type DealerKycBusinessType } from '../../lib/adminApi';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import {
  AdminHeader,
  AdminListSkeleton,
  adminStyles,
  fmtDateTime,
  isPdfUrl,
  normalizeExternalUrl,
  openExternalUrl,
} from './adminShared';

type Props = NativeStackScreenProps<MainStackParamList, 'AdminDealerKyc'>;

type Decision = { status: 'APPROVED' | 'REJECTED'; note: string };
type Decisions = Record<string, Decision>;

type KycField = {
  id: string;
  label: string;
  category: string;
  isProof?: boolean;
  isLink?: boolean;
  ltdOnly?: boolean;
  soleTraderOnly?: boolean;
};

// Copied from web KYC_FIELDS (src/app/dashboard/admin/dealer-verification/page.tsx).
// The ids are the `field` values the backend's ReviewKycDto expects.
const KYC_FIELDS: KycField[] = [
  { id: 'companyHouseName', label: 'Company House Registered Name', category: 'Corporate Details' },
  { id: 'directorName', label: 'Lead Director Full Name', category: 'Corporate Details' },
  { id: 'directorIdProof', label: 'Photo ID (Driving Licence / Passport)', category: 'Corporate Details', isProof: true },
  { id: 'proofOfAddress', label: 'Proof of Address', category: 'Corporate Details', isProof: true, soleTraderOnly: true },
  { id: 'representativeName', label: 'Representative Full Name', category: 'Corporate Details' },
  { id: 'representativePosition', label: 'Representative Job Title', category: 'Corporate Details' },
  { id: 'personOfSignificantControl', label: 'Person of Significant Control (PSC)', category: 'Corporate Details', ltdOnly: true },
  { id: 'vatNumber', label: 'VAT Registration Number', category: 'Commercial & Contact', ltdOnly: true },
  { id: 'vatProof', label: 'VAT Certificate / Registration Proof', category: 'Commercial & Contact', isProof: true, ltdOnly: true },
  { id: 'companyRegistrationNumber', label: 'Company House Registration Number', category: 'Commercial & Contact', ltdOnly: true },
  { id: 'companyRegistrationProof', label: 'Company House Certificate', category: 'Commercial & Contact', isProof: true, ltdOnly: true },
  { id: 'businessWebsite', label: 'Corporate Website URL', category: 'Commercial & Contact', isLink: true },
  { id: 'googleReviewsLink', label: 'Google Reviews Link', category: 'Commercial & Contact', isLink: true },
  { id: 'businessRegisteredAddress', label: 'Registered Business Address', category: 'Addresses' },
  { id: 'tradingAddress', label: 'Trading Address', category: 'Addresses' },
  { id: 'paymentReference', label: 'Unique Bank Payment Reference Code', category: 'Payment Verification' },
  { id: 'paymentScreenshot', label: 'Bank Transfer Receipt / Screenshot', category: 'Payment Verification', isProof: true },
];

const CATEGORIES = ['Corporate Details', 'Commercial & Contact', 'Addresses', 'Payment Verification'];

const normalizeBusinessType = (value: unknown): DealerKycBusinessType =>
  value === 'SOLE_PROPRIETORSHIP' ? 'SOLE_PROPRIETORSHIP' : 'PRIVATE_LIMITED';

/** Web fieldsFor: records without businessType are limited companies. */
function fieldsFor(businessType: DealerKycBusinessType): KycField[] {
  const soleTrader = businessType === 'SOLE_PROPRIETORSHIP';
  return KYC_FIELDS.filter((f) => (soleTrader ? !f.ltdOnly : !f.soleTraderOnly));
}

/** Web buildDecisionsForKyc — default to approved, keep earlier rejections. */
function buildDecisions(kyc: any, businessType: DealerKycBusinessType, current: Decisions = {}): Decisions {
  const out: Decisions = {};
  const existingStatuses = kyc.documentStatuses || {};
  fieldsFor(businessType).forEach((field) => {
    if (current[field.id]) {
      out[field.id] = current[field.id];
      return;
    }
    const existing = existingStatuses[field.id];
    const stripeVerifiedPayment =
      kyc.stripePaymentIntentId && (field.id === 'paymentReference' || field.id === 'paymentScreenshot');
    out[field.id] = stripeVerifiedPayment
      ? { status: 'APPROVED', note: 'Stripe verified' }
      : {
          status: existing?.status === 'REJECTED' ? 'REJECTED' : 'APPROVED',
          note: existing?.status === 'REJECTED' ? existing?.note || '' : '',
        };
  });
  return out;
}

function renderFieldValue(field: KycField, val: any) {
  const hasValue = val != null && val !== '';
  if (!hasValue) return <Text style={[adminStyles.meta, styles.italic]}>Not provided</Text>;
  if (field.isProof) {
    const url = String(val);
    return (
      <TouchableOpacity
        style={styles.proof}
        onPress={() => void openExternalUrl(url)}
        accessibilityRole="link"
        accessibilityLabel={`Open ${field.label}`}
      >
        {isPdfUrl(url) ? (
          <View style={[styles.proofThumb, styles.proofPdf]}>
            <Ionicons name="document-text-outline" size={18} color={Colors.accent} />
          </View>
        ) : (
          <Image source={{ uri: url }} style={styles.proofThumb} contentFit="cover" />
        )}
        <View style={styles.flex}>
          <Text style={adminStyles.link}>Open document</Text>
          <Text style={adminStyles.meta} numberOfLines={1}>{url.split('/').pop()?.split('?')[0]}</Text>
        </View>
      </TouchableOpacity>
    );
  }
  if (field.isLink) {
    const link = normalizeExternalUrl(String(val));
    if (link) {
      return (
        <TouchableOpacity onPress={() => void openExternalUrl(link)} accessibilityRole="link">
          <Text style={adminStyles.link} numberOfLines={2}>{String(val)}</Text>
        </TouchableOpacity>
      );
    }
  }
  return <Text style={adminStyles.fieldValue}>{String(val)}</Text>;
}

const keyExtractor = (item: any) => String(item.id);

export const AdminDealerKycScreen: React.FC<Props> = ({ navigation }) => {
  const bottomPad = useTabBarClearance();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Decisions>({});
  const [businessTypes, setBusinessTypes] = useState<Record<string, DealerKycBusinessType>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      setList((await getPendingKycList()) || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pending dealer registrations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const toggleExpand = useCallback((kyc: any) => {
    if (expandedId === kyc.id) {
      setExpandedId(null);
      setDecisions({});
      return;
    }
    const businessType = normalizeBusinessType(kyc.businessType);
    setExpandedId(kyc.id);
    setBusinessTypes((prev) => ({ ...prev, [kyc.id]: businessType }));
    setDecisions(buildDecisions(kyc, businessType));
  }, [expandedId]);

  const changeBusinessType = useCallback((kyc: any, businessType: DealerKycBusinessType) => {
    setBusinessTypes((prev) => ({ ...prev, [kyc.id]: businessType }));
    // Like web: rebuild for the new field set, keeping decisions already made.
    setDecisions((current) => buildDecisions(kyc, businessType, current));
  }, []);

  const setDecision = useCallback((fieldId: string, patch: Partial<Decision>) => {
    setDecisions((prev) => ({ ...prev, [fieldId]: { ...(prev[fieldId] || { status: 'APPROVED', note: '' }), ...patch } }));
  }, []);

  const submit = useCallback((kyc: any) => {
    const businessType = businessTypes[kyc.id] ?? normalizeBusinessType(kyc.businessType);
    // Exact web payload: note only for rejected fields, '' otherwise.
    const fields = Object.keys(decisions).map((field) => ({
      field,
      status: decisions[field].status,
      note: decisions[field].status === 'REJECTED' ? decisions[field].note : '',
    }));
    if (fields.some((f) => f.status === 'REJECTED' && !f.note.trim())) {
      Alert.alert('Reason required', 'Please provide a rejection reason note for all rejected fields.');
      return;
    }
    const rejectedCount = fields.filter((f) => f.status === 'REJECTED').length;
    Alert.alert(
      rejectedCount === 0 ? 'Approve this dealer?' : `Reject ${rejectedCount} field${rejectedCount === 1 ? '' : 's'}?`,
      "Approving all fields will immediately set overall status to APPROVED and unlock this dealer's dashboard. Rejecting any fields will require them to correct those specific items.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit KYC Decision',
          style: rejectedCount === 0 ? 'default' : 'destructive',
          onPress: async () => {
            setSubmittingId(kyc.id);
            try {
              await reviewKyc(kyc.id, fields, businessType);
              setExpandedId(null);
              setDecisions({});
              Alert.alert('Submitted', 'KYC review submitted successfully! Notification emails have been triggered.');
            } catch (err: any) {
              Alert.alert('Could not submit review', err?.message || 'Failed to submit KYC review.');
            } finally {
              setSubmittingId(null);
              await load(true);
            }
          },
        },
      ],
    );
  }, [businessTypes, decisions, load]);

  const renderReview = useCallback((kyc: any) => {
    const submitted = normalizeBusinessType(kyc.businessType);
    const selected = businessTypes[kyc.id] ?? submitted;
    const soleTrader = selected === 'SOLE_PROPRIETORSHIP';
    const fields = fieldsFor(selected);
    return (
      <View>
        <View style={adminStyles.divider} />
        <View style={styles.metaGrid}>
          <View style={styles.cell}>
            <Text style={adminStyles.fieldLabel}>Representative Role</Text>
            <Text style={adminStyles.fieldValue}>{kyc.representativePosition || '—'}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={adminStyles.fieldLabel}>Submitted On</Text>
            <Text style={adminStyles.fieldValue}>{fmtDateTime(kyc.submittedAt)}</Text>
          </View>
        </View>

        <Text style={[adminStyles.fieldLabel, styles.blockTop]}>Business type</Text>
        <Text style={adminStyles.meta}>
          Admin can correct the business type from the evidence provided. The change is saved with the KYC decision.
        </Text>
        <View style={adminStyles.actions}>
          <Button label="Registered Company" size="sm" style={adminStyles.actionBtn}
            variant={!soleTrader ? 'primary' : 'outline'}
            onPress={() => changeBusinessType(kyc, 'PRIVATE_LIMITED')} />
          <Button label="Sole Trader" size="sm" style={adminStyles.actionBtn}
            variant={soleTrader ? 'primary' : 'outline'}
            onPress={() => changeBusinessType(kyc, 'SOLE_PROPRIETORSHIP')} />
        </View>
        {selected !== submitted ? <Text style={[adminStyles.meta, styles.warn]}>Admin correction pending</Text> : null}
        {soleTrader ? (
          <Text style={[adminStyles.meta, styles.blockTop]}>
            Sole traders do not need Companies House, VAT or PSC evidence; owner ID and proof of address are used instead.
          </Text>
        ) : null}

        {CATEGORIES.map((cat) => {
          if (cat === 'Payment Verification' && kyc.stripePaymentIntentId) {
            return (
              <View key={cat} style={styles.category}>
                <Text style={adminStyles.sectionLabel}>{cat}</Text>
                <View style={styles.fieldCard}>
                  <Badge kind="verified">Stripe Verified · Auto-Approved</Badge>
                  <Text style={[adminStyles.mono, styles.blockTop]}>{kyc.stripePaymentIntentId}</Text>
                  {kyc.stripeChargedAt ? (
                    <Text style={adminStyles.meta}>
                      Charged {new Date(kyc.stripeChargedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }
          const catFields = fields.filter((f) => f.category === cat);
          if (catFields.length === 0) return null;
          return (
            <View key={cat} style={styles.category}>
              <Text style={adminStyles.sectionLabel}>{cat}</Text>
              {catFields.map((field) => {
                const decision = decisions[field.id] || { status: 'APPROVED', note: '' };
                const rejected = decision.status === 'REJECTED';
                return (
                  <View key={field.id} style={[styles.fieldCard, rejected && styles.fieldCardRejected]}>
                    <Text style={adminStyles.fieldLabel}>{field.label}</Text>
                    <View style={styles.valueWrap}>{renderFieldValue(field, kyc[field.id])}</View>
                    <View style={styles.toggleRow}>
                      <TouchableOpacity
                        style={[styles.toggle, !rejected && styles.toggleApproved]}
                        onPress={() => setDecision(field.id, { status: 'APPROVED' })}
                        accessibilityRole="button"
                        accessibilityState={{ selected: !rejected }}
                        accessibilityLabel={`Approve ${field.label}`}
                      >
                        <Ionicons name="checkmark" size={14} color={!rejected ? Colors.success : Colors.textMuted} />
                        <Text style={[styles.toggleText, !rejected && styles.toggleTextApproved]}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.toggle, rejected && styles.toggleRejected]}
                        onPress={() => setDecision(field.id, { status: 'REJECTED' })}
                        accessibilityRole="button"
                        accessibilityState={{ selected: rejected }}
                        accessibilityLabel={`Reject ${field.label}`}
                      >
                        <Ionicons name="close" size={14} color={rejected ? Colors.error : Colors.textMuted} />
                        <Text style={[styles.toggleText, rejected && styles.toggleTextRejected]}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                    {rejected ? (
                      <TextInput
                        style={adminStyles.input}
                        value={decision.note}
                        onChangeText={(note) => setDecision(field.id, { note })}
                        placeholder="Explain what the dealer needs to fix…"
                        placeholderTextColor={Colors.inputPlaceholder}
                        multiline
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        })}

        <Button
          label="Submit KYC Decision"
          variant="primary"
          fullWidth
          style={styles.blockTop}
          onPress={() => submit(kyc)}
          loading={submittingId === kyc.id}
          disabled={submittingId === kyc.id}
        />
      </View>
    );
  }, [businessTypes, decisions, changeBusinessType, setDecision, submit, submittingId]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    const expanded = expandedId === item.id;
    return (
      <Card padded active={expanded}>
        <TouchableOpacity
          style={styles.headerRow}
          onPress={() => toggleExpand(item)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <View style={styles.flex}>
            <Text style={adminStyles.title}>{item.dealerProfile?.companyName || 'Unknown Dealership'}</Text>
            <Text style={adminStyles.meta}>Owner: {item.representativeName || '—'}</Text>
            <Text style={adminStyles.meta}>Email: {item.dealerProfile?.user?.email || 'No email'}</Text>
            <View style={styles.badgeRow}>
              <Badge kind={item.status === 'REJECTED' ? 'dark' : 'featured'}>
                {item.status === 'REJECTED' ? 'Rejected — Awaiting Fix' : 'Pending Review'}
              </Badge>
            </View>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        {expanded ? renderReview(item) : null}
      </Card>
    );
  }, [expandedId, toggleExpand, renderReview]);

  return (
    <View style={adminStyles.screen}>
      <AdminHeader title="Dealer KYC" subtitle="Granular field verification" onBack={() => navigation.goBack()} />
      <FlatList
        data={loading ? [] : list}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={[expandedId, decisions, businessTypes, submittingId]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[adminStyles.listContent, { paddingBottom: bottomPad }]}
        ListHeaderComponent={
          <View style={styles.header}>
            {error ? <ErrorBanner message={error} onRetry={() => void load(false)} /> : null}
            <Text style={adminStyles.meta}>Tap a dealership to review each field. Documents open in the browser.</Text>
            {loading ? <AdminListSkeleton height={120} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading || error ? null : (
            <EmptyState
              icon="checkmark-circle-outline"
              title="All Caught Up!"
              subtitle="There are no dealer registrations waiting for review."
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: { gap: 10 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  badgeRow: { flexDirection: 'row', marginTop: 8 },
  metaGrid: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1 },
  blockTop: { marginTop: 12 },
  warn: { marginTop: 6, color: Colors.warning },
  italic: { fontStyle: 'italic' },
  category: { marginTop: 8, gap: 8 },
  fieldCard: {
    padding: 12,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
  },
  fieldCardRejected: { borderColor: Colors.errorAlpha30, backgroundColor: Colors.errorAlpha08 },
  valueWrap: { marginTop: 4 },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleApproved: { borderColor: Colors.accentGreenAlpha30, backgroundColor: Colors.successAlpha12 },
  toggleRejected: { borderColor: Colors.errorAlpha30, backgroundColor: Colors.errorAlpha10 },
  toggleText: { fontFamily: FontFamily.bold, fontSize: Type.caption, color: Colors.textMuted },
  toggleTextApproved: { color: Colors.success },
  toggleTextRejected: { color: Colors.error },
  proof: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  proofThumb: { width: 44, height: 44, borderRadius: Radius.chip, backgroundColor: Colors.bgTertiary },
  proofPdf: { alignItems: 'center', justifyContent: 'center' },
});
