import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { createServiceLead } from '../../lib/servicesApi';

type LeadType = 'FINANCE' | 'WARRANTY';

const moneyToPence = (value: string) => {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
};

const numberValue = (value: string) => {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
};

export const ServiceLeadFormScreen: React.FC<{ navigation?: any; route?: any }> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const type: LeadType = route?.params?.serviceType === 'WARRANTY' ? 'WARRANTY' : 'FINANCE';
  const isFinance = type === 'FINANCE';

  const [registration, setRegistration] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');
  const [value, setValue] = useState('');
  const [postcode, setPostcode] = useState('');
  const [phone, setPhone] = useState('');
  const [summary, setSummary] = useState('');
  const [deposit, setDeposit] = useState('');
  const [term, setTerm] = useState('48');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [annualIncome, setAnnualIncome] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('12');
  const [warrantyLevel, setWarrantyLevel] = useState('Comprehensive');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => isFinance ? 'Vehicle Finance enquiry' : 'Warranty enquiry', [isFinance]);

  const submit = async () => {
    if (!registration.trim() && !(make.trim() && model.trim())) {
      Alert.alert('Vehicle details needed', 'Enter the registration or both vehicle make and model.');
      return;
    }
    if (!consent) {
      Alert.alert('Consent required', 'Confirm that matched approved providers may receive your contact details.');
      return;
    }
    if (isFinance) {
      if (!postcode.trim()) return Alert.alert('Postcode required', 'Enter the UK postcode for this finance enquiry.');
      if (!value.trim() || Number(value) <= 0) return Alert.alert('Vehicle value required', 'Enter the approximate vehicle value.');
      if (!employmentStatus.trim()) return Alert.alert('Employment status required', 'Enter your employment status.');
      if (Number(monthlyBudget || 0) <= 0 && Number(annualIncome || 0) <= 0) {
        return Alert.alert('Budget information required', 'Enter either a monthly budget or annual income.');
      }
    }

    setBusy(true);
    try {
      const lead = await createServiceLead({
        serviceType: type,
        vehicleRegistration: registration.trim() || undefined,
        vehicleMake: make.trim() || undefined,
        vehicleModel: model.trim() || undefined,
        vehicleYear: numberValue(year),
        vehicleMileage: numberValue(mileage),
        vehicleValuePence: moneyToPence(value),
        postcode: postcode.trim() || undefined,
        phone: phone.trim() || undefined,
        summary: summary.trim() || undefined,
        ...(isFinance ? {
          depositPence: moneyToPence(deposit),
          termMonths: numberValue(term),
          monthlyBudgetPence: moneyToPence(monthlyBudget),
          employmentStatus: employmentStatus.trim() || undefined,
          annualIncomePence: moneyToPence(annualIncome),
        } : {
          warrantyMonths: numberValue(warrantyMonths),
          warrantyLevel: warrantyLevel.trim() || undefined,
        }),
        consentToProviderContact: true,
      });
      navigation?.replace('CustomerServiceLeadDetail', { leadId: lead.id });
    } catch (error: any) {
      Alert.alert('Could not submit enquiry', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const input = (
    label: string,
    valueText: string,
    onChangeText: (value: string) => void,
    options?: { keyboardType?: 'default' | 'number-pad' | 'decimal-pad'; placeholder?: string; multiline?: boolean },
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, options?.multiline && styles.textArea]}
        value={valueText}
        onChangeText={onChangeText}
        placeholder={options?.placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={options?.keyboardType || 'default'}
        multiline={options?.multiline}
        textAlignVertical={options?.multiline ? 'top' : 'center'}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{ height: insets.top }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.iconButton} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Send one enquiry to approved matching {isFinance ? 'vehicle finance' : 'warranty'} providers. CarMazium does not decide finance eligibility or sell the warranty itself.
          </Text>

          <Text style={styles.sectionTitle}>Vehicle</Text>
          {input('Registration', registration, setRegistration, { placeholder: 'AB12 CDE' })}
          <View style={styles.row}>
            <View style={styles.half}>{input('Make', make, setMake, { placeholder: 'Toyota' })}</View>
            <View style={styles.half}>{input('Model', model, setModel, { placeholder: 'Yaris' })}</View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>{input('Year', year, setYear, { keyboardType: 'number-pad' })}</View>
            <View style={styles.half}>{input('Mileage', mileage, setMileage, { keyboardType: 'number-pad' })}</View>
          </View>
          {input('Approx. vehicle value (£)', value, setValue, { keyboardType: 'decimal-pad' })}

          <Text style={styles.sectionTitle}>{isFinance ? 'Finance preferences' : 'Warranty preferences'}</Text>
          {isFinance ? (
            <>
              <View style={styles.row}>
                <View style={styles.half}>{input('Deposit (£)', deposit, setDeposit, { keyboardType: 'decimal-pad' })}</View>
                <View style={styles.half}>{input('Term (months)', term, setTerm, { keyboardType: 'number-pad' })}</View>
              </View>
              {input('Monthly budget (£)', monthlyBudget, setMonthlyBudget, { keyboardType: 'decimal-pad' })}
              {input('Employment status', employmentStatus, setEmploymentStatus, { placeholder: 'Employed / Self-employed / Retired' })}
              {input('Annual income (£)', annualIncome, setAnnualIncome, { keyboardType: 'decimal-pad' })}
            </>
          ) : (
            <>
              {input('Warranty length (months)', warrantyMonths, setWarrantyMonths, { keyboardType: 'number-pad' })}
              {input('Cover level', warrantyLevel, setWarrantyLevel, { placeholder: 'Essential / Comprehensive / Premium' })}
            </>
          )}

          <Text style={styles.sectionTitle}>Contact & notes</Text>
          {input('Phone', phone, setPhone, { placeholder: 'Optional — account phone may be used' })}
          {input('Postcode', postcode, setPostcode, { placeholder: 'B19 1ES' })}
          {input('Anything providers should know?', summary, setSummary, { multiline: true })}

          <TouchableOpacity style={styles.consentRow} onPress={() => setConsent((current) => !current)} activeOpacity={0.8} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
            <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
              {consent && <Ionicons name="checkmark" size={15} color={Colors.white} />}
            </View>
            <Text style={styles.consentText}>
              I agree that CarMazium may share this enquiry and my contact details with matched, approved {isFinance ? 'vehicle finance' : 'warranty'} providers so they can respond.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submit, busy && styles.disabled]} disabled={busy} onPress={submit} accessibilityRole="button">
            <Text style={styles.submitText}>{busy ? 'Sending…' : 'Send enquiry to approved providers'}</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Provider responses are supplied by the provider. Review all eligibility, APR, regulated disclosures, policy wording, exclusions and claim limits before entering an agreement.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { minHeight: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingTop: 12 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 20 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 16, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgSecondary, color: Colors.textPrimary, paddingHorizontal: 14, fontSize: 14 },
  textArea: { minHeight: 110, paddingTop: 13 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  consentRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 14, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgSecondary },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: Colors.textMuted, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  consentText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  submit: { minHeight: 52, marginTop: 18, borderRadius: 13, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  submitText: { color: Colors.white, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: 0.55 },
  disclaimer: { marginTop: 16, color: Colors.textMuted, fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
});
