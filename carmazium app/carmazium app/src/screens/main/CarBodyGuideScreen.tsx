import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PublicInfoPage, infoStyles as s } from '../../components/PublicInfoPage';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/colors';
import { nativeBodyTypes } from '../../data/nativeDocuments';
import { searchListings } from '../../lib/listingsApi';
import { CarListing } from '../../data/listings';
import { FUEL_TYPE_LABELS, TRANSMISSION_LABELS } from '../../lib/vehicleLabels';

const accents = ['#0284c7', '#059669', '#7c3aed', '#d97706', '#e11d48', '#db2777', '#0891b2', '#65a30d'];
export function bodyGuidePreview(listings: CarListing[]): CarListing[] {
 return listings.filter(car => car.listingType === 'CLASSIFIED' && car.status === 'ACTIVE' && !!car.id && !!car.title && Number(car.price) > 0).slice(0, 8);
}
export const CarBodyGuideScreen = ({ navigation }: any) => {
 const [cars, setCars] = useState<CarListing[]>([]);
 useEffect(() => {
  let active = true;
  searchListings({ page: 1, limit: 12, sortBy: 'newest', listingType: 'CLASSIFIED' })
    .then(result => { if (active) setCars(bodyGuidePreview(result.listings)); })
    .catch(() => { if (active) setCars([]); });
  return () => { active = false; };
 }, []);
 const browse = (bodyType?: string) => navigation.navigate('Tabs', { screen: 'Search', ...(bodyType ? { params: { bodyType, _t: Date.now() } } : {}) });
 return <PublicInfoPage breadcrumb="Used car body types" navigation={navigation}>
  <LinearGradient colors={[Colors.accentAlpha10, Colors.bgCard, Colors.infoBlue + '18']} style={s.hero}>
   <Text style={s.eyebrow}>UK USED-CAR BUYING GUIDE</Text>
   <Text accessibilityRole="header" style={s.title}>Find the right body type for your next used car</Text>
   <Text style={s.lead}>From city hatchbacks to family SUVs and practical estates, the right shape depends on how you drive. Compare eight common UK vehicle styles, see what to check and search current listings without changing your filters.</Text>
   <Button label="Browse all used cars" onPress={() => browse()}/>
  </LinearGradient>
  <View style={s.section}>
   <Text accessibilityRole="header" style={s.heading}>Compare body types</Text>
   <Text style={s.body}>These are general buying considerations, not promises about any individual car. Review each listing's actual specifications and condition.</Text>
   {nativeBodyTypes.map((body, i) => <LinearGradient key={body.key} colors={[accents[i] + '24', Colors.bgCard]} style={[s.panel, { padding: 20 }]}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
     <Image source={{ uri: 'https://www.carmazium.com' + body.image }} contentFit="contain" style={{ width: 112, height: 96, borderRadius: 16, backgroundColor: '#fff' }}/>
     <Text accessibilityRole="header" style={[s.subheading, { flexGrow: 1, flexShrink: 1, flexBasis: 120 }]}>{body.name}</Text>
    </View>
    <Text style={s.body}>{body.description}</Text>
    <View style={[s.panel, { padding: 16, borderRadius: 16 }]}><Text style={s.body}><Text style={{ color: Colors.textPrimary, fontWeight: '700' }}>What to check: </Text>{body.check}</Text></View>
    <Button label={'Browse used ' + (/^[A-Z]{2}/.test(body.name) ? body.name : body.name.toLowerCase())} variant="outline" onPress={() => browse(body.key)}/>
   </LinearGradient>)}
  </View>
  {!!cars.length && <View style={s.section}>
   <Text style={s.eyebrow}>EXPLORE THE MARKETPLACE</Text>
   <Text accessibilityRole="header" style={s.heading}>Recently listed used cars</Text>
   <Button label="All listings" variant="outline" onPress={() => browse()}/>
   {cars.map(car => <TouchableOpacity key={car.id} accessibilityRole="link" style={[s.panel, { borderRadius: 16, padding: 20 }]} onPress={() => navigation.navigate('VehicleDetail', { listing: car })}>
    <Text style={s.subheading}>{car.title}</Text>
    <Text style={s.muted}>{[car.title.includes(String(car.year)) ? null : car.year,
      car.fuelTypeRaw ? FUEL_TYPE_LABELS[car.fuelTypeRaw] ?? car.fuelTypeRaw : car.fuelType,
      car.transmissionRaw ? TRANSMISSION_LABELS[car.transmissionRaw] ?? car.transmissionRaw : car.transmission].filter(Boolean).join(' · ')}</Text>
    <Text style={[s.subheading, { color: Colors.accent }]}>{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(car.price)}</Text>
   </TouchableOpacity>)}
  </View>}
  <View style={[s.panel, s.section]}>
   <Text accessibilityRole="header" style={s.heading}>Checks that matter for every used car</Text>
   <Text style={s.body}>Whichever body type you prefer, compare the advertised mileage, service history, MOT record, condition, insurance and running costs. Check the vehicle's identity and available history independently, inspect it in person and make sure the seller has the right to sell. A marketplace listing is not a substitute for your own due diligence.</Text>
   <Text style={s.body}>CarMazium is a marketplace: buyers pay sellers directly for vehicles. Its seller auction listing is free and the basic retail listing costs £1; these are seller options, not extra retail buyer fees.</Text>
   <Button label="How CarMazium works" variant="outline" onPress={() => navigation.navigate('HowItWorks')}/>
   <Button label="Marketplace fees" variant="outline" onPress={() => navigation.navigate('Pricing')}/>
   <Button label="Search used cars" onPress={() => browse()}/>
  </View>
 </PublicInfoPage>;
};
