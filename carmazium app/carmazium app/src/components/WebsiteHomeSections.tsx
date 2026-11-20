import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/MainStackNavigator';
import { Colors } from '../constants/colors';
import { FontFamily } from '../constants/typography';
import { homeMarketplaceImages as photos } from '../assets/homeMarketplaceImages';
import { apiClient } from '../lib/apiClient';

const website = (path: string) => void WebBrowser.openBrowserAsync(`https://www.carmazium.com${path}`).catch(() => Alert.alert('Could not open CarMazium', 'Please try again.'));
const categories = [
  ['Small and sporty', { bodyType: 'HATCHBACK', search: 'sporty' }],
  ['Eco-friendly', { fuelTypes: 'Electric,Hybrid' }],
  ['Automatic', { transmissions: 'AUTOMATIC' }],
  ['Seven-seater', { minSeats: 7 }],
  ['Affordable 4x4', { bodyType: 'SUV', maxPrice: 20000 }],
  ['Great first cars', { maxPrice: 8000, maxEngine: 1400 }],
  ['Dog-friendly', { bodyType: 'ESTATE' }],
  ['Fuel-efficient', { fuelTypes: 'Hybrid,Plugin Hybrid' }],
] as const;
const bodies = [
  ['COUPE', 'Coupes', 'coupe'], ['CONVERTIBLE', 'Convertibles', 'convertible'],
  ['HATCHBACK', 'Hatchbacks', 'hatchback'], ['MPV', 'MPVs', 'mpv'],
  ['PICKUP_TRUCK', 'Pickup Trucks', 'pickup'], ['SEDAN', 'Saloons', 'saloon'],
  ['SUV', 'SUVs', 'suv'], ['ESTATE', 'Estates', 'estate'],
] as const;

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={s.link}><Text style={s.linkText}>{label} →</Text></TouchableOpacity>;
}

export function WebsiteHomeDiscovery() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const search = (params = {}) => navigation.navigate('Search' as any, { ...params, _t: Date.now() });
  return <View style={s.section}>
    <Text style={s.eyebrow}>DISCOVER YOUR PERFECT CAR</Text>
    <Text accessibilityRole="header" style={s.heading}>Find a car that fits your life.</Text>
    <Text style={s.description}>Explore used cars across the UK from verified sellers.</Text>
    <LinkButton label="Browse All Cars" onPress={() => search()} />
    {[
      { title: 'Everyday essentials', description: 'Explore hatchbacks for everyday life.', photo: photos.hatchback, params: { bodyType: 'HATCHBACK' } },
      { title: 'Room for more', description: 'Find cars with seven seats or more.', photo: photos.family, params: { minSeats: 7 } },
      { title: 'Electric & hybrid', description: 'Explore a different way to drive.', photo: photos.electric, params: { fuelTypes: 'Electric,Hybrid' } },
    ].map(item => <TouchableOpacity key={item.title} accessibilityRole="button" style={s.discoveryCard} onPress={() => search(item.params)}>
      <Image source={{ uri: item.photo }} style={s.discoveryImage} contentFit="cover" />
      <View style={s.discoveryCopy}><Text style={s.cardTitle}>{item.title}</Text><Text style={s.description}>{item.description}</Text><Text style={s.linkText}>Explore cars →</Text></View>
    </TouchableOpacity>)}
    <Text accessibilityRole="header" style={s.subheading}>Browse by category</Text>
    <View style={s.chips}>{categories.map(([label, params]) => <TouchableOpacity key={label} accessibilityRole="button" onPress={() => search(params)} style={s.chip}><Text style={s.chipText}>{label}</Text></TouchableOpacity>)}</View>
    <Text accessibilityRole="header" style={s.subheading}>Browse by body type</Text>
    <LinkButton label="Read the body type buying guide" onPress={() => website('/used-car-types')} />
    <View style={s.bodyGrid}>{bodies.map(([bodyType, label, photo]) => <TouchableOpacity key={bodyType} accessibilityRole="button" style={s.bodyCard} onPress={() => search({ bodyType })}>
      <Image source={{ uri: photos[photo] }} style={s.bodyImage} contentFit="cover" /><Text style={s.bodyLabel}>{label}</Text>
    </TouchableOpacity>)}</View>
  </View>;
}

