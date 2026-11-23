import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
import { Button } from '../../components/Button';
import { getServiceSettings, type ServiceMarketplaceSettings } from '../../lib/servicesApi';
import { useAuthStore } from '../../store/authStore';

type NavProp = NativeStackNavigationProp<MainStackParamList>;
type Availability = NonNullable<ServiceMarketplaceSettings['availability']>;
type ServiceItem = { title: string; desc: string; detail: string; icon: string; path: string; cta: string; flag?: keyof Availability };

const SERVICES: ServiceItem[] = [
  { title: 'Vehicle auctions', desc: 'Sell your vehicle through a free dealer auction, or browse live auctions as a verified motor trader.', detail: 'Free seller listing · Verified dealer bidding', icon: 'hammer-outline', path: '/auctions/how-it-works', cta: 'Explore auctions' },
  { title: 'Vehicle transport', desc: 'Arrange delivery, collection or recovery for one vehicle or several. Compare fixed-price quotes from approved transport providers.', detail: 'Delivery · Collection · Recovery', icon: 'car-outline', path: '/services/delivery/new', cta: 'Get transport quotes', flag: 'DELIVERY' },
  { title: 'Vehicle inspections', desc: 'Request an independent vehicle inspection and compare quotes from approved inspection businesses.', detail: 'Pre-purchase and condition checks', icon: 'search-outline', path: '/services/inspection/new', cta: 'Request an inspection', flag: 'INSPECTION' },
  { title: 'Vehicle finance', desc: 'Start from a participating vehicle listing and continue your application with the selected finance provider. Subject to status and approval.', detail: 'Finance application with a selected partner', icon: 'cash-outline', path: '/services/finance', cta: 'Explore finance', flag: 'FINANCE' },
  { title: 'Vehicle warranty', desc: 'Choose available cover, see your warranty quote and order online. Cover is confirmed after issuance.', detail: 'Vehicle-specific cover options', icon: 'shield-checkmark-outline', path: '/services/warranty', cta: 'Get a warranty quote', flag: 'WARRANTY' },
  { title: 'Business partnerships', desc: 'Join CarMazium as a motor trader or service provider, or discuss a specialist integration with our team.', detail: 'One Partner Account for eligible trading and paid services', icon: 'business-outline', path: '#business-partnerships', cta: 'Explore partnerships' },
];

const STEPS = [
  ['Request a service', 'Tell us about your vehicle, location and the work you need.'],
  ['Compare and choose', 'Approved providers may send fixed-price quotes. Review the scope and price before accepting.'],
  ['Pay and track', 'Pay for the service through CarMazium, track progress and review completion under the service payment terms.'],
];

