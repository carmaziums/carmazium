import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useRef, useState } from 'react';
import { ScreenBackBar } from '../../components/ScreenBackBar';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { Elevation } from '../../constants/spacing';
import { apiClient } from '../../lib/apiClient';
import type { InspectionScope } from '../../lib/servicesApi';

type Props = NativeStackScreenProps<MainStackParamList, 'CreateServiceJob'>;
type DeliveryVehicle = { registration: string; make: string; model: string; year: string; notes: string };
type ServiceType = 'DELIVERY' | 'INSPECTION';
const postcodeValid = (value: string) => /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value.trim());

export const CreateServiceJobScreen: React.FC<Props> = ({ navigation, route }) => {
  const serviceType: ServiceType = route.params.serviceType;
  const delivery = serviceType === 'DELIVERY';
  const purchase = route.params.purchase;
  const [title, setTitle] = useState(purchase ? `${purchase.title} ${delivery ? 'delivery' : 'inspection'}` : '');
  const [description, setDescription] = useState('');
  const [registration, setRegistration] = useState(purchase?.registration || '');
  const [make, setMake] = useState(purchase?.make || '');
  const [model, setModel] = useState(purchase?.model || '');
  const [year, setYear] = useState(String(purchase?.year ?? ''));
  const [notes, setNotes] = useState('');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [address, setAddress] = useState(purchase?.location || '');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [requestedFor, setRequestedFor] = useState<Date | null>(null);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [draftDate, setDraftDate] = useState(new Date());
  const nextVehicleKey = useRef(0);
  const [additionalVehicles, setAdditionalVehicles] = useState<(DeliveryVehicle & { key: number })[]>([]);
  const [recovery, setRecovery] = useState(false);
  const [inspectionScope, setInspectionScope] = useState<InspectionScope>('VEHICLE');
  const [additionalRegistrations, setAdditionalRegistrations] = useState('');
  const [saving, setSaving] = useState(false);
  const field = (label: string, value: string, setValue: (value: string) => void, hint?: string, multiline = false, inputProps?: Pick<React.ComponentProps<typeof TextInput>, 'keyboardType' | 'maxLength'>) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} accessibilityLabel={label} style={[styles.input, multiline && { height: 96, textAlignVertical: 'top' }]} value={value} onChangeText={setValue}
        placeholder={hint} placeholderTextColor={Colors.textMuted} multiline={multiline} autoCapitalize="sentences" />
    </View>
  );
  const yearField = (value: string, change: (value: string) => void) =>
    field('Year', value, change, 'Vehicle year', false, { keyboardType: 'number-pad', maxLength: 4 });
  const notesField = (value: string, change: (value: string) => void) =>
    field('Transport notes', value, change, 'For example, no keys, low clearance or a flat tyre', false, { maxLength: 300 });
  const updateVehicle = (key: number, property: keyof DeliveryVehicle, value: string) =>
    setAdditionalVehicles(items => items.map(item => item.key === key ? { ...item, [property]: value } : item));
  const submit = async () => {
    if (saving) return;
    if (!title.trim() || (!registration.trim() && !(make.trim() && model.trim()))) {
      Alert.alert('Missing information', 'Enter a job title and vehicle registration or make and model.');
      return;
    }
    if (!postcodeValid(delivery ? pickup : destination) || (delivery && !postcodeValid(destination))) {
      Alert.alert('Check postcode', 'Enter valid UK postcodes for the job location.');
      return;
    }
    const extraRegs = delivery ? [] : additionalRegistrations.split(/[\n,]+/).map(v => v.trim().replace(/\s+/g, '').toUpperCase()).filter(Boolean);
    if (extraRegs.length > 4 || extraRegs.some(v => !/^[A-Z0-9]{2,10}$/.test(v))) {
      Alert.alert('Check batch registrations', 'Enter at most four additional registrations, one per line.');
      return;
    }
    if (delivery && additionalVehicles.some(v => !v.registration.trim() && !(v.make.trim() && v.model.trim()))) {
      Alert.alert('Check vehicles', 'Each vehicle needs a registration or both its make and model.');
      return;
    }
    if (delivery && [year, ...additionalVehicles.map(v => v.year)].some(value =>
      value !== '' && (!/^\d{4}$/.test(value) || Number(value) < 1900 || Number(value) > 2100))) {
      Alert.alert('Check vehicle year', 'Enter a year between 1900 and 2100 or leave it blank.');
      return;
    }
    if (requestedFor && requestedFor.getTime() <= Date.now()) {
      Alert.alert('Check date', 'Choose a date and time in the future.');
      return;
    }
    const deliveryVehicles = additionalVehicles.map(v => ({
      registration: v.registration.replace(/\s+/g, '').toUpperCase() || undefined,
      make: v.make.trim() || undefined,
      model: v.model.trim() || undefined,
      year: v.year ? Number(v.year) : undefined,
      notes: v.notes.trim() || undefined,
    }));
    const allRegs = [registration.replace(/\s+/g, '').toUpperCase(), ...extraRegs, ...deliveryVehicles.map(v => v.registration)].filter(Boolean);
    if (new Set(allRegs).size !== allRegs.length) {
      Alert.alert('Duplicate vehicles', 'Each vehicle registration must be different.');
      return;
    }
    setSaving(true);
    try {
      await apiClient('/services/jobs', {
        method: 'POST',
        body: JSON.stringify({
          serviceType,
          ...(delivery ? {} : { inspectionScope }),
          title: title.trim(),
          requestedFor: requestedFor?.toISOString(),
          description: description.trim() || undefined,
          ...(delivery
            ? { deliveryAddress: dropoffAddress.trim() || undefined, pickupAddress: address.trim() || undefined, pickupPostcode: pickup.trim().toUpperCase(), deliveryPostcode: destination.trim().toUpperCase(), isRecovery: recovery }
            : { servicePostcode: destination.trim().toUpperCase(), serviceAddress: address.trim() || undefined }),
          vehicles: [{
            listingId: purchase?.listingId,
            ...(delivery
              ? { year: year ? Number(year) : undefined, notes: notes.trim() || undefined }
              : { year: purchase?.year ?? undefined }),
            registration: registration.replace(/\s+/g, '').toUpperCase() || undefined,
            make: make.trim() || undefined,
            model: model.trim() || undefined,
          }, ...deliveryVehicles, ...extraRegs.map(registration => ({ registration }))],
        }),
        timeoutMs: 30000,
      });
      Alert.alert('Job posted', 'Your request has been submitted. You can view provider quotes under My service jobs.', [
        { text: 'View jobs', onPress: () => navigation.replace('CustomerServiceJobs') },
      ]);
    } catch (error: any) {
      Alert.alert('Could not post job', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={styles.container}>
    <ScreenBackBar title="TradeXchange" forceSafeArea />
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{delivery ? 'Post Delivery & Recovery Job' : 'Request an Inspection'}</Text>
      <Text style={styles.subtitle}>Approved providers can quote for your request. No provider is booked until you accept a quote.</Text>
      {!delivery ? (
        <View style={styles.field}>
          <Text style={styles.label}>INSPECTION TYPE *</Text>
          {([
            { value: 'VEHICLE', label: 'Vehicle inspection', hint: 'Mechanical and functional checks' },
            { value: 'COSMETIC', label: 'Cosmetic inspection', hint: 'Paintwork, bodywork and visible damage' },
            { value: 'BOTH', label: 'Both', hint: 'Vehicle and cosmetic inspection checks' },
          ] as const).map((option) => (
            <TouchableOpacity key={option.value} accessibilityRole="radio" accessibilityState={{ checked: inspectionScope === option.value }} onPress={() => setInspectionScope(option.value)} style={[styles.input, inspectionScope === option.value && { borderColor: Colors.accent, borderWidth: 2 }] }>
              <Text style={[styles.label, { color: Colors.white }]}>{inspectionScope === option.value ? '● ' : '○ '}{option.label}</Text>
              <Text style={styles.subtitle}>{option.hint}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.subtitle}>Cosmetic checks are not a mechanical or structural safety certificate. Only available in provider coverage areas.</Text>
        </View>
      ) : null}
      {field('Job title *', title, setTitle, delivery ? 'Transport my vehicle' : 'Pre-purchase vehicle inspection')}
      {field('Registration (or enter make and model)', registration, setRegistration, 'AB12 CDE')}
      {field('Make', make, setMake, 'Vehicle make')}
      {field('Model', model, setModel, 'Vehicle model')}
      {delivery ? (
        <>
          {yearField(year, setYear)}
          {notesField(notes, setNotes)}
          {field('Collection address', address, setAddress, 'Optional location details')}
          {field('Collection postcode *', pickup, setPickup, 'B19 1ES')}
          {field('Delivery address', dropoffAddress, setDropoffAddress, 'Optional destination details')}
          {field('Delivery postcode *', destination, setDestination, 'SW1A 1AA')}
          {additionalVehicles.map((vehicle, index) => (
            <View key={vehicle.key} style={styles.field}>
              <Text style={styles.label}>Vehicle {index + 2}</Text>
              {(['registration', 'make', 'model'] as const).map(key => (
                <View key={key}>{field(key === 'registration' ? 'Registration (or enter make and model)' : key === 'make' ? 'Make' : 'Model',
                  vehicle[key], value => updateVehicle(vehicle.key, key, value))}</View>
              ))}
              {yearField(vehicle.year, value => updateVehicle(vehicle.key, 'year', value))}
              {notesField(vehicle.notes, value => updateVehicle(vehicle.key, 'notes', value))}
              <TouchableOpacity accessibilityRole="button" onPress={() => setAdditionalVehicles(items => items.filter(item => item.key !== vehicle.key))}>
                <Text style={styles.label}>Remove vehicle {index + 2}</Text>
              </TouchableOpacity>
            </View>
          ))}
          {additionalVehicles.length < 11 && (
            <TouchableOpacity accessibilityRole="button" onPress={() => {
              const vehicle = { key: nextVehicleKey.current++, registration: '', make: '', model: '', year: '', notes: '' };
              setAdditionalVehicles(items => [...items, vehicle]);
            }}><Text style={styles.label}>Add another vehicle</Text></TouchableOpacity>
          )}
          <View style={styles.toggle}><Text style={styles.label}>Vehicle requires recovery</Text><Switch value={recovery} onValueChange={setRecovery} /></View>
        </>
      ) : (
        <>
          {field('Inspection postcode *', destination, setDestination, 'B19 1ES')}
          {field('Inspection address', address, setAddress, 'Optional location details')}
          {field('Additional registrations (optional)', additionalRegistrations, setAdditionalRegistrations, 'Up to four more vehicles, separated by commas or new lines', true)}
          <Text style={styles.subtitle}>You can request one quote for up to five vehicles at the same location.</Text>
        </>
      )}
      <View style={styles.field}>
        <Text style={styles.label}>Preferred date and time</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => {
          setDraftDate(requestedFor ?? new Date());
          setPickerMode('date');
        }}><Text style={styles.input}>{requestedFor?.toLocaleString('en-GB') ?? 'As soon as possible · choose a time'}</Text></TouchableOpacity>
        {requestedFor && <TouchableOpacity accessibilityRole="button" onPress={() => setRequestedFor(null)}>
          <Text style={styles.label}>Use as soon as possible</Text>
        </TouchableOpacity>}
        {pickerMode && <DateTimePicker key={pickerMode} value={draftDate} mode={pickerMode}
          minimumDate={pickerMode === 'date' ? new Date() : undefined} onChange={(event, value) => {
            if (event.type !== 'set' || !value) { setPickerMode(null); return; }
            if (pickerMode === 'date') { setDraftDate(value); setPickerMode('time'); return; }
            setRequestedFor(value);
            setPickerMode(null);
          }} />}
      </View>
      {field('Additional details', description, setDescription, 'Condition, availability and special instructions', true)}
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => void submit()} style={[styles.submit, saving && { opacity: 0.6 }]}>
        {saving ? <ActivityIndicator color={Colors.onAccent} /> : <Text style={styles.submitText}>Post a Job</Text>}
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { padding: 20, gap: 18, paddingBottom: 50 },
  title: { fontSize: 23, fontWeight: '700', color: Colors.white },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },
  field: { gap: 7 },
  label: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  input: { borderColor: Colors.borderSubtle, borderWidth: 1, borderRadius: 12, color: Colors.white, backgroundColor: Colors.bgCardSolid, padding: 14, minHeight: 50 },
  toggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  submit: { borderRadius: 12, backgroundColor: Colors.accent, padding: 17, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: Colors.accentDark, ...Elevation.neon },
  submitText: { color: Colors.onAccent, fontWeight: '700' },
});