type BlogSummary = { id: string; slug: string; title: string; excerpt: string; coverImage?: string };
export function WebsiteHomeInformation() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [blogs, setBlogs] = useState<BlogSummary[]>([]);
  useEffect(() => {
    let mounted = true;
    apiClient<{ data: BlogSummary[] }>('/blog?page=1&limit=3').then(result => {
      if (mounted) setBlogs((result.data ?? []).slice(0, 3).map(({ id, slug, title, excerpt, coverImage }) => ({ id, slug, title, excerpt, coverImage })));
    }).catch(() => { /* The guides link remains available when the feed is offline. */ });
    return () => { mounted = false; };
  }, []);
  return <>
    <View style={s.section}>
      <LinkButton label="Explore the Full Car Marketplace" onPress={() => navigation.navigate('Search' as any, { _t: Date.now() })} />
      <Text style={s.eyebrow}>A DIFFERENT WAY TO BUY AND SELL CARS</Text>
      <Text accessibilityRole="header" style={s.heading}>More choice. <Text style={{ color: Colors.accent }}>Clearer fees.</Text></Text>
      <Text style={s.description}>Choose a free dealer auction or a £1 retail listing, with transparent terms and straightforward next steps.</Text>
      {[
        { eyebrow: 'AUCTION FREE', title: 'Let verified dealers bid', detail: 'List your vehicle in the dealer auction without a seller listing fee. Verified motor traders can compete to buy it.', link: 'Sell by auction', tint: '#e11d4812', action: () => navigation.navigate('SellCarFlow', { listingType: 'AUCTION' }) },
        { eyebrow: 'RETAIL £1', title: 'Advertise to UK buyers', detail: 'Prefer a direct retail sale? Create a listing for a one-time £1 fee until sold, and advertise your vehicle to buyers.', link: 'Create a retail listing', tint: '#0284c712', action: () => navigation.navigate('SellCarFlow', { listingType: 'CLASSIFIED' }) },
        { eyebrow: '£100 SELLER REWARD', title: 'A reward for auction sellers', detail: 'Qualifying completed auction sales can earn a £100 seller reward once the handover photograph has been approved.', link: 'See how it works', tint: '#f59e0b12', action: () => navigation.navigate('HowItWorks') },
        { eyebrow: 'DIRECT TRANSACTIONS', title: 'Your vehicle payment stays direct', detail: 'Vehicle purchase funds pass directly between buyer and seller. CarMazium collects its own platform fees, not the vehicle price.', link: 'Understand the fees', tint: '#05966912', action: () => navigation.navigate('Pricing') },
      ].map(item => <View key={item.eyebrow} style={[s.infoCard, { backgroundColor: item.tint }]}><Text style={s.eyebrow}>{item.eyebrow}</Text><Text style={s.cardTitle}>{item.title}</Text><Text style={s.description}>{item.detail}</Text><LinkButton label={item.link} onPress={item.action} /></View>)}
      <Text accessibilityRole="header" style={s.heading}>Simple Steps to Buy, Sell, or Auction</Text>
      {[
        ['Browse or List a Car', 'Explore verified listings or create your own car listing in minutes.'],
        ['Connect or Bid', 'Buy directly, negotiate with sellers, or place bids in live auctions.'],
        ['Pay the Seller Directly', 'Agree a secure payment method with the seller after completing your vehicle checks.'],
        ['Ownership Transfer', 'Finalise documentation and drive away with confidence.'],
      ].map(([title, detail], index) => <View key={title} style={s.step}><Text style={s.stepNumber}>{index + 1}</Text><View style={{ flex: 1 }}><Text style={s.cardTitle}>{title}</Text><Text style={s.description}>{detail}</Text></View></View>)}
      <LinkButton label="See Exactly How It Works" onPress={() => navigation.navigate('HowItWorks')} />
      <View style={s.infoCard}>
        <Text style={s.eyebrow}>PARTNER ACCOUNT</Text><Text accessibilityRole="header" style={s.heading}>Built for Automotive Businesses</Text>
        <Text style={s.description}>Create one Partner Account for your automotive business, then use the Vehicle Dealer and other approved capabilities relevant to the work you provide.</Text>
        {[
          ['Vehicle Dealer', 'Manage vehicle stock and the existing dealer workspace from your business account.'],
          ['Business Workspace', 'Keep the tools and account access for your automotive operation together.'],
          ['Approved Services', 'Add supported service capabilities as they are approved for your business.'],
        ].map(([title, detail]) => <View key={title} style={s.feature}><Text style={s.cardTitle}>{title}</Text><Text style={s.description}>{detail}</Text></View>)}
        <LinkButton label="Explore Partner Accounts" onPress={() => website('/become-a-partner')} />
        <LinkButton label="Explore TradeXchange services" onPress={() => navigation.navigate('Services')} />
      </View>
      <Text accessibilityRole="header" style={s.heading}>Automotive Insights & Market Updates</Text>
      {blogs.map(post => <TouchableOpacity key={post.id} accessibilityRole="button" style={s.infoCard} onPress={() => website(`/blog/${encodeURIComponent(post.slug)}`)}>
        {!!post.coverImage && <Image source={{ uri: post.coverImage }} style={s.blogImage} contentFit="cover" />}
        <Text style={s.cardTitle}>{post.title}</Text><Text style={s.description} numberOfLines={3}>{post.excerpt}</Text><Text style={s.linkText}>Read More →</Text>
      </TouchableOpacity>)}
      <LinkButton label="View all automotive guides" onPress={() => website('/blog')} />
    </View>
    <View style={s.spotlight}>
      <Text style={[s.eyebrow, { color: '#79e0d5' }]}>CARMAZIUM BUSINESS SPOTLIGHT</Text>
      <Text accessibilityRole="header" style={[s.heading, { color: '#fff' }]}>Meet our featured automotive businesses</Text>
      <Text style={[s.description, { color: '#e2e8f0' }]}>Discover independent services for the motor trade. Explore each profile to learn more and contact the business directly.</Text>
      {[
        ['resolve-automotive', 'AFTER-SALES SUPPORT', 'Resolve Automotive', "You sell the cars. We’ll handle the complaints."],
        ['simpledms', 'DEALER MANAGEMENT SOFTWARE', 'SimpleDMS', 'Buying intelligence for UK dealers.'],
      ].map(([slug, category, name, detail]) => <TouchableOpacity key={slug} accessibilityRole="button" onPress={() => website(`/business-spotlight/${slug}`)} style={s.partner}><Text style={[s.eyebrow, { color: '#9ceddf' }]}>{category}</Text><Text style={[s.cardTitle, { color: '#fff' }]}>{name}</Text><Text style={[s.description, { color: '#bceee8' }]}>{detail}</Text><Text style={{ color: '#9ceddf', fontFamily: FontFamily.bold }}>Discover {name} →</Text></TouchableOpacity>)}
      <Text style={[s.description, { color: '#cbd5e1' }]}>Independent businesses. Promotional inclusion does not imply CarMazium provides or endorses every service.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => website('/business-spotlight')} style={s.link}><Text style={{ color: '#9ceddf', fontFamily: FontFamily.bold }}>View all partners →</Text></TouchableOpacity>
    </View>
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.heading}>One CarMazium marketplace.</Text>
      <Text style={s.description}>Buy, sell and manage your cars, with clear routes to the same services and information as our website.</Text>
      <LinkButton label="Browse by make & location" onPress={() => website('/used-cars')} />
      <LinkButton label="About CarMazium" onPress={() => navigation.navigate('About')} />
      <LinkButton label="Pricing" onPress={() => navigation.navigate('Pricing')} />
      <LinkButton label="Terms & Conditions" onPress={() => website('/terms')} />
      <LinkButton label="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />
      <Text style={s.description}>© {new Date().getFullYear()} CarMazium. All Rights Reserved.</Text>
    </View>
  </>;
}