export const ServicesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { width, fontScale } = useWindowDimensions();
  const userId = useAuthStore(s => s.user?.id);
  const role = useAuthStore(s => s.accountRole);
  const staff = useAuthStore(s => s.user?.isDealerStaff);
  const hasDealerProfile = useAuthStore(s => s.user?.hasDealerProfile);
  const authenticated = useAuthStore(s => s.isAuthenticated);
  const current = authenticated && !!userId;
  const [snapshot, setSnapshot] = useState<{ userId: string; availability: Availability } | null>(null);
  const availability = snapshot?.userId === userId ? snapshot?.availability ?? null : null;
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const areasY = useRef(0);
  const businessY = useRef(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setSnapshot(null);
    setFailed(false);
    if (current && userId) getServiceSettings().then(data => { if (active) setSnapshot({ userId, availability: data.availability ?? {} }); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [current, userId, refresh]));
  // Guest access to public information remains available; the existing guest gate protects paid-job forms.
  const enabled = (flag?: keyof Availability) => !flag || !current || (availability !== null && availability[flag] !== false);
  const openService = (path: string) => {
    const service = SERVICES.find(item => item.path === path);
    if (!service || !enabled(service.flag)) return;
    if (path === '/services/delivery/new') navigation.navigate('CreateServiceJob', { serviceType: 'DELIVERY' });
    else if (path === '/services/inspection/new') navigation.navigate('CreateServiceJob', { serviceType: 'INSPECTION' });
    else if (path === '/auctions/how-it-works') navigation.navigate('AuctionGuide');
    else if (path === '#business-partnerships') scroll.current?.scrollTo({ y: businessY.current, animated: true });
    else navigation.navigate(path === '/services/finance' ? 'Finance' : 'Warranty');
  };
  const specialist = ['finance_partner', 'insurance_partner', 'admin'].includes(role);
  const staffOnly = current && !!staff && !hasDealerProfile && role !== 'contractor';
  const businessOwner = current && !staffOnly && (role === 'dealer' || role === 'contractor');
  const partnerLabel = staffOnly ? 'Open dealer dashboard' : businessOwner ? 'Manage Partner Account' : current && !specialist ? 'Explore Partner Account setup' : 'Explore Partner Accounts';
  const openPartner = () => {
    if (staffOnly) navigation.navigate('Tabs', { screen: 'DealerHome' });
    else if (current && !specialist) navigation.navigate('PartnerDashboard');
    else navigation.navigate('PartnerGuide');
  };
  const columns = fontScale > 1.25 ? 1 : width >= 1000 ? 3 : width >= 700 ? 2 : 1;
  return <View style={[styles.container, { paddingTop: insets.top }]}>
    <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
    <View style={styles.header}>
      <IconButton icon={<Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
      <Text accessibilityRole="header" style={styles.headerTitle}>TradeXchange</Text><HamburgerButton />
    </View>
    <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}>
      <View style={styles.hero}>
        <Image source={require('../../../assets/images/live-auction-hero.webp')} style={[StyleSheet.absoluteFillObject, { opacity: 0.35 }]} contentFit="cover" accessible={false} />
        <View style={[StyleSheet.absoluteFillObject, styles.heroOverlay]} pointerEvents="none" />
        <Text style={styles.eyebrow}>CarMazium TradeXchange</Text>
        <Text accessibilityRole="header" style={styles.heroTitle}>Everything your vehicle needs. One marketplace.</Text>
        <Text style={[styles.body, styles.heroBody]}>Sell at auction, buy at auction as a verified motor trader, arrange vehicle transport and inspections, explore finance and choose warranty cover. For private customers and automotive businesses across the UK.</Text>
        <Button label="Explore services" onPress={() => scroll.current?.scrollTo({ y: areasY.current, animated: true })} />
        <Button label="For automotive businesses" variant="outline" textStyle={styles.heroBody} style={styles.heroOutline} onPress={() => scroll.current?.scrollTo({ y: businessY.current, animated: true })} />
      </View>
      <View style={styles.section} onLayout={e => { areasY.current = e.nativeEvent.layout.y; }}>
        <Text accessibilityRole="header" style={styles.heading}>What can we help you with?</Text>
        <Text style={styles.body}>Choose the service you need. Each service has its own clear process and terms.</Text>
        {current && failed && <View style={styles.card}><Text accessibilityRole="alert" style={styles.body}>Service availability could not be checked. Existing requests are still accessible.</Text><Button label="Retry availability" variant="outline" onPress={() => setRefresh(v => v + 1)} /></View>}
        <View style={styles.grid}>
          {SERVICES.map(service => <TouchableOpacity key={service.path} style={[styles.card, { width: columns === 1 ? '100%' : columns === 2 ? '49%' : '32%' }]}
            disabled={!enabled(service.flag)} accessibilityRole="button" accessibilityState={{ disabled: !enabled(service.flag) }}
            accessibilityLabel={service.cta} accessibilityHint={!enabled(service.flag) ? 'Service availability is not confirmed or is temporarily unavailable' : !current && (service.flag === 'DELIVERY' || service.flag === 'INSPECTION') ? 'Sign in to request this service' : service.desc} onPress={() => openService(service.path)}>
            <View style={styles.icon}><Ionicons name={service.icon} size={25} color={Colors.accent} /></View>
            <Text style={styles.cardTitle}>{service.title}</Text>
            <Text style={styles.body}>{service.desc}</Text><Text style={styles.detail}>{service.detail}</Text>
            <Text style={[styles.cta, !enabled(service.flag) && { color: Colors.textMuted }]}>{enabled(service.flag) ? (!current && (service.flag === 'DELIVERY' || service.flag === 'INSPECTION') ? 'Sign in to request' : service.cta) : availability ? 'Temporarily unavailable' : failed ? 'Availability not confirmed' : 'Checking availability'}</Text>
          </TouchableOpacity>)}
        </View>
        {current && <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardTitle}>Your TradeXchange account</Text>
          <Text style={styles.body}>View your service requests, quotes, completed work and warranty orders.</Text>
          <Button label="My service requests" variant="outline" onPress={() => navigation.navigate('CustomerServiceJobs')} />
          <Button label="My warranties" variant="outline" onPress={() => navigation.navigate('WarrantyOrders')} />
          {enabled('DELIVERY') && <Button label="Request transport" variant="outline" onPress={() => openService('/services/delivery/new')} />}
          {enabled('INSPECTION') && <Button label="Request inspection" variant="outline" onPress={() => openService('/services/inspection/new')} />}
          {businessOwner && <Button label="Provider Dashboard" variant="outline" onPress={() => navigation.navigate('ProviderOverview')} />}
        </View>}
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>How transport and inspection requests work</Text>
        {STEPS.map(([title, desc], index) => <View key={title} style={styles.step}><View style={styles.icon}><Text style={styles.cardTitle}>{index + 1}</Text></View><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{desc}</Text></View></View>)}
        {enabled('DELIVERY') && <Button label="Request transport" onPress={() => openService('/services/delivery/new')} />}
        {enabled('INSPECTION') && <Button label="Request inspection" variant="outline" onPress={() => openService('/services/inspection/new')} />}
        <Text style={styles.detail}>Service availability depends on suitable providers. Vehicle purchase funds are paid directly between buyer and seller, separately from paid service jobs.</Text>
      </View>
      <View style={styles.section} onLayout={e => { businessY.current = e.nativeEvent.layout.y; }}>
        <Text accessibilityRole="header" style={styles.heading}>Grow your automotive business</Text>
        <Text style={styles.body}>Choose the route that matches your business. No separate account is needed for each eligible service.</Text>
        <View style={styles.card}><Text style={styles.cardTitle}>Motor traders and paid service providers</Text>
          <Text style={styles.body}>Use one Partner Account for trading and apply for delivery, collection, recovery or inspection services. Each service requires approval before you can quote.</Text>
          <Text style={styles.detail}>For completed paid transport and inspection jobs, the platform fee is 9% and the provider share is 91%. Payment release is subject to the service terms.</Text>
          <Button label={partnerLabel} onPress={openPartner} />
        </View>
        <View style={styles.card}><Text style={styles.cardTitle}>Finance, warranty and insurance businesses</Text>
          <Text style={styles.body}>These partnerships are arranged directly with CarMazium. Contact our team to discuss products, integration and requirements. They are not paid-job applications.</Text>
          {(['finance', 'warranty', 'insurance'] as const).map(topic => <Button key={topic} label={topic.charAt(0).toUpperCase() + topic.slice(1) + ' partnership'} variant="outline" onPress={() => navigation.navigate('Contact', { topic: `${topic}-partnership` })} />)}
        </View>
        <Button label="Explore Business Spotlight" variant="outline" onPress={() => navigation.navigate('BusinessSpotlight')} />
      </View>
    </ScrollView>
  </View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  headerTitle: { flex: 1, fontFamily: FontFamily.bold, fontSize: 19, color: Colors.textPrimary },
  content: { paddingHorizontal: 16, gap: 26, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  // Fixed dark hero matches the web artwork in both themes; other surfaces use theme tokens.
  hero: { padding: 20, gap: 14, borderRadius: 16, overflow: 'hidden', backgroundColor: '#020617' },
  heroOverlay: { backgroundColor: 'rgba(2,6,23,0.45)' },
  heroBody: { color: '#F1F5F9' },
  heroOutline: { borderColor: '#CBD5E1', backgroundColor: 'transparent' },
  eyebrow: { fontFamily: FontFamily.bold, fontSize: 14, color: '#FECACA' },
  heroTitle: { fontFamily: FontFamily.bold, fontSize: 30, lineHeight: 36, color: '#FFFFFF' },
  heading: { fontFamily: FontFamily.bold, fontSize: 24, color: Colors.textPrimary },
  section: { gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  card: { padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, backgroundColor: Colors.bgCardSolid, minHeight: 48 },
  icon: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.accentAlpha10, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontFamily: FontFamily.bold, fontSize: 19, color: Colors.textPrimary },
  body: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 25, color: Colors.textSecondary },
  detail: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 22, color: Colors.textMuted },
  cta: { fontFamily: FontFamily.bold, fontSize: 16, color: Colors.accent, marginTop: 'auto', paddingTop: 8 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
