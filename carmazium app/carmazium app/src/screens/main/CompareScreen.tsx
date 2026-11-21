import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { PublicInfoPage, infoStyles as s } from '../../components/PublicInfoPage';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/colors';
import { CarListing } from '../../data/listings';
import { searchListings } from '../../lib/listingsApi';
import { FUEL_TYPE_LABELS, TRANSMISSION_LABELS } from '../../lib/vehicleLabels';

type Mode = 'lowest' | 'highest';
type Row = { label: string; value: (car: CarListing) => string; best?: (car: CarListing) => number | null | undefined; mode?: Mode };
const money = (n: number) => Number.isFinite(n) ? '£' + n.toLocaleString('en-GB') : '—';
const value = (n: unknown, suffix = '') => n == null || n === '' ? '—' : String(n) + suffix;
const rows: { title: string; icon: string; items: Row[] }[] = [
 { title: 'Key Details', icon: 'ribbon-outline', items: [
  { label: 'Make', value: c => c.make || '—' }, { label: 'Model', value: c => c.model || '—' },
  { label: 'Year', value: c => value(c.year), best: c => c.year, mode: 'highest' },
  { label: 'Mileage', value: c => c.mileage == null ? '—' : c.mileage.toLocaleString('en-GB') + ' mi', best: c => c.mileage },
  { label: 'Price', value: c => money(c.price), best: c => c.price },
  { label: 'Condition', value: c => c.condition ? String(c.condition).replace(/_/g, ' ') : '—' }
 ] },
 { title: 'Engine & Performance', icon: 'flash-outline', items: [
  { label: 'Fuel Type', value: c => c.fuelTypeRaw ? FUEL_TYPE_LABELS[c.fuelTypeRaw] ?? c.fuelTypeRaw : c.fuelType || '—' },
  { label: 'Transmission', value: c => c.transmissionRaw ? TRANSMISSION_LABELS[c.transmissionRaw] ?? c.transmissionRaw : c.transmission || '—' },
  { label: 'Engine Size', value: c => value(c.engineSize, ' cc'), best: c => c.engineSize, mode: 'highest' },
  { label: 'Power (BHP)', value: c => value(c.bhp, ' bhp'), best: c => c.bhp, mode: 'highest' },
  { label: 'CO₂ Emissions', value: c => value(c.co2Emissions, ' g/km'), best: c => c.co2Emissions }
 ] },
 { title: 'Dimensions & Style', icon: 'color-palette-outline', items: [
  { label: 'Body Type', value: c => c.category || '—' }, { label: 'Colour', value: c => c.colour || '—' },
  { label: 'Doors', value: c => value(c.doors) }, { label: 'Seats', value: c => value(c.seats), best: c => c.seats, mode: 'highest' }
 ] }
];
export function getBestIndex(cars: (CarListing | null)[], get: (c: CarListing) => number | null | undefined, mode: Mode = 'lowest') {
 let index: number | null = null, best: number | null = null;
 cars.forEach((car, i) => { if (!car) return; const n = get(car); if (n == null || !Number.isFinite(n)) return;
  if (best === null || (mode === 'lowest' ? n < best : n > best)) { best = n; index = i; } });
 return index;
}
export const CompareScreen = () => {
 const navigation = useNavigation<any>(), route = useRoute<any>(), insets = useSafeAreaInsets();
 const [cars, setCars] = useState<(CarListing | null)[]>([route.params?.initialListing ?? null, null, null]);
 const [slot, setSlot] = useState<number | null>(null), [query, setQuery] = useState('');
 const [results, setResults] = useState<CarListing[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState(false), [retry, setRetry] = useState(0);
 const count = cars.filter(Boolean).length;
 useEffect(() => { const car = route.params?.initialListing; if (car) setCars(previous => [car, previous[1]?.id === car.id ? null : previous[1], previous[2]?.id === car.id ? null : previous[2]]); }, [route.params?.initialListing]);
 useEffect(() => {
  if (slot === null) return;
  let active = true;
  setLoading(true); setError(false); setResults([]);
  const timer = setTimeout(async () => {
   try { const response = await searchListings({ search: query.trim(), limit: 12 });
    if (active) setResults(response.listings.filter(car => !car.status || car.status === 'ACTIVE'));
   } catch { if (active) setError(true); }
   finally { if (active) setLoading(false); }
  }, query.trim() ? 350 : 0);
  return () => { active = false; clearTimeout(timer); };
 }, [query, slot, retry]);
 const open = (index: number) => { setQuery(''); setSlot(index); };
 const select = (car: CarListing) => {
  if (slot === null || cars.some(c => c?.id === car.id)) return;
  setCars(previous => previous.map((old, i) => i === slot ? car : old)); setSlot(null);
 };
 const badgeSpecs: [string, (c: CarListing) => number | null | undefined, Mode][] = [
  ['Best Price', c => c.price, 'lowest'], ['Lowest Miles', c => c.mileage, 'lowest'], ['Most Power', c => c.bhp, 'highest'], ['Newest', c => c.year, 'highest']
 ];
 const photo = (car: CarListing) => car.images?.find(url => !url.includes('example.com'));
 return <>
  <PublicInfoPage navigation={navigation} breadcrumb="Compare Cars">
   <LinearGradient colors={[Colors.accentAlpha10, Colors.bgCard, Colors.infoBlue + '18']} style={s.hero}>
    <Text style={s.eyebrow}>SIDE-BY-SIDE COMPARISON</Text>
    <Text accessibilityRole="header" style={s.title}>Compare Vehicles Head-to-Head</Text>
    <Text style={s.lead}>Select up to three live listings and compare the key details in one clear desktop view.</Text>
   </LinearGradient>
   <View style={[s.panel, { padding: 0, overflow: 'hidden' }]}>
    <View style={{ padding: 20, gap: 8 }}>
     <Text style={s.eyebrow}>BUILD YOUR COMPARISON</Text>
     <Text accessibilityRole="header" style={s.subheading}>Choose the first vehicle, then add up to two more</Text>
     <Text style={s.muted}>{count} of 3 selected</Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel="Vehicle comparison: scroll horizontally to view all three slots">
     <View style={{ width: 840 }}>
      <View style={styles.row}>
       {cars.map((car, index) => <View key={index} style={[styles.column, { padding: 20 }]}>
        {car ? <View style={styles.card}>
         <View style={{ height: 176, backgroundColor: Colors.inputBg }}>
          {photo(car) ? <Image source={{ uri: photo(car) }} contentFit="cover" style={StyleSheet.absoluteFillObject}/> : <Text style={[s.muted, { padding: 20 }]}>Photo unavailable</Text>}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Remove ' + car.title + ' from comparison'} style={styles.remove} onPress={() => setCars(previous => previous.map((old, i) => i === index ? null : old))}><Ionicons name="close" color="#fff" size={20}/></TouchableOpacity>
          <Text style={styles.price}>{money(car.price)}</Text>
         </View>
         <View style={{ padding: 16, gap: 12 }}>
          <Text style={s.subheading}>{car.title || [car.make, car.model].filter(Boolean).join(' ')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{badgeSpecs.filter(([, get, mode]) => getBestIndex(cars, get, mode) === index).map(([label]) => <Text key={label} style={styles.badge}>{label}</Text>)}</View>
          <Text style={s.muted}>{[car.year || 'Year n/a', car.mileage == null ? null : car.mileage.toLocaleString('en-GB') + ' mi', car.fuelType].filter(Boolean).join(' · ')}</Text>
          <Button label="View details" variant="outline" onPress={() => navigation.navigate('VehicleDetail', { listing: car })}/>
         </View>
        </View> : <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Add vehicle to slot ' + (index + 1)} style={[styles.empty, count === 0 && index === 0 && { borderColor: Colors.accent, backgroundColor: Colors.accentAlpha10 }]} onPress={() => open(index)}>
         <View style={styles.plus}><Ionicons name="add" size={24} color="#fff"/></View>
         <Text style={[s.subheading, { textAlign: 'center' }]}>{count === 0 && index === 0 ? 'Add first vehicle' : 'Add vehicle'}</Text>
         <Text style={[s.muted, { textAlign: 'center' }]}>Search and select from live CarMazium listings</Text>
        </TouchableOpacity>}
       </View>)}
      </View>
      {count > 0 ? rows.map(section => <View key={section.title}>
       <View style={styles.section}><Ionicons name={section.icon as any} color={Colors.accent} size={20}/><Text style={s.eyebrow}>{section.title}</Text></View>
       {section.items.map((row, ri) => { const best = row.best ? getBestIndex(cars, row.best, row.mode) : null;
        return <View key={row.label} style={[styles.row, ri % 2 === 1 && { backgroundColor: Colors.inputBg }]}>
         {cars.map((car, index) => <View key={index} style={[styles.column, styles.cell, best === index && !!car && { backgroundColor: '#05966912' }]}>
          <Text style={styles.label}>{row.label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={[s.body, best === index && !!car && { color: Colors.successLight, fontWeight: '700' }]}>{car ? row.value(car) : '—'}</Text>{car && best === index && <Ionicons name="trophy-outline" size={14} color={Colors.successLight}/>}</View>
         </View>)}
        </View>;
       })}
      </View>) : null}
     </View>
    </ScrollView>
    {count === 0 && <View style={{ padding: 24, gap: 16 }}>
     <Text style={s.subheading}>Start with one vehicle</Text>
     <Text style={s.body}>Use the highlighted first slot above or the button below. Your existing listing search opens immediately, so there is no extra setup step.</Text>
     <Button label="Add first vehicle" onPress={() => open(0)}/>
    </View>}
   </View>
  </PublicInfoPage>
  <Modal visible={slot !== null} animationType="slide" onRequestClose={() => setSlot(null)}>
   <View style={{ flex: 1, backgroundColor: Colors.bgPrimary, paddingTop: insets.top, paddingBottom: insets.bottom }}>
    <View style={styles.modalHeading}>
     <View style={{ flex: 1, gap: 8 }}><Text style={s.subheading}>Select Vehicle to Compare</Text><Text style={s.muted}>Search live CarMazium listings</Text></View>
     <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close vehicle selector" onPress={() => setSlot(null)} style={{ padding: 12 }}><Ionicons name="close" size={24} color={Colors.textPrimary}/></TouchableOpacity>
    </View>
    <View style={{ padding: 20, gap: 10 }}><Text style={styles.label}>SEARCH VEHICLES</Text><TextInput accessibilityLabel="Search vehicles" placeholder="Search by make, model, or title..." placeholderTextColor={Colors.textMuted} value={query} onChangeText={setQuery} style={styles.input} autoCapitalize="none" autoCorrect={false}/></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 36 }}>
     {loading ? <View style={styles.message}><ActivityIndicator color={Colors.accent}/><Text style={s.muted}>Loading listings...</Text></View> : error ? <View style={styles.message}><Text style={s.body}>Unable to load listings. Please try again.</Text><Button label="Retry" onPress={() => setRetry(n => n + 1)}/></View> : results.length === 0 ? <Text style={s.muted}>{query ? 'No listings found for “' + query + '”.' : 'No listings found.'}</Text> : results.map(car => {
      const selected = cars.some(c => c?.id === car.id);
      return <TouchableOpacity key={car.id} accessibilityRole="button" accessibilityLabel={'Select ' + car.title} accessibilityState={{ disabled: selected }} disabled={selected} onPress={() => select(car)} style={[styles.result, selected && { opacity: 0.55 }]}>
       {photo(car) && <Image source={{ uri: photo(car) }} contentFit="cover" style={{ width: 80, height: 64, borderRadius: 8 }}/>}
       <View style={{ flex: 1, gap: 6 }}><Text style={s.body}>{car.title}</Text><Text style={s.muted}>{[car.year, car.mileage == null ? null : car.mileage.toLocaleString('en-GB') + ' mi'].filter(Boolean).join(' · ')}</Text><Text style={[s.body, { color: Colors.accent, fontWeight: '700' }]}>{money(car.price)}</Text>{selected && <Text style={s.muted}>Selected</Text>}</View>
      </TouchableOpacity>;
     })}
    </ScrollView>
   </View>
  </Modal>
 </>;
};
const styles = StyleSheet.create({
 row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: Colors.border },
 column: { width: 280, borderRightWidth: 1, borderColor: Colors.border },
 card: { borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.bgPrimary },
 empty: { minHeight: 340, borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.border, borderRadius: 16, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 20 },
 plus: { backgroundColor: Colors.accent, borderRadius: 16, width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
 remove: { position: 'absolute', right: 12, top: 12, borderRadius: 12, backgroundColor: '#0f172abf', padding: 9 },
 price: { position: 'absolute', left: 12, bottom: 12, borderRadius: 8, backgroundColor: '#0f172abf', color: '#fff', fontSize: 16, fontWeight: '900', paddingHorizontal: 12, paddingVertical: 6 },
 badge: { color: Colors.successLight, backgroundColor: '#05966918', borderColor: '#05966933', borderWidth: 1, borderRadius: 8, padding: 6, fontWeight: '700', fontSize: 10 },
 section: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Colors.inputBg, borderBottomWidth: 1, borderColor: Colors.border },
 cell: { minHeight: 96, padding: 20, gap: 8, alignItems: 'center', justifyContent: 'center' },
 label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, color: Colors.textMuted, textTransform: 'uppercase' },
 modalHeading: { padding: 20, borderBottomWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 16 },
 input: { minHeight: 48, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.inputBg, borderRadius: 12, padding: 12, color: Colors.textPrimary, fontSize: 16 },
 result: { padding: 12, gap: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.bgCard },
 message: { padding: 24, gap: 16, alignItems: 'center' }
});
