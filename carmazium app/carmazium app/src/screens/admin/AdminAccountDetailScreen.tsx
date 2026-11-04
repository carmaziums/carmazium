import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { Button } from '../../components/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Colors } from '../../constants/colors';
import { TextPresets, Type } from '../../constants/typography';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import { getAdminUserDetail } from '../../lib/adminApi';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import {
  AdminHeader,
  AdminListSkeleton,
  adminStyles,
  fmtDate,
  fmtDateTime,
  formatPrice,
  normalizeExternalUrl,
  openAdminWeb,
  openExternalUrl,
} from './adminShared';
import { accountStatus } from './adminAccountStatus';

type Props = NativeStackScreenProps<MainStackParamList, 'AdminAccountDetail'>;

// Same documents as web UserDetailModal KYC_DOC_FIELDS.
const KYC_DOC_FIELDS: { key: string; label: string }[] = [
  { key: 'vatProof', label: 'VAT Proof' },
  { key: 'proofOfAddress', label: 'Proof of Address' },
  { key: 'companyRegistrationProof', label: 'Company Registration Cert' },
  { key: 'directorIdProof', label: 'Director ID / Passport' },
  { key: 'paymentScreenshot', label: 'Payment Screenshot' },
];

function fmtProviders(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return '—';
  return value.map((p) => {
    const text = String(p);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }).join(', ');
}

const display = (value: unknown): string =>
  value == null || value === '' ? '—' : String(value);

const Field: React.FC<{ label: string; value: unknown; onPress?: () => void }> = ({ label, value, onPress }) => (
  <View style={styles.field}>
    <Text style={adminStyles.fieldLabel}>{label}</Text>
    {onPress ? (
      <TouchableOpacity onPress={onPress} accessibilityRole="link">
        <Text style={[adminStyles.link, styles.fieldGap]}>{display(value)}</Text>
      </TouchableOpacity>
    ) : (
      <Text style={adminStyles.fieldValue}>{display(value)}</Text>
    )}
  </View>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={adminStyles.sectionLabel}>{title}</Text>
    <Card padded>{children}</Card>
  </View>
);

