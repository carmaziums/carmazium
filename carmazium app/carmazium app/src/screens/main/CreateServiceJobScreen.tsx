import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/apiClient';

type Props = NativeStackScreenProps<MainStackParamList, 'CreateServiceJob'>;
type ServiceType = 'DELIVERY' | 'INSPECTION';
const postcodeValid = (value: string) => /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value.trim());

export const CreateServiceJobScreen: React.FC<Props> = ({ navigation, route }) => {
  const serviceType: ServiceType = route.params.serviceType;
  const delivery = serviceType === 'DELIVERY';
  const purchase = route.params.purchase;
  const [title, setTitle] = useState(purchase ? `${purchase.title} delivery` : '');
  const [description, setDescription] = useState('');
  const [registration, setRegistration] = useState(purchase?.registration || '');
  const [make, setMake] = useState(purchase?.make || '');
  const [model, setModel] = useState(purchase?.model || '');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [address, setAddress] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [saving, setSaving] = useState(false);
  const field = (label: string, value: string, setValue: (value: string) => void, hint?: string, multiline = false) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, multiline && { height: 96, textAlignVertical: 'top' }]} value={value} onChangeText={setValue}
        placeholder={hint} placeholderTextColor={Colors.textMuted} multiline={multiline} autoCapitalize="sentences" />
    </View>
  );
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
    setSaving(true);
    try {
      await apiClient('/services/jobs', {
        method: 'POST',
        body: JSON.stringify({
          serviceType,
          title: title.trim(),
          description: description.trim() || undefined,
          ...(delivery
            ? { pickupPostcode: pickup.trim().toUpperCase(), deliveryPostcode: destination.trim().toUpperCase(), isRecovery: recovery }
            : { servicePostcode: destination.trim().toUpperCase(), serviceAddress: address.trim() || undefined }),
          vehicles: [{
            listingId: purchase?.listingId,
            registration: registration.replace(/\s+/g, '').toUpperCase() || undefined,
            make: make.trim() || undefined,
            model: model.trim() || undefined,
          }],
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{delivery ? 'Post Delivery & Recovery Job' : 'Post Vehicle Inspection Job'}</Text>
      <Text style={styles.subtitle}>Approved providers can quote for your request. No provider is booked until you accept a quote.</Text>
      {field('Job title *', title, setTitle, delivery ? 'Transport my vehicle' : 'Pre-purchase vehicle inspection')}
      {field('Registration *', registration, setRegistration, 'AB12 CDE')}
      {field('Make', make, setMake, 'Vehicle make')}
      {field('Model', model, setModel, 'Vehicle model')}
      {delivery ? (
        <>
          {field('Collection postcode *', pickup, setPickup, 'B19 1ES')}
          {field('Delivery postcode *', destination, setDestination, 'SW1A 1AA')}
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
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Post a Job</Text>}
      </TouchableOpacity>
    </ScrollView>
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
  submit: { borderRadius: 12, backgroundColor: Colors.accent, padding: 17, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700' },
});
