import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../constants/colors';
import { getServiceSettings, type ServiceMarketplaceSettings, type ServiceType } from '../lib/servicesApi';
import type { MainStackParamList } from '../navigation/MainStackNavigator';
import { useAuthStore } from '../store/authStore';

type Vehicle = {
  id: string; title: string; vrm?: string | null; make?: string | null;
  model?: string | null; year?: number | null; location?: string | null;
};

const labels: Record<ServiceType, string> = {
  INSPECTION: 'Request an inspection', DELIVERY: 'Get delivery quotes',
  WARRANTY: 'Get a warranty quote', FINANCE: 'Explore finance',
};

export function VehicleServiceActions({ vehicle, auction = false, finance = false }: {
  vehicle: Vehicle; auction?: boolean; finance?: boolean;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const signedIn = useAuthStore(state => !!state.user);
  const [settings, setSettings] = useState<ServiceMarketplaceSettings | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    getServiceSettings().then(result => { if (active) setSettings(result); }).catch(() => {});
    return () => { active = false; };
  }, [signedIn]);
  if (signedIn && !settings) return null;
  const services: ServiceType[] = auction ? ['INSPECTION'] : ['INSPECTION', 'DELIVERY', 'WARRANTY'];
  if (!auction && finance) services.push('FINANCE');
  const available = services.filter(service => settings?.availability?.[service] !== false);
  if (!available.length) return null;

  function open(service: ServiceType) {
    const isJob = service === 'DELIVERY' || service === 'INSPECTION';
    if (isJob && signedIn) {
      navigation.navigate('CreateServiceJob', {
        serviceType: service,
        purchase: {
          listingId: vehicle.id, title: vehicle.title, registration: vehicle.vrm,
          make: vehicle.make, model: vehicle.model, year: vehicle.year, location: vehicle.location,
        },
      });
      return;
    }
    const params = new URLSearchParams({ listingId: vehicle.id });
    if (isJob) {
      params.set('vehicleTitle', vehicle.title);
      if (vehicle.vrm) params.set('registration', vehicle.vrm);
      if (vehicle.make) params.set('make', vehicle.make);
      if (vehicle.model) params.set('model', vehicle.model);
      if (vehicle.year) params.set('year', String(vehicle.year));
      if (vehicle.location) params.set('pickup', vehicle.location);
    }
    const path = service.toLowerCase() + (isJob ? '/new' : '');
    void WebBrowser.openBrowserAsync(`https://www.carmazium.com/services/${path}?${params}`)
      .catch(() => Alert.alert('Could not open service', 'Please try again.'));
  }

  return (
    <View style={styles.group}>
      <Text style={styles.heading}>Services for this vehicle</Text>
      {available.map(service => (
        <TouchableOpacity key={service} accessibilityRole="button" style={styles.button} onPress={() => open(service)}>
          <Text style={styles.label}>{labels[service]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  group: { marginVertical: 12, padding: 12, gap: 8, backgroundColor: Colors.bgCardSolid, borderRadius: 12 },
  heading: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  button: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 8 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
});
