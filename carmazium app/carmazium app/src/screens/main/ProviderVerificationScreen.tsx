import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Elevation, Radius } from '../../constants/spacing';
import { SERVICE_LABELS, getMyCapabilities } from '../../lib/servicesApi';
import {
  CapabilityVerificationDetail,
  getCapabilityVerification,
  submitProviderDeclaration,
} from '../../lib/serviceOperationsApi';
import { IconButton } from '../../components/IconButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderVerification'>;

const stateColor = (state?: string) => {
  if (state === 'SATISFIED' || state === 'APPROVED' || state === 'VERIFIED' || state === 'READY') return Colors.accentGreen;
  if (state === 'REJECTED') return Colors.accent;
  if (state === 'PENDING' || state === 'IN_REVIEW') return Colors.warning;
  return Colors.textMuted;
};

export const ProviderVerificationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { capabilityId } = route.params;
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<CapabilityVerificationDetail | null>(null);
  const [serviceType, setServiceType] = useState<'DELIVERY' | 'INSPECTION' | 'FINANCE' | 'WARRANTY' | null>(null);
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState({ businessName: '', businessAddress: '', phone: '', registeredBusiness: false });
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mine = await getMyCapabilities();
      const cap = mine.capabilities.find((item) => item.id === capabilityId);
      if (!cap) throw new Error('This service application was not found on your Partner Account.');
      setServiceType(cap.serviceType);
      if (cap.serviceType === 'FINANCE' || cap.serviceType === 'WARRANTY') throw new Error('Finance and warranty verification is managed directly by CarMazium admin.');
      const verification = await getCapabilityVerification(capabilityId);
      setDetail(verification);
      const declaration = verification.verification.declaration;
      setBusiness({ businessName: declaration?.businessName ?? mine.profile?.businessName ?? '', businessAddress: declaration?.businessAddress ?? '', phone: declaration?.phone ?? mine.profile?.phone ?? '', registeredBusiness: declaration?.registeredBusiness ?? false });
    } catch (err: any) {
      setError(err?.message || 'Could not load provider verification.');
    } finally {
      setLoading(false);
    }
  }, [capabilityId]);

  useEffect(() => { void load(); }, [load]);

  const saveDeclaration = async () => {
    setBusy(true); setError(null);
    try {
      const result = await submitProviderDeclaration(capabilityId, { ...business, accepted });
      setDetail(result); setAccepted(false);
      Alert.alert('Declaration saved', 'Complete business verification and secure payout setup before taking jobs.');
    } catch (e: any) { setError(e?.message || 'Could not save declaration.'); }
    finally { setBusy(false); }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
      <View style={styles.header}>
        <IconButton style={styles.headerButton} icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Provider verification</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View> : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{serviceType ? SERVICE_LABELS[serviceType] : 'Service application'}</Text>
          <Text style={styles.sub}>Complete business details, the declaration and secure payout setup. Only trade insurance is uploaded for collection, delivery and recovery. No inspection documents are required.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {detail ? (
            <>
              <View style={styles.summaryCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>VERIFICATION STATUS</Text>
                  <Text style={[styles.summaryStatus, { color: stateColor(detail.verification.verificationStatus) }]}>
                    {detail.verification.verificationStatus.replace(/_/g, ' ')}
                  </Text>
                  {detail.verification.verificationExpiresAt ? (
                    <Text style={styles.cardText}>Expires {new Date(detail.verification.verificationExpiresAt).toLocaleDateString('en-GB')}</Text>
                  ) : null}
                </View>
                <Ionicons name="shield-checkmark-outline" size={30} color={stateColor(detail.verification.verificationStatus)} />
              </View>

              {detail.verification.declarationRequired && <View style={styles.card}>
                <Text style={styles.sectionTitle}>Business details and declaration</Text>
                {detail.verification.declarationCurrent && <Text style={styles.cardText}>Declaration saved.</Text>}
                {([['businessName', 'Business / trading name'], ['businessAddress', 'Registered business address'], ['phone', 'Business phone']] as const).map(([key, label]) => <View key={key}>
                  <Text style={styles.cardText}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={business[key]} maxLength={500} onChangeText={value => setBusiness({ ...business, [key]: value })} />
                </View>)}
                <Text style={styles.cardText}>My business is registered, including a registered sole trader.</Text>
                <Switch accessibilityLabel="Business registered" value={business.registeredBusiness} onValueChange={value => setBusiness({ ...business, registeredBusiness: value })} />
                <Text style={styles.cardText}>I confirm these details are accurate and I am responsible for carrying out the services I accept competently and safely.</Text>
                <Switch accessibilityLabel="Accept service declaration" value={accepted} onValueChange={setAccepted} />
                <TouchableOpacity accessibilityRole="button" disabled={busy || !accepted || !business.registeredBusiness} onPress={saveDeclaration} style={styles.fileButton}><Text style={styles.fileButtonText}>SAVE DECLARATION</Text></TouchableOpacity>
                <Text style={styles.cardText}>Your approved dealer KYC and one-time £1 account verification are reused. No additional verification payment is required for services. Verified business payouts are required. Enter bank details through secure payout setup.</Text>
                <TouchableOpacity onPress={() => navigation.navigate('ProviderCapabilities')}><Text style={styles.cardText}>Check payout setup and service status</Text></TouchableOpacity>
              </View>}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Documents & Insurance</Text>
                <Text style={styles.cardText}>Upload trade insurance, check current requirements and view your existing evidence history from TradeXchange. Your business declaration remains on this page until the full consolidation.</Text>
                {serviceType === "INSPECTION" && <Text style={styles.cardText}>No inspection documents are required.</Text>}
                <TouchableOpacity accessibilityRole="button" style={styles.fileButton} onPress={() => navigation.navigate("PartnerDashboard")}>
                  <Text style={styles.fileButtonText}>OPEN DOCUMENTS & INSURANCE</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
          <View style={{ height: 44 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderBottomWidth: 2, ...Elevation.card },
  headerTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.lg },
  content: { padding: 18, gap: 13 },
  title: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xl },
  sub: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.card, padding: 16, backgroundColor: Colors.bgCard, borderColor: Colors.border, ...Elevation.card },
  summaryStatus: { fontFamily: FontFamily.bold, fontSize: FontSize.base, marginTop: 4 },
  label: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 1 },
  sectionTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.base, marginTop: 4 },
  requirement: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, borderRadius: Radius.card, padding: 14 },
  requirementSelected: { borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10 },
  card: { borderWidth: 1, borderRadius: Radius.card, padding: 15, gap: 10, backgroundColor: Colors.bgCard, borderColor: Colors.border, ...Elevation.card },
  cardTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.sm },
  cardText: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.xs, lineHeight: 18 },
  stateText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, marginTop: 4 },
  warningCard: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: Colors.warningAlpha30, backgroundColor: Colors.warningAlpha08, borderRadius: Radius.inline, padding: 13 },
  warningText: { flex: 1, fontFamily: FontFamily.regular, color: Colors.lightYellow, fontSize: FontSize.xs, lineHeight: 18 },
  fileButton: { minHeight: 44, borderWidth: 1, borderColor: Colors.borderHi, borderRadius: Radius.inline, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: Colors.bgCard, borderBottomWidth: 3, ...Elevation.card },
  fileButtonText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xs },
  input: { borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.bgTertiary, borderRadius: Radius.inline, color: Colors.white, paddingHorizontal: 13, paddingVertical: 11, fontFamily: FontFamily.regular, fontSize: FontSize.sm },
  primaryButton: { minHeight: 46, borderRadius: Radius.inline, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderBottomWidth: 3, borderBottomColor: Colors.accentDark, ...Elevation.neon },
  primaryText: { fontFamily: FontFamily.bold, color: Colors.onAccent, fontSize: FontSize.xs },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.whiteAlpha10, borderRadius: Radius.card, padding: 24, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionButton: { minHeight: 35, borderWidth: 1, borderColor: Colors.borderHi, borderRadius: 9, justifyContent: 'center', paddingHorizontal: 10, backgroundColor: Colors.bgCard, borderBottomWidth: 3, ...Elevation.card },
  actionText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10 },
  error: { fontFamily: FontFamily.regular, color: Colors.paleRed_fca5a5, fontSize: FontSize.size12 },
});
