import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import {
  ServiceLead,
  formatPence,
  getProviderServiceLead,
  respondToProviderLead,
} from '../../lib/servicesApi';
import { IconButton } from '../../components/IconButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderLeadDetail'>;

const parseMoneyToPence = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
};

export const ProviderLeadDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { leadId } = route.params;

  const [lead, setLead] = useState<ServiceLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [headline, setHeadline] = useState('');
  const [productName, setProductName] = useState('');
  const [message, setMessage] = useState('');
  const [price, setPrice] = useState('');
  const [apr, setApr] = useState('');
  const [term, setTerm] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getProviderServiceLead(leadId);
      setLead(next);
      setHeadline(next.headline || '');
      setProductName(next.productName || '');
      setMessage(next.message || '');
      setPrice(
        next.indicativePricePence != null
          ? (next.indicativePricePence / 100).toFixed(2)
          : '',
      );
      setApr(
        next.representativeApr != null
          ? String(next.representativeApr)
          : '',
      );
      setTerm(
        next.responseTermMonths != null
          ? String(next.responseTermMonths)
          : '',
      );
    } catch (err: any) {
      setError(err?.message || 'Could not load this enquiry.');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { void load(); }, [load]);

  const expired = useMemo(() => {
    if (!lead) return false;
    return lead.status === 'EXPIRED' || new Date(lead.expiresAt).getTime() <= Date.now();
  }, [lead]);

  const send = async () => {
    if (!lead) return;

    const trimmedHeadline = headline.trim();
    const trimmedMessage = message.trim();
    if (!trimmedHeadline || !trimmedMessage) {
      setError('Add a headline and message before responding.');
      return;
    }

    const indicativePricePence = parseMoneyToPence(price);
    if (price.trim() && indicativePricePence == null) {
      setError('Enter a valid indicative price.');
      return;
    }

    let representativeApr: number | undefined;
    let responseTerm: number | undefined;

    if (lead.serviceType === 'FINANCE') {
      if (apr.trim()) {
        const parsedApr = Number(apr);
        if (!Number.isFinite(parsedApr) || parsedApr < 0 || parsedApr > 100) {
          setError('Representative APR must be between 0 and 100.');
          return;
        }
        representativeApr = parsedApr;
      }

      if (term.trim()) {
        const parsedTerm = Number(term);
        if (!Number.isInteger(parsedTerm) || parsedTerm < 1 || parsedTerm > 120) {
          setError('Finance term must be between 1 and 120 months.');
          return;
        }
        responseTerm = parsedTerm;
      }
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (lead.serviceType === 'FINANCE') {
        await respondToProviderLead(lead.id, {
          headline: trimmedHeadline,
          message: trimmedMessage,
          productName: productName.trim() || undefined,
          indicativePricePence,
          representativeApr,
          termMonths: responseTerm,
        });
      } else {
        await respondToProviderLead(lead.id, {
          headline: trimmedHeadline,
          message: trimmedMessage,
          productName: productName.trim() || undefined,
          indicativePricePence,
        });
      }

      setSuccess(
        lead.recipientStatus === 'RESPONDED'
          ? 'Response updated.'
          : 'Response sent to the customer.',
      );
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not send your response.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <IconButton
            style={styles.headerButton}
            icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
          />
          <Text style={styles.headerTitle}>Matched Enquiry</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centerCard}>
          <Ionicons name="alert-circle-outline" size={34} color={Colors.accent} />
          <Text style={styles.cardTitle}>Enquiry unavailable</Text>
          <Text style={styles.bodyText}>{error || 'This enquiry could not be loaded.'}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void load()}>
            <Text style={styles.primaryText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const vehicleTitle = [
    lead.vehicleRegistration,
    lead.vehicleMake,
    lead.vehicleModel,
  ].filter(Boolean).join(' · ') || 'Vehicle enquiry';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.header}>
        <IconButton
          style={styles.headerButton}
          icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {lead.serviceType === 'FINANCE' ? 'Finance Enquiry' : 'Warranty Enquiry'}
          </Text>
          <Text style={styles.headerSub}>{vehicleTitle}</Text>
        </View>
        <View style={[
          styles.statusPill,
          lead.recipientStatus === 'RESPONDED' && styles.respondedPill,
          expired && styles.expiredPill,
        ]}>
          <Text style={[
            styles.statusText,
            lead.recipientStatus === 'RESPONDED' && styles.respondedText,
            expired && styles.expiredText,
          ]}>
            {expired ? 'EXPIRED' : (lead.recipientStatus || 'VIEWED')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.accent} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle-outline" size={18} color={Colors.accentGreen} />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer contact</Text>
          <Info label="Name" value={lead.fullName || 'Not supplied'} />
          {lead.email ? (
            <TouchableOpacity
              style={styles.contactRow}
              onPress={() => void Linking.openURL(`mailto:${lead.email}`)}
            >
              <Ionicons name="mail-outline" size={16} color={Colors.accent} />
              <Text style={styles.contactText}>{lead.email}</Text>
            </TouchableOpacity>
          ) : null}
          {lead.phone ? (
            <TouchableOpacity
              style={styles.contactRow}
              onPress={() => void Linking.openURL(`tel:${lead.phone}`)}
            >
              <Ionicons name="call-outline" size={16} color={Colors.accent} />
              <Text style={styles.contactText}>{lead.phone}</Text>
            </TouchableOpacity>
          ) : null}
          <Info label="Postcode" value={lead.postcode || 'Not supplied'} />
          <Text style={styles.privacyText}>
            Contact details are shown because the customer consented to sharing this enquiry with matched approved providers.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle</Text>
          <Info label="Registration" value={lead.vehicleRegistration || 'Not supplied'} />
          <Info label="Make" value={lead.vehicleMake || 'Not supplied'} />
          <Info label="Model" value={lead.vehicleModel || 'Not supplied'} />
          <Info label="Year" value={lead.vehicleYear != null ? String(lead.vehicleYear) : 'Not supplied'} />
          <Info
            label="Mileage"
            value={lead.vehicleMileage != null ? `${lead.vehicleMileage.toLocaleString()} miles` : 'Not supplied'}
          />
          <Info
            label="Approx. value"
            value={lead.vehicleValuePence != null ? formatPence(lead.vehicleValuePence) : 'Not supplied'}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {lead.serviceType === 'FINANCE' ? 'Finance requirements' : 'Warranty requirements'}
          </Text>

          {lead.serviceType === 'FINANCE' ? (
            <>
              <Info label="Deposit" value={lead.depositPence != null ? formatPence(lead.depositPence) : 'Not supplied'} />
              <Info label="Preferred term" value={lead.termMonths != null ? `${lead.termMonths} months` : 'Not supplied'} />
              <Info label="Monthly budget" value={lead.monthlyBudgetPence != null ? formatPence(lead.monthlyBudgetPence) : 'Not supplied'} />
              <Info label="Employment" value={lead.employmentStatus || 'Not supplied'} />
              <Info label="Annual income" value={lead.annualIncomePence != null ? formatPence(lead.annualIncomePence) : 'Not supplied'} />
            </>
          ) : (
            <>
              <Info label="Duration" value={lead.warrantyMonths != null ? `${lead.warrantyMonths} months` : 'Not supplied'} />
              <Info label="Cover level" value={lead.warrantyLevel || 'Not supplied'} />
            </>
          )}

          <View style={styles.notesBox}>
            <Text style={styles.label}>CUSTOMER NOTES</Text>
            <Text style={styles.bodyText}>{lead.summary || 'No additional notes supplied.'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {lead.recipientStatus === 'RESPONDED' ? 'Update your response' : 'Respond to customer'}
          </Text>
          <Text style={styles.bodyText}>
            Your response appears inside the customer’s CarMazium enquiry.
          </Text>

          {expired ? (
            <View style={styles.warningCard}>
              <Ionicons name="time-outline" size={16} color={Colors.warning} />
              <Text style={styles.warningText}>
                This enquiry has expired. Existing response details remain visible, but new responses may be rejected by the backend.
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>HEADLINE</Text>
          <TextInput
            style={styles.input}
            value={headline}
            onChangeText={setHeadline}
            maxLength={120}
            placeholder="Clear summary of your option"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>PRODUCT / PLAN NAME</Text>
          <TextInput
            style={styles.input}
            value={productName}
            onChangeText={setProductName}
            maxLength={120}
            placeholder={lead.serviceType === 'FINANCE' ? 'e.g. Hire Purchase' : 'e.g. Comprehensive 24'}
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>MESSAGE</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
            placeholder="Explain the option, eligibility, important limitations and next steps."
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>
            {lead.serviceType === 'FINANCE'
              ? 'INDICATIVE MONTHLY PAYMENT / COST'
              : 'INDICATIVE WARRANTY PRICE'}
          </Text>
          <View style={styles.moneyInput}>
            <Text style={styles.currency}>£</Text>
            <TextInput
              style={styles.moneyField}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {lead.serviceType === 'FINANCE' ? (
            <>
              <Text style={styles.label}>REPRESENTATIVE APR %</Text>
              <TextInput
                style={styles.input}
                value={apr}
                onChangeText={setApr}
                keyboardType="decimal-pad"
                placeholder="e.g. 9.9"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>FINANCE TERM MONTHS</Text>
              <TextInput
                style={styles.input}
                value={term}
                onChangeText={setTerm}
                keyboardType="number-pad"
                placeholder="e.g. 48"
                placeholderTextColor={Colors.textMuted}
              />
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void send()}
          >
            {busy
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.primaryText}>
                  {lead.recipientStatus === 'RESPONDED' ? 'UPDATE RESPONSE' : 'SEND RESPONSE'}
                </Text>}
          </TouchableOpacity>
        </View>

        <View style={{ height: 36 }} />
      </ScrollView>
    </View>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoLine}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.textMuted, marginTop: 2 },
  statusPill: { borderRadius: 999, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha08, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textSecondary },
  respondedPill: { borderColor: Colors.successAlpha25, backgroundColor: Colors.successAlpha10 },
  respondedText: { color: Colors.accentGreen },
  expiredPill: { borderColor: Colors.errorAlpha25, backgroundColor: Colors.errorAlpha10 },
  expiredText: { color: Colors.errorLight },
  content: { padding: 18, gap: 12 },
  centerCard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  card: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, padding: 16, gap: 12 },
  cardTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.base },
  bodyText: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size12, lineHeight: 19 },
  privacyText: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size10, lineHeight: 16 },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha08, paddingBottom: 9 },
  infoLabel: { fontFamily: FontFamily.medium, color: Colors.textMuted, fontSize: FontSize.xs },
  infoValue: { flex: 1, fontFamily: FontFamily.medium, color: Colors.white, fontSize: FontSize.xs, textAlign: 'right' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  contactText: { fontFamily: FontFamily.medium, color: Colors.accent, fontSize: FontSize.size12 },
  notesBox: { borderTopWidth: 1, borderTopColor: Colors.whiteAlpha08, paddingTop: 12, gap: 7 },
  label: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 0.8 },
  input: { borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.bgTertiary, borderRadius: Radius.inline, paddingHorizontal: 13, paddingVertical: 11, color: Colors.white, fontFamily: FontFamily.regular, fontSize: FontSize.sm },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  moneyInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.bgTertiary, borderRadius: Radius.inline, paddingHorizontal: 13 },
  currency: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.base },
  moneyField: { flex: 1, paddingVertical: 11, paddingHorizontal: 8, color: Colors.white, fontFamily: FontFamily.bold, fontSize: FontSize.base },
  warningCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.warningAlpha25, backgroundColor: Colors.warningAlpha10, padding: 12 },
  warningText: { flex: 1, fontFamily: FontFamily.regular, color: Colors.warningLight, fontSize: FontSize.xs, lineHeight: 18 },
  errorCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10, padding: 12 },
  errorText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.paleRed_fca5a5, lineHeight: 18 },
  successCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.successAlpha25, backgroundColor: Colors.successAlpha10, padding: 12 },
  successText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.size12, color: Colors.accentGreen },
  primaryButton: { minHeight: 46, borderRadius: Radius.inline, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xs, letterSpacing: 0.7 },
  disabled: { opacity: 0.55 },
});