const s = StyleSheet.create({
  section: { paddingHorizontal: 20, paddingVertical: 28 },
  eyebrow: { color: Colors.accent, fontFamily: FontFamily.extraBold, fontSize: 10, letterSpacing: 1.3, marginBottom: 8 },
  heading: { color: Colors.textPrimary, fontFamily: FontFamily.extraBold, fontSize: 28, lineHeight: 35, letterSpacing: -1, marginBottom: 12 },
  subheading: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: 21, marginTop: 28, marginBottom: 14 },
  description: { color: Colors.textSecondary, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 22, marginVertical: 8 },
  cardTitle: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: 18, lineHeight: 25 },
  link: { minHeight: 44, justifyContent: 'center', marginVertical: 6 },
  linkText: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: 13, textDecorationLine: 'underline' },
  discoveryCard: { flexDirection: 'row', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, overflow: 'hidden', marginTop: 14 },
  discoveryImage: { width: '40%', minHeight: 150 },
  discoveryCopy: { flex: 1, padding: 14, borderBottomWidth: 4, borderColor: Colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  chipText: { color: Colors.textSecondary, fontFamily: FontFamily.medium, fontSize: 13 },
  bodyGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  bodyCard: { width: '48%', borderRadius: 8, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  bodyImage: { width: '100%', aspectRatio: 16 / 9 },
  bodyLabel: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: 13, padding: 12, textAlign: 'center', borderTopWidth: 2, borderColor: Colors.accent },
  infoCard: { padding: 22, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, marginVertical: 12 },
  step: { flexDirection: 'row', gap: 16, marginVertical: 14 },
  stepNumber: { color: Colors.accent, fontFamily: FontFamily.extraBold, fontSize: 28, minWidth: 30 },
  feature: { backgroundColor: Colors.accentAlpha06, borderRadius: 12, padding: 16, marginTop: 12 },
  blogImage: { width: '100%', aspectRatio: 1.7, borderRadius: 10, marginBottom: 16 },
  spotlight: { padding: 22, paddingVertical: 34, backgroundColor: '#102d3d' },
  partner: { padding: 20, borderWidth: 1, borderColor: '#56bbb073', borderRadius: 16, backgroundColor: '#ffffff14', marginVertical: 10 },
});
