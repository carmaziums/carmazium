import React, { useState } from 'react';
import { ScreenBackBar } from '../../components/ScreenBackBar';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { Elevation } from '../../constants/spacing';
import { apiClient } from '../../lib/apiClient';

type Props = NativeStackScreenProps<MainStackParamList, 'CreateServiceJob'>;
type ServiceType = 'DELIVERY' | 'INSPECTION';
type VehicleDraft = { registration: string; make: string; model: string; notes: string };
const emptyVehicle = (): VehicleDraft => ({ registration: '', make: '', model: '', notes: '' });
const postcodeValid = (value: string) => /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value.trim());

export const CreateServiceJobScreen: React.FC<Props> = ({ navigation, route }) => {
  const serviceType: ServiceType = route.params.serviceType;
  const delivery = serviceType === 'DELIVERY';
  const purchase = route.params.purchase;
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
  const updateVehicle = (index: number, patch: Partial<VehicleDraft>) =>
    setVehicles(current => current.map((vehicle, i) => i === index ? { ...vehicle, ...patch } : vehicle));
  const addVehicle = () => setVehicles(current => [...current, emptyVehicle()]);
  const removeVehicle = (index: number) =>
    setVehicles(current => current.length > 1 ? current.filter((_, i) => i !== index) : current);
  const field = (label: string, value: string, setValue: (value: string) => void, hint?: string, multiline = false) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, multiline && { height: 96, textAlignVertical: 'top' }]} value={value} onChangeText={setValue}
        placeholder={hint} placeholderTextColor={Colors.textMuted} multiline={multiline} autoCapitalize="sentences" />
    </View>
  );
  const submit = async () => {
    if (saving) return;
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
            registration: vehicle.registration.replace(/\\s+/g, '').toUpperCase() || undefined,
            make: vehicle.make.trim() || undefined,
            model: vehicle.model.trim() || undefined,
            notes: vehicle.notes.trim() || undefined,
          })),
        }),
        timeoutMs: 30000,
      });
      // The website takes customers straight to the new job. Do the same in
      // the existing Android app rather than forcing a detour via My Jobs.
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
      {field('Job title *', title, setTitle, delivery ? 'Transport my vehicle' : 'Pre-purchase vehicle inspection')}
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
          {field('Registration (or make and model)', vehicle.registration, value => updateVehicle(index, { registration: value }), 'AB12 CDE')}
          {field('Make', vehicle.make, value => updateVehicle(index, { make: value }), 'Vehicle make')}
          {field('Model', vehicle.model, value => updateVehicle(index, { model: value }), 'Vehicle model')}
          {field('Vehicle notes', vehicle.notes, value => updateVehicle(index, { notes: value }), 'Condition, access or equipment')}
        </View>
      ))}
      {delivery && (
        <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={addVehicle} style={styles.addVehicle}>
          <Text style={styles.addVehicleText}>+ Add another vehicle</Text>
        </TouchableOpacity>
      )}
      {delivery ? (
        <>
          {field('Collection postcode *', pickup, setPickup, 'B19 1ES')}
          {field('Collection address (optional)', pickupAddress, setPickupAddress, 'Shared with the chosen provider')}
          {field('Delivery postcode *', destination, setDestination, 'SW1A 1AA')}
          {field('Delivery address (optional)', deliveryAddress, setDeliveryAddress, 'Shared with the chosen provider')}
          <View style={styles.toggle}><Text style={styles.label}>Vehicle requires recovery</Text><Switch value={recovery} onValueChange={setRecovery} /></View>
        </>
      ) : (
        <>
          {field('Inspection postcode *', destination, setDestination, 'B19 1ES')}
          {field('Inspection address', address, setAddress, 'Optional location details')}
        </>
      )}
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
  vehicleCard: { borderColor: Colors.borderSubtle, borderWidth: 1, borderRadius: 12, padding: 12, gap: 12, backgroundColor: Colors.bgCardSolid },
  vehicleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vehicleHeading: { fontSize: 16, fontWeight: '700', color: Colors.white },
  removeVehicle: { color: Colors.warning, fontWeight: '700' },
  addVehicle: { borderColor: Colors.accent, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  addVehicleText: { color: Colors.accent, fontWeight: '700' },
  submit: { borderRadius: 12, backgroundColor: Colors.accent, padding: 17, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: Colors.accentDark, ...Elevation.neon },
  submitText: { color: Colors.onAccent, fontWeight: '700' },
});
