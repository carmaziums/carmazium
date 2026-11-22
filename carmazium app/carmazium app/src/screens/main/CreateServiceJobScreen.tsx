import React, { useEffect, useRef, useState } from 'react';
import { ScreenBackBar } from '../../components/ScreenBackBar';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { Elevation } from '../../constants/spacing';
import { apiClient } from '../../lib/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<MainStackParamList, 'CreateServiceJob'>;
type ServiceType = 'DELIVERY' | 'INSPECTION';
type VehicleDraft = { registration: string; make: string; model: string; year: string; notes: string };
const MAX_VEHICLES = 12;
const emptyVehicle = (): VehicleDraft => ({ registration: '', make: '', model: '', year: '', notes: '' });
const validYear = (year: string) => !year || (/^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 2100);
const safeText = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';
const postcodeValid = (value: string) => /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value.trim());

export const CreateServiceJobScreen: React.FC<Props> = ({ navigation, route }) => {
  const serviceType: ServiceType = route.params.serviceType;
  const delivery = serviceType === 'DELIVERY';
  const purchase = route.params.purchase;
  const userId = useAuthStore(state => state.user?.id);
  const draftKey = userId ? `tradexchange:job-draft:${userId}:${serviceType}` : null;
  const [draftOwner, setDraftOwner] = useState<string | null>(null);
  const draftReady = Boolean(draftKey && draftOwner === draftKey);
  const pendingWrites = useRef<Promise<unknown>>(Promise.resolve());
  const posted = useRef(false);
  const [title, setTitle] = useState(purchase ? `${purchase.title} delivery` : delivery ? '' : 'Pre-purchase vehicle inspection');
  const [description, setDescription] = useState('');
  const [vehicles, setVehicles] = useState<VehicleDraft[]>([{
    ...emptyVehicle(),
    registration: purchase?.registration || '',
    make: purchase?.make || '',
    model: purchase?.model || '',
  }]);
  const [pickup, setPickup] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [destination, setDestination] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [address, setAddress] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [asap, setAsap] = useState(true);
  const [requestedFor, setRequestedFor] = useState<Date | null>(null);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [pickerVisible, setPickerVisible] = useState(false);
  const updateVehicle = (index: number, patch: Partial<VehicleDraft>) =>
    setVehicles(current => current.map((vehicle, i) => i === index ? { ...vehicle, ...patch } : vehicle));
  const addVehicle = () => setVehicles(current => current.length < MAX_VEHICLES ? [...current, emptyVehicle()] : current);
  const removeVehicle = (index: number) =>
    setVehicles(current => current.length > 1 ? current.filter((_, i) => i !== index) : current);
  // Drafts are local and user-scoped; old account drafts cannot appear on another login.
  useEffect(() => {
    let cancelled = false;
    setDraftOwner(null);
    // Do not retain a previous account's or service's values while restoring.
    setTitle(purchase ? `${purchase.title} delivery` : delivery ? '' : 'Pre-purchase vehicle inspection');
    setDescription('');
    setVehicles([{ ...emptyVehicle(), registration: purchase?.registration || '',
      make: purchase?.make || '', model: purchase?.model || '' }]);
    setPickup(''); setPickupAddress(''); setDestination('');
    setDeliveryAddress(''); setAddress(''); setRecovery(false);
    setAsap(true); setRequestedFor(null);
    if (!draftKey) return;
    if (purchase) { setDraftOwner(draftKey); return; }
    void AsyncStorage.getItem(draftKey).then(raw => {
      if (cancelled) return;
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Record<string, unknown>;
          if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
            setTitle(safeText(saved.title, 120) || (delivery ? '' : 'Pre-purchase vehicle inspection'));
            setDescription(safeText(saved.description, 2000));
            setPickup(safeText(saved.pickup, 10));
            setPickupAddress(safeText(saved.pickupAddress, 300));
            setDestination(safeText(saved.destination, 10));
            setDeliveryAddress(safeText(saved.deliveryAddress, 300));
            setAddress(safeText(saved.address, 300));
            setRecovery(saved.recovery === true);
            setAsap(saved.asap !== false);
            const date = typeof saved.requestedFor === 'string' ? new Date(saved.requestedFor) : null;
            setRequestedFor(date && Number.isFinite(date.getTime()) ? date : null);
            if (Array.isArray(saved.vehicles)) {
              const restored = saved.vehicles.slice(0, delivery ? MAX_VEHICLES : 1).map((item: unknown) => {
                const v = item && typeof item === 'object' ? item as Record<string, unknown> : {};
                return { registration: safeText(v.registration, 10), make: safeText(v.make, 60),
                  model: safeText(v.model, 60), year: safeText(v.year, 4), notes: safeText(v.notes, 300) };
              });
              if (restored.length) setVehicles(restored);
            }
          }
        } catch { /* Ignore a corrupt local draft. */ }
      }
      setDraftOwner(draftKey);
    }).catch(() => { if (!cancelled) setDraftOwner(draftKey); });
    return () => { cancelled = true; };
  }, [draftKey, delivery, purchase]);

  useEffect(() => {
    if (!draftReady || !draftKey || posted.current) return;
    const snapshot = JSON.stringify({ title, description, vehicles, pickup, pickupAddress, destination,
      deliveryAddress, address, recovery, asap, requestedFor: requestedFor?.toISOString() ?? null });
    const timer = setTimeout(() => {
      pendingWrites.current = pendingWrites.current.catch(() => {}).then(() => AsyncStorage.setItem(draftKey, snapshot));
    }, 350);
    return () => clearTimeout(timer);
  }, [draftReady, draftKey, title, description, vehicles, pickup, pickupAddress,
    destination, deliveryAddress, address, recovery, asap, requestedFor]);

  const openDatePicker = () => { setPickerMode('date'); setPickerVisible(true); };
  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') { setPickerVisible(false); return; }
    if (selected) {
      const next = new Date(selected);
      if (pickerMode === 'date' && requestedFor) next.setHours(requestedFor.getHours(), requestedFor.getMinutes(), 0, 0);
      setRequestedFor(next);
      setAsap(false);
    }
    if (Platform.OS === 'android' && pickerMode === 'date') {
      setPickerMode('time');
      setPickerVisible(true);
    } else setPickerVisible(false);
  };

  const field = (label: string, value: string, setValue: (value: string) => void, hint?: string, multiline = false, maxLength = 300) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, multiline && { height: 96, textAlignVertical: 'top' }]} value={value} onChangeText={setValue}
        placeholder={hint} placeholderTextColor={Colors.textMuted} multiline={multiline} maxLength={maxLength} autoCapitalize="sentences" />
    </View>
  );
  const submit = async () => {
    if (saving || !draftReady) return;
    if (!title.trim()) {
      Alert.alert('Missing information', 'Enter a short job title.');
      return;
    }
    const incomplete = vehicles.findIndex(vehicle =>
      !vehicle.registration.trim() && !(vehicle.make.trim() && vehicle.model.trim()));
    if (incomplete !== -1) {
      Alert.alert('Vehicle details needed', `Vehicle ${incomplete + 1} needs a registration or both make and model.`);
      return;
    }
    const invalidYear = vehicles.findIndex(v => !validYear(v.year));
    if (invalidYear !== -1) {
      Alert.alert('Check vehicle year', `Vehicle ${invalidYear + 1} needs a year between 1900 and 2100.`);
      return;
    }
    if (!vehicles.length || vehicles.length > MAX_VEHICLES || (!delivery && vehicles.length !== 1)) {
      Alert.alert('Check vehicles', 'Delivery supports 1–12 vehicles. Inspection requires one.');
      return;
    }
    if (!asap && (!requestedFor || !Number.isFinite(requestedFor.getTime()) || requestedFor.getTime() <= Date.now())) {
      Alert.alert('Check date and time', 'Choose a future date and time, or select As soon as possible.');
      return;
    }
    if (!postcodeValid(delivery ? pickup : destination) || (delivery && !postcodeValid(destination))) {
      Alert.alert('Check postcode', 'Enter valid UK postcodes for the job location.');
      return;
    }
    setSaving(true);
    try {
      const result = await apiClient<{ data: { id: string } }>('/services/jobs', {
        method: 'POST',
        body: JSON.stringify({
          serviceType,
          title: title.trim(),
          description: description.trim() || undefined,
          requestedFor: asap ? undefined : requestedFor!.toISOString(),
          ...(delivery
            ? {
                pickupPostcode: pickup.trim().toUpperCase(),
                pickupAddress: pickupAddress.trim() || undefined,
                deliveryPostcode: destination.trim().toUpperCase(),
                deliveryAddress: deliveryAddress.trim() || undefined,
                isRecovery: recovery,
              }
            : { servicePostcode: destination.trim().toUpperCase(), serviceAddress: address.trim() || undefined }),
          vehicles: vehicles.map((vehicle, index) => ({
            ...(index === 0 && purchase?.listingId ? { listingId: purchase.listingId } : {}),
            registration: vehicle.registration.replace(/\s+/g, '').toUpperCase() || undefined,
            make: vehicle.make.trim() || undefined,
            model: vehicle.model.trim() || undefined,
            year: vehicle.year ? Number(vehicle.year) : undefined,
            notes: vehicle.notes.trim() || undefined,
          })),
        }),
        timeoutMs: 30000,
      });
      // The website takes customers straight to the new job. Do the same in
      // the existing Android app rather than forcing a detour via My Jobs.
      posted.current = true;
      if (draftKey) {
        // Clear after any in-flight autosave; a successful job must not reappear.
        pendingWrites.current = pendingWrites.current.catch(() => {}).then(() => AsyncStorage.removeItem(draftKey));
        await pendingWrites.current.catch(() => {});
      }
      if (result?.data?.id) navigation.replace('CustomerServiceJobDetail', { jobId: result.data.id });
      else navigation.replace('CustomerServiceJobs');
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
      <Text style={styles.title}>{delivery ? 'Post Delivery & Recovery Job' : 'Post Vehicle Inspection Job'}</Text>
      <Text style={styles.subtitle}>Approved providers can quote for your request. No provider is booked until you accept a quote.</Text>
      {field('Job title *', title, setTitle, delivery ? 'Transport my vehicle' : 'Pre-purchase vehicle inspection', false, 120)}
      {vehicles.map((vehicle, index) => (
        <View key={index} style={styles.vehicleCard}>
          <View style={styles.vehicleHeader}>
            <Text style={styles.vehicleHeading}>Vehicle {index + 1}</Text>
            {delivery && vehicles.length > 1 && (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove vehicle ${index + 1}`}
                onPress={() => removeVehicle(index)} disabled={saving}>
                <Text style={styles.removeVehicle}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          {field('Registration (or make and model)', vehicle.registration, value => updateVehicle(index, { registration: value }), 'AB12 CDE', false, 10)}
          {field('Make', vehicle.make, value => updateVehicle(index, { make: value }), 'Vehicle make', false, 60)}
          {field('Model', vehicle.model, value => updateVehicle(index, { model: value }), 'Vehicle model', false, 60)}
          {field('Year', vehicle.year, value => updateVehicle(index, { year: value.replace(/[^0-9]/g, '').slice(0, 4) }), '2021', false, 4)}
          {field('Vehicle notes', vehicle.notes, value => updateVehicle(index, { notes: value }), 'Condition, access or equipment', false, 300)}
        </View>
      ))}
      {delivery && vehicles.length < MAX_VEHICLES && (
        <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={addVehicle} style={styles.addVehicle}>
          <Text style={styles.addVehicleText}>+ Add another vehicle</Text>
        </TouchableOpacity>
      )}
      {delivery ? (
        <>
          {field('Collection postcode *', pickup, setPickup, 'B19 1ES', false, 10)}
          {field('Collection address (optional)', pickupAddress, setPickupAddress, 'Shared with the chosen provider')}
          {field('Delivery postcode *', destination, setDestination, 'SW1A 1AA', false, 10)}
          {field('Delivery address (optional)', deliveryAddress, setDeliveryAddress, 'Shared with the chosen provider')}
          <View style={styles.toggle}><Text style={styles.label}>Vehicle requires recovery</Text><Switch value={recovery} onValueChange={setRecovery} /></View>
        </>
      ) : (
        <>
          {field('Inspection postcode *', destination, setDestination, 'B19 1ES', false, 10)}
          {field('Inspection address', address, setAddress, 'Optional location details')}
        </>
      )}
      <View style={styles.whenCard}>
        <Text style={styles.label}>When is the work needed?</Text>
        <View style={styles.toggle}><Text style={styles.label}>As soon as possible</Text>
          <Switch value={asap} onValueChange={setAsap} accessibilityLabel="As soon as possible" /></View>
        {!asap && (
          <TouchableOpacity accessibilityRole="button" onPress={openDatePicker} style={styles.addVehicle}
            accessibilityLabel="Choose preferred date and time">
            <Text style={styles.addVehicleText}>{requestedFor ? requestedFor.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Choose future date and time'}</Text>
          </TouchableOpacity>
        )}
        {((Platform.OS === 'ios' && !asap) || pickerVisible) && (
          <DateTimePicker value={requestedFor ?? new Date(Date.now() + 24 * 60 * 60 * 1000)}
            mode={Platform.OS === 'ios' ? 'datetime' : pickerMode} minimumDate={new Date()}
            onChange={onDateChange} display={Platform.OS === 'ios' ? 'spinner' : 'default'} />
        )}
      </View>
      {field('Additional details', description, setDescription, 'Condition, availability and special instructions', true, 2000)}
      <TouchableOpacity accessibilityRole="button" disabled={saving || !draftReady} onPress={() => void submit()} style={[styles.submit, (saving || !draftReady) && { opacity: 0.6 }]}>
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
  whenCard: { gap: 12, borderColor: Colors.borderSubtle, borderWidth: 1, borderRadius: 12, padding: 14 },
  vehicleCard: { borderColor: Colors.borderSubtle, borderWidth: 1, borderRadius: 12, padding: 12, gap: 12, backgroundColor: Colors.bgCardSolid },
  vehicleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vehicleHeading: { fontSize: 16, fontWeight: '700', color: Colors.white },
  removeVehicle: { color: Colors.warning, fontWeight: '700' },
  addVehicle: { borderColor: Colors.accent, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  addVehicleText: { color: Colors.accent, fontWeight: '700' },
  submit: { borderRadius: 12, backgroundColor: Colors.accent, padding: 17, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: Colors.accentDark, ...Elevation.neon },
  submitText: { color: Colors.onAccent, fontWeight: '700' },
});
