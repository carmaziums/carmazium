import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  formatPence,
  getProviderLead,
  respondToProviderLead,
  SERVICE_LABELS,
  ServiceLead,
} from '../../lib/servicesApi';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderLeadDetail'>;

type ReplyState = {
  headline: string;
  message: string;
  productName: string;
  price: string;
  apr: string;
  term: string;
};

const emptyReply: ReplyState = {
  headline: '',
  message: '',
  productName: '',
  price: '',
  apr: '',
  term: '',
};

export const ProviderLeadDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { leadId } = route.params;
  const [lead, setLead] = useState<ServiceLead | null>(null);
  const [reply, setReply] = useState<ReplyState>(emptyReply);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const value = await getProviderLead(leadId);
      setLead(value);
      setReply({
        headline: value.headline || '',
        message: value.message || '',
        productName: value.productName || '',
        price: value.indicativePricePence != null ? String(value.indicativePricePence / 100) : '',
        apr: value.representativeApr != null ? String(value.representativeApr) : '',
        term: value.responseTermMonths != null ? String(value.responseTermMonths) : '',
      });
    } catch (err: any) {
      setError(err?.message || 'Could not load this matched enquiry.');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!lead || busy) return;
    setError(null);
    setSuccess(null);

    const headline = reply.headline.trim();
    const message = reply.message.trim();
    if (!headline || !message) {
      setError('Add a headline and message before responding.');
      return;
    }

    let indicativePricePence: number | undefined;
    if (reply.price.trim()) {
      const price = Number(reply.price);
      if (!Number.isFinite(price) || price < 0) {
        setError('Enter a valid non-negative indicative price.');
        return;
      }
      indicativePricePence = Math.round(price * 100);
    }

    let representativeApr: number | undefined;
    let termMonths: number | undefined;
    if (lead.serviceType === 'FINANCE') {
      if (reply.apr.trim()) {
        representativeApr = Number(reply.apr);
        if (!Number.isFinite(representativeApr) || representativeApr < 0 || representativeApr > 100) {
          setError('Representative APR must be between 0 and 100.');
          return;
        }
      }

      if (reply.term.trim()) {
        termMonths = Number(reply.term);
        if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 120) {
          setError('Finance term must be a whole number between 1 and 120 months.');
          return;
        }
      }
    }

    setBusy(true);
    try {
      await respondToProviderLead(lead.id, {
        headline,
        message,
        productName: reply.productName.trim() || undefined,
        indicativePricePence,
        ...(lead.serviceType === 'FINANCE' ? { representativeApr, termMonths } : {}),
      });
      setSuccess(lead.recipientStatus === 'RESPONDED' ? 'Response updated.' : 'Response sent.');
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
        <Text style={styles.muted}>Loading matched enquiry…</Text>
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
          <Text style={styles.headerTitle}>Provider Lead</Text>
          <HamburgerButton />
        </View>
        <View style={[styles.center, { paddingHorizontal: 24 }]}>
          <Ionicons name="alert-circle-outline" size={30} color={Colors.accent} />
          <Text style={styles.errorText}>{error || 'Matched enquiry not found.'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgPrimary} />
      <View style={styles.header}>
        <IconButton
          style={styles.headerButton}
          icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={styles.headerTitle}>Matched Enquiry</Text>
        <HamburgerButton />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {success ? (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle-outline" size={17} color={Colors.accentGreen} />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={17} color={Colors.accent} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={[styles.chip, lead.serviceType === 'FINANCE' ? styles.financeChip : styles.warrantyChip]}>
              <Text style={styles.chipText}>{SERVICE_LABELS[lead.serviceType].toUpperCase()}</Text>
            </View>
            <Text style={styles.status}>{lead.recipientStatus || 'VIEWED'}</Text>
          </View>
          <Text style={styles.title}>
            {[lead.vehicleRegistration, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(' • ') || 'Vehicle enquiry'}
          </Text>
          <Text style={styles.muted}>
            Received {new Date(lead.createdAt).toLocaleString('en-GB')} • expires {new Date(lead.expiresAt).toLocaleString('en-GB')}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer contact</Text>
          <Info label="Name" value={lead.fullName || 'Not supplied'} />
          <ContactInfo
            label="Email"
            value={lead.email || 'Not supplied'}
            action={lead.email ? () => void Linking.openURL(`mailto:${lead.email}`) : undefined}
          />
          <ContactInfo
            label="Phone"
            value={lead.phone || 'Not supplied'}
            action={lead.phone ? () => void Linking.openURL(`tel:${lead.phone}`) : undefined}
          />
          <Info label="Postcode" value={lead.postcode || 'Not supplied'} />
          <Text style={styles.consentText}>
            These contact details are shown because the customer consented to sharing this enquiry with matched approved providers.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <Info label="Registration" value={lead.vehicleRegistration || 'Not supplied'} />
          <Info label="Make" value={lead.vehicleMake || 'Not supplied'} />
          <Info label="Model" value={lead.vehicleModel || 'Not supplied'} />
          <Info label="Year" value={lead.vehicleYear != null ? String(lead.vehicleYear) : 'Not supplied'} />
          <Info label="Mileage" value={lead.vehicleMileage != null ? `${lead.vehicleMileage.toLocaleString()} miles` : 'Not supplied'} />
          <Info label="Approx. value" value={lead.vehicleValuePence != null ? formatPence(lead.vehicleValuePence) : 'Not supplied'} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {lead.serviceType === 'FINANCE' ? 'Finance requirements' : 'Warranty requirements'}
          </Text>
          {lead.serviceType === 'FINANCE' ? (
            <>
              <Info label="Deposit" value={lead.depositPence != null ? formatPence(lead.depositPence) : 'Not supplied'} />
              <Info label="Preferred term" value={lead.termMonths != null ? `${lead.termMonths} months` : 'Not supplied'} />
              <Info label="Monthly budget" value={lead.monthlyBudgetPence != null ? formatPence(lead.monthlyBudgetPence) : 'Not supplied'} />
              <Info label="Employment status" value={lead.employmentStatus || 'Not supplied'} />
              <Info label="Annual income" value={lead.annualIncomePence != null ? formatPence(lead.annualIncomePence) : 'Not supplied'} />
            </>
          ) : (
            <>
              <Info label="Requested duration" value={lead.warrantyMonths != null ? `${lead.warrantyMonths} months` : 'Not supplied'} />
              <Info label="Cover level" value={lead.warrantyLevel || 'Not supplied'} />
            </>
          )}
          <View style={styles.notesBox}>
            <Text style={styles.label}>CUSTOMER NOTES</Text>
            <Text style={styles.body}>{lead.summary || 'No additional notes supplied.'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {lead.recipientStatus === 'RESPONDED' ? 'Update your response' : 'Respond to customer'}
          </Text>
          <Text style={styles.body}>
            Your response is sent through the existing TradeXchange provider enquiry flow. CarMazium does not create a service-job payment for Finance or Warranty leads.
          </Text>

          <Field
            label="HEADLINE"
            value={reply.headline}
            onChangeText={(value) => setReply((r) => ({ ...r, headline: value }))}
            placeholder={lead.serviceType === 'FINANCE' ? 'e.g. Finance option available' : 'e.g. Comprehensive warranty available'}
          />
          <Field
            label="MESSAGE"
            value={reply.message}
            onChangeText={(value) => setReply((r) => ({ ...r, message: value }))}
            placeholder="Explain your offer, eligibility or next step"
            multiline
          />
          <Field
            label="PRODUCT / PLAN NAME • OPTIONAL"
            value={reply.productName}
            onChangeText={(value) => setReply((r) => ({ ...r, productName: value }))}
            placeholder={lead.serviceType === 'FINANCE' ? 'e.g. Hire Purchase' : 'e.g. Comprehensive 24'}
          />
          <Field
            label={lead.serviceType === 'FINANCE' ? 'INDICATIVE MONTHLY PAYMENT / COST (£) • OPTIONAL' : 'INDICATIVE WARRANTY PRICE (£) • OPTIONAL'}
            value={reply.price}
            onChangeText={(value) => setReply((r) => ({ ...r, price: value }))}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />

          {lead.serviceType === 'FINANCE' && (
            <View style={styles.twoColumn}>
              <View style={{ flex: 1 }}>
                <Field
                  label="REPRESENTATIVE APR % • OPTIONAL"
                  value={reply.apr}
                  onChangeText={(value) => setReply((r) => ({ ...r, apr: value }))}
                  placeholder="0.0"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="FINANCE TERM MONTHS • OPTIONAL"
                  value={reply.term}
                  onChangeText={(value) => setReply((r) => ({ ...r, term: value }))}
                  placeholder="48"
                  keyboardType="number-pad"
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, busy && styles.disabled]}
            onPress={() => void submit()}
            disabled={busy}
          >
            {busy
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.primaryText}>{lead.recipientStatus === 'RESPONDED' ? 'UPDATE RESPONSE' : 'SEND RESPONSE'}</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={() => void load()}>
          <Ionicons name="refresh-outline" size={15} color={Colors.textSecondary} />
          <Text style={styles.refreshText}>REFRESH ENQUIRY</Text>
        </TouchableOpacity>
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ContactInfo({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: () => void;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {action ? (
        <TouchableOpacity onPress={action}>
          <Text style={styles.contactValue}>{value}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.infoValue}>{value}</Text>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textarea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        maxLength={multiline ? 3000 : 200}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.size18, color: Colors.white },
  content: { padding: 18, gap: 14 },
  card: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, padding: 16, gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  chip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  financeChip: { backgroundColor: Colors.infoBlueAlpha10 },
  warrantyChip: { backgroundColor: Colors.accentGreenAlpha15 },
  chipText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10, letterSpacing: 0.7 },
  status: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10 },
  title: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size20 },
  sectionTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size16 },
  muted: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size12, lineHeight: 18 },
  body: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size12, lineHeight: 19 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha08, paddingTop: 10 },
  infoLabel: { flex: 0.44, fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValue: { flex: 0.56, fontFamily: FontFamily.medium, color: Colors.white, fontSize: FontSize.size12, textAlign: 'right' },
  contactValue: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.size12, textAlign: 'right' },
  consentText: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size10, lineHeight: 16 },
  notesBox: { borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha06, padding: 12 },
  field: { gap: 6 },
  label: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 0.8 },
  input: { borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.bgTertiary, borderRadius: Radius.inline, paddingHorizontal: 13, paddingVertical: 12, color: Colors.white, fontFamily: FontFamily.regular, fontSize: FontSize.size14 },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  twoColumn: { flexDirection: 'row', gap: 10 },
  primaryButton: { minHeight: 48, borderRadius: Radius.inline, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size12, letterSpacing: 0.8 },
  disabled: { opacity: 0.55 },
  successCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.whiteAlpha06, padding: 12 },
  successText: { flex: 1, fontFamily: FontFamily.bold, color: Colors.accentGreen, fontSize: FontSize.size12, lineHeight: 18 },
  errorCard: { flexDirection: 'row', gap: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10, padding: 12 },
  errorText: { flex: 1, fontFamily: FontFamily.regular, color: Colors.white, fontSize: FontSize.size12, lineHeight: 18, textAlign: 'center' },
  refreshButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 12 },
  refreshText: { fontFamily: FontFamily.bold, color: Colors.textSecondary, fontSize: FontSize.size10, letterSpacing: 0.8 },
});