export const AdminAccountDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { userId } = route.params;
  const bottomPad = useTabBarClearance();
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      setDetail(await getAdminUserDetail(userId));
    } catch (err: any) {
      setError(err?.message || 'Failed to load user details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const name = detail
    ? [detail.firstName, detail.lastName].filter(Boolean).join(' ') || detail.email || 'User'
    : 'User details';
  const status = detail ? accountStatus(detail) : null;
  const auth = detail?.authActivity;
  const supa = auth?.source === 'SUPABASE';
  const kyc = detail?.dealerProfile?.kyc;
  const dealerWebsite = normalizeExternalUrl(detail?.dealerProfile?.website);
  const kycWebsite = normalizeExternalUrl(kyc?.businessWebsite);

  return (
    <View style={adminStyles.screen}>
      <AdminHeader title={name} subtitle="Account details (read-only)" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={Colors.accent} colors={[Colors.accent]} />
        }
      >
        {error ? <ErrorBanner message={error} onRetry={() => void load(false)} /> : null}
        {loading && !detail ? <AdminListSkeleton count={3} height={140} /> : null}

        {detail ? (
          <>
            <View style={styles.badges}>
              <Badge kind="neutral">{detail.role}</Badge>
              {status ? <Badge kind="dark">{status}</Badge> : null}
              {detail.isEmailVerified ? <Badge kind="verified">Verified</Badge> : null}
            </View>

            <Button
              label="Manage on website"
              variant="outline"
              size="sm"
              icon={<Ionicons name="open-outline" size={14} color={Colors.textPrimary} />}
              onPress={() => void openAdminWeb('/dashboard/admin/users')}
            />
            <Text style={adminStyles.meta}>
              Role changes, bans, locks and verification stay on the website admin console in this version of the app.
            </Text>

            <Section title="Identity">
              <Field label="Account ID" value={detail.id} />
              <Field label="Role" value={detail.role} />
              <Field label="Email" value={detail.email} />
              <Field label="Phone" value={detail.phone || 'Not on file'} />
              <Field label="Location" value={[detail.location, detail.postcode].filter(Boolean).join(', ')} />
              <Field label="Joined" value={fmtDate(detail.createdAt)} />
              <Field label="Last Updated" value={fmtDateTime(detail.updatedAt)} />
              <Field label="Email Verified" value={detail.isEmailVerified ? 'Yes' : 'No'} />
              <Field label="Phone Verified" value={detail.isPhoneVerified ? 'Yes' : 'No'} />
              <Field label="Address Verified" value={detail.isAddressVerified ? 'Yes' : 'No'} />
              <Field label="Address Verified At" value={detail.addressVerifiedAt ? fmtDateTime(detail.addressVerifiedAt) : '—'} />
              <Field label="Public Profile" value={detail.showPublicProfile ? 'Visible' : 'Hidden'} />
              <Field label="Sale Notifications" value={detail.notifyOnSale ? 'Enabled' : 'Disabled'} />
            </Section>

            <Section title="Sign-in activity">
              <Field label="Auth Source" value={supa ? 'Supabase Auth' : auth?.source === 'LOCAL' ? 'Local / legacy account' : 'Unavailable'} />
              <Field label="Successful Logins" value={supa ? auth?.successfulLogins ?? 0 : '—'} />
              <Field label="Last Sign In" value={supa ? fmtDateTime(auth?.lastSignInAt || auth?.lastLoginAt) : '—'} />
              <Field label="First Recorded Login" value={supa ? fmtDateTime(auth?.firstLoginAt) : '—'} />
              <Field label="Sign-in Providers" value={supa ? fmtProviders(auth?.providers) : '—'} />
              <Field label="Email Confirmed" value={supa ? fmtDateTime(auth?.emailConfirmedAt) : '—'} />
              <Field label="Phone Confirmed" value={supa ? fmtDateTime(auth?.phoneConfirmedAt) : '—'} />
              <Field label="SSO Account" value={supa ? (auth?.isSsoUser ? 'Yes' : 'No') : '—'} />
            </Section>

            {detail.bankAccountNumber || detail.stripeConnectAccountId ? (
              <Section title="Payout Info">
                <Field label="Payout Method" value={detail.payoutPreference} />
                <Field label="Stripe Connect" value={detail.stripeConnectOnboardingComplete ? 'Onboarded' : 'Not complete'} />
                <Field label="Bank Account Name" value={detail.bankAccountName} />
                <Field label="Sort Code" value={detail.bankSortCode} />
                <Field label="Account Number" value={detail.bankAccountNumber} />
              </Section>
            ) : null}

            {detail.dealerProfile ? (
              <Section title="Dealer Profile">
                <Field label="Company Name" value={detail.dealerProfile.companyName} />
                <Field label="Verified" value={detail.dealerProfile.isVerified ? 'Yes' : 'No'} />
                <Field label="VAT Number" value={detail.dealerProfile.vatNumber} />
                <Field label="Registration No." value={detail.dealerProfile.registrationNumber} />
                <Field label="Business Address" value={detail.dealerProfile.businessAddress} />
                <Field label="Business Phone" value={detail.dealerProfile.phone} />
                <Field
                  label="Website"
                  value={detail.dealerProfile.website}
                  onPress={dealerWebsite ? () => void openExternalUrl(dealerWebsite) : undefined}
                />
              </Section>
            ) : null}

            {kyc ? (
              <Section title="KYC Record">
                <Field label="Status" value={kyc.status} />
                <Field label="Submitted" value={fmtDateTime(kyc.submittedAt)} />
                <Field label="Company House Name" value={kyc.companyHouseName} />
                <Field label="Company Reg. No." value={kyc.companyRegistrationNumber} />
                <Field label="Representative" value={kyc.representativeName} />
                <Field label="Representative Role" value={kyc.representativePosition} />
                <Field label="Director" value={kyc.directorName} />
                <Field label="Person of Significant Control" value={kyc.personOfSignificantControl} />
                <Field
                  label="Business Website"
                  value={kyc.businessWebsite}
                  onPress={kycWebsite ? () => void openExternalUrl(kycWebsite) : undefined}
                />
                <Field label="Registered Address" value={kyc.businessRegisteredAddress} />
                <Field label="Trading Address" value={kyc.tradingAddress} />
                <Field label="£1 Fee Charged" value={kyc.stripeChargedAt ? fmtDateTime(kyc.stripeChargedAt) : 'Not paid'} />
                <Field label="Reviewed" value={kyc.reviewedAt ? fmtDateTime(kyc.reviewedAt) : 'Not yet reviewed'} />
                {KYC_DOC_FIELDS.map(({ key, label }) => {
                  const url = kyc[key];
                  return (
                    <Field
                      key={key}
                      label={label}
                      value={url ? 'Open document' : 'Not provided'}
                      onPress={url ? () => void openExternalUrl(String(url)) : undefined}
                    />
                  );
                })}
              </Section>
            ) : null}

            {detail.sellerProfile ? (
              <Section title="Seller Profile">
                <Field label="Reliability Score" value={`${Number(detail.sellerProfile.reliabilityScore ?? 0).toFixed(1)} / 5.0`} />
                <Field label="Total Sales" value={detail.sellerProfile.totalSales} />
                <Field label="Total Listings" value={detail.sellerProfile.totalListings} />
                <Field label="Response Rate" value={`${detail.sellerProfile.responseRate}%`} />
              </Section>
            ) : null}

            <Section title="Activity">
              <View style={styles.counts}>
                {[
                  ['Listings', detail._count?.listings],
                  ['Transactions', detail._count?.transactions],
                  ['Sales Completed', detail._count?.salesAsSeller],
                  ['Purchases Completed', detail._count?.purchasesAsBuyer],
                  ['Auctions Won', detail._count?.wonAuctions],
                ].map(([label, value]) => (
                  <View key={String(label)} style={styles.count}>
                    <Text style={styles.countValue}>{Number(value ?? 0).toLocaleString()}</Text>
                    <Text style={adminStyles.meta}>{label}</Text>
                  </View>
                ))}
              </View>
              {detail.recentListings?.length > 0 ? (
                <View style={styles.recent}>
                  <Text style={adminStyles.fieldLabel}>Recent listings</Text>
                  {detail.recentListings.map((l: any) => (
                    <Text key={l.id} style={adminStyles.body}>{`${l.title} — ${formatPrice(l.price)} — ${l.status}`}</Text>
                  ))}
                </View>
              ) : null}
              {detail.recentTransactions?.length > 0 ? (
                <View style={styles.recent}>
                  <Text style={adminStyles.fieldLabel}>Recent transactions</Text>
                  {detail.recentTransactions.map((t: any) => (
                    <Text key={t.id} style={adminStyles.body}>{`${t.type} — ${formatPrice(Number(t.amount))} — ${t.status}`}</Text>
                  ))}
                </View>
              ) : null}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  section: { gap: 8 },
  field: { paddingVertical: 6 },
  fieldGap: { marginTop: 2 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  count: { flexBasis: '28%', flexGrow: 1 },
  countValue: { ...TextPresets.monoFigure, fontSize: Type.h5, color: Colors.textPrimary },
  recent: { marginTop: 12, gap: 4 },
});
