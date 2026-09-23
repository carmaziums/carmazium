import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import {
  ContractorCapability,
  SERVICE_LABELS,
  getMyCapabilities,
  updateJobMatching,
  updateLeadMatching,
} from '../../lib/servicesApi';
import { IconButton } from '../../components/IconButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderMatching'>;

const pounds = (pence: number | null) => pence == null ? '' : String(Math.round(pence / 100));
const numberOrUndefined = (value: string) => {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : undefined;
};
const poundsToPence = (value: string) => {
  const n = numberOrUndefined(value);
  return n == null ? undefined : n * 100;
};
const areasFromText = (value: string) =>
  [...new Set(value.split(/[\s,]+/).map((v) => v.trim().toUpperCase()).filter(Boolean))];

export const ProviderMatchingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { capabilityId } = route.params;
  const insets = useSafeAreaInsets();
  const [cap, setCap] = useState<ContractorCapability | null>(null);
  const [nationwide, setNationwide] = useState(false);
  const [areas, setAreas] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxMileage, setMaxMileage] = useState('');
  const [minIncome, setMinIncome] = useState('');
  const [financeTermMin, setFinanceTermMin] = useState('');
  const [financeTermMax, setFinanceTermMax] = useState('');
  const [warrantyLevels, setWarrantyLevels] = useState('');
  const [warrantyMin, setWarrantyMin] = useState('');
  const [warrantyMax, setWarrantyMax] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLead = cap?.serviceType === 'FINANCE' || cap?.serviceType === 'WARRANTY';

  const hydrate = useCallback((next: ContractorCapability) => {
    setCap(next);
    const lead = next.serviceType === 'FINANCE' || next.serviceType === 'WARRANTY';
    setNationwide(lead ? next.leadNationwide : next.jobNationwide);
    setAreas((lead ? next.leadPostcodeAreas : next.jobPostcodeAreas).join(', '));
    setMinValue(pounds(next.leadMinVehicleValuePence));
    setMaxValue(pounds(next.leadMaxVehicleValuePence));
    setMinYear(next.leadMinVehicleYear == null ? '' : String(next.leadMinVehicleYear));
    setMaxMileage(next.leadMaxVehicleMileage == null ? '' : String(next.leadMaxVehicleMileage));
    setMinIncome(pounds(next.leadMinAnnualIncomePence));
    setFinanceTermMin(next.leadFinanceTermMinMonths == null ? '' : String(next.leadFinanceTermMinMonths));
    setFinanceTermMax(next.leadFinanceTermMaxMonths == null ? '' : String(next.leadFinanceTermMaxMonths));
    setWarrantyLevels(next.leadWarrantyLevels.join(', '));
    setWarrantyMin(next.leadWarrantyMinMonths == null ? '' : String(next.leadWarrantyMinMonths));
    setWarrantyMax(next.leadWarrantyMaxMonths == null ? '' : String(next.leadWarrantyMaxMonths));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mine = await getMyCapabilities();
      const next = mine.capabilities.find((item) => item.id === capabilityId);
      if (!next) throw new Error('Service capability not found on your Partner Account.');
      hydrate(next);
    } catch (err: any) {
      setError(err?.message || 'Could not load matching settings.');
    } finally {
      setLoading(false);
    }
  }, [capabilityId, hydrate]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!cap) return;
    const postcodeAreas = nationwide ? [] : areasFromText(areas);
    if (!nationwide && postcodeAreas.length === 0) {
      Alert.alert('Coverage required', 'Choose nationwide coverage or enter at least one UK postcode area, such as B, CV or M.');
      return;
    }
    if (postcodeAreas.some((area) => !/^(?:GIR|[A-Z]{1,2})$/.test(area))) {
      Alert.alert('Invalid postcode area', 'Use postcode areas only, such as B, CV, M or SW.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const updated = isLead
        ? await updateLeadMatching(cap.id, {
            leadNationwide: nationwide,
            leadPostcodeAreas: postcodeAreas,
            leadMinVehicleValuePence: poundsToPence(minValue),
            leadMaxVehicleValuePence: poundsToPence(maxValue),
            leadMinVehicleYear: numberOrUndefined(minYear),
            leadMaxVehicleMileage: numberOrUndefined(maxMileage),
            ...(cap.serviceType === 'FINANCE' ? {
              leadMinAnnualIncomePence: poundsToPence(minIncome),
              leadFinanceTermMinMonths: numberOrUndefined(financeTermMin),
              leadFinanceTermMaxMonths: numberOrUndefined(financeTermMax),
            } : {}),
            ...(cap.serviceType === 'WARRANTY' ? {
              leadWarrantyLevels: warrantyLevels.split(',').map((v) => v.trim()).filter(Boolean),
              leadWarrantyMinMonths: numberOrUndefined(warrantyMin),
              leadWarrantyMaxMonths: numberOrUndefined(warrantyMax),
            } : {}),
          })
        : await updateJobMatching(cap.id, {
            jobNationwide: nationwide,
            jobPostcodeAreas: postcodeAreas,
          });
      hydrate(updated);
      Alert.alert('Saved', 'Matching settings have been updated.');
    } catch (err: any) {
      setError(err?.message || 'Could not save matching settings.');
    } finally {
      setBusy(false);
    }
  };

  const coverageDescription = useMemo(() => {
    if (!cap) return '';
    if (cap.serviceType === 'DELIVERY') return 'CarMazium will show vehicle transport and recovery jobs in the areas you cover.';
    if (cap.serviceType === 'INSPECTION') return 'CarMazium will show vehicle inspection work in the areas you cover.';
    return 'CarMazium will match customer enquiries against these rules.';
  }, [cap]);

  const field = (label: string, value: string, setter: (value: string) => void, placeholder: string, numeric = true) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setter}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={numeric ? 'number-pad' : 'default'}
        autoCapitalize={numeric ? 'none' : 'words'}
      />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.header}>
        <IconButton style={styles.headerButton} icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Matching settings</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View> : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{cap ? SERVICE_LABELS[cap.serviceType] : 'TradeXchange service'}</Text>
          <Text style={styles.sub}>{coverageDescription}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {cap ? (
            <>
              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Nationwide coverage</Text>
                    <Text style={styles.cardText}>Receive matching work from across the UK.</Text>
                  </View>
                  <Switch
                    value={nationwide}
                    onValueChange={setNationwide}
                    trackColor={{ false: Colors.borderMuted, true: Colors.accent }}
                    thumbColor={Colors.white}
                  />
                </View>
                {!nationwide ? (
                  <View style={styles.field}>
                    <Text style={styles.label}>UK POSTCODE AREAS</Text>
                    <TextInput
                      style={styles.input}
                      value={areas}
                      onChangeText={setAreas}
                      placeholder="B, CV, M, SW"
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="characters"
                    />
                    <Text style={styles.hint}>Use postcode areas, not full postcodes.</Text>
                  </View>
                ) : null}
              </View>

              {isLead ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Vehicle filters</Text>
                  {field('MINIMUM VEHICLE VALUE (£)', minValue, setMinValue, 'Optional')}
                  {field('MAXIMUM VEHICLE VALUE (£)', maxValue, setMaxValue, 'Optional')}
                  {field('MINIMUM VEHICLE YEAR', minYear, setMinYear, 'Optional')}
                  {field('MAXIMUM MILEAGE', maxMileage, setMaxMileage, 'Optional')}

                  {cap.serviceType === 'FINANCE' ? (
                    <>
                      <Text style={styles.cardTitle}>Finance filters</Text>
                      {field('MINIMUM ANNUAL INCOME (£)', minIncome, setMinIncome, 'Optional')}
                      {field('MINIMUM TERM (MONTHS)', financeTermMin, setFinanceTermMin, 'Optional')}
                      {field('MAXIMUM TERM (MONTHS)', financeTermMax, setFinanceTermMax, 'Optional')}
                    </>
                  ) : null}

                  {cap.serviceType === 'WARRANTY' ? (
                    <>
                      <Text style={styles.cardTitle}>Warranty filters</Text>
                      {field('WARRANTY LEVELS', warrantyLevels, setWarrantyLevels, 'Basic, Premium', false)}
                      {field('MINIMUM MONTHS', warrantyMin, setWarrantyMin, 'Optional')}
                      {field('MAXIMUM MONTHS', warrantyMax, setWarrantyMax, 'Optional')}
                    </>
                  ) : null}
                </View>
              ) : null}

              <TouchableOpacity style={[styles.primaryButton, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
                {busy ? <ActivityIndicator color={Colors.white} /> : <><Ionicons name="checkmark-circle-outline" size={17} color={Colors.white} /><Text style={styles.primaryText}>SAVE MATCHING SETTINGS</Text></>}
              </TouchableOpacity>
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
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.lg },
  content: { padding: 18, gap: 14 },
  title: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xl },
  sub: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  card: { borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, borderRadius: Radius.card, padding: 15, gap: 13 },
  cardTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.sm },
  cardText: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size11, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: { gap: 6 },
  label: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 0.8 },
  input: { borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.bgTertiary, borderRadius: Radius.inline, color: Colors.white, paddingHorizontal: 13, paddingVertical: 11, fontFamily: FontFamily.regular, fontSize: FontSize.sm },
  hint: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size10 },
  primaryButton: { minHeight: 48, borderRadius: Radius.inline, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size11 },
  error: { fontFamily: FontFamily.regular, color: Colors.paleRed_fca5a5, fontSize: FontSize.size12 },
});
