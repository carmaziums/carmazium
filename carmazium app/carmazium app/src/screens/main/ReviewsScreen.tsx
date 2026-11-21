import React from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@/components/BrandIcon';
import { PublicInfoPage, infoStyles as s } from '../../components/PublicInfoPage';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/colors';

export const REVIEW_BUYER_CHECKS = [
 { icon: 'car-outline', colour: '#0284c7', title: 'Examine the individual vehicle',
   description: 'Compare the advertisement with the car itself. Check its condition, mileage, specification and history. A listing is not an independent mechanical inspection.',
   label: 'Explore retail listings', screen: 'Tabs', params: { screen: 'Search' } },
 { icon: 'shield-checkmark-outline', colour: '#7c3aed', title: 'Understand verification',
   description: "Account and motor-trade checks support safer participation, but they are not a guarantee about a vehicle's condition, its value or the outcome of a purchase.",
   label: 'How the marketplace works', screen: 'HowItWorks', params: undefined },
 { icon: 'card-outline', colour: '#059669', title: 'Know who receives the money',
   description: 'For the vehicle purchase, buyers pay the seller directly. CarMazium does not hold vehicle purchase funds; its own marketplace fees are separate.',
   label: 'Understand marketplace fees', screen: 'Pricing', params: undefined },
] as const;

export const ReviewsScreen: React.FC = () => {
 const navigation = useNavigation<any>();
 const feedback = () => { void Linking.openURL('mailto:info@carmazium.com?subject=CarMazium%20customer%20feedback').catch(() => Alert.alert('Email CarMazium', 'Send your feedback to info@carmazium.com.')); };
 return <PublicInfoPage breadcrumb="Reviews & feedback" navigation={navigation}>
  <LinearGradient colors={[Colors.accentAlpha10, Colors.bgCard, Colors.infoBlue + '18']} style={s.hero}>
   <Text style={s.eyebrow}>CUSTOMER EXPERIENCES MATTER</Text>
   <Text accessibilityRole="header" style={s.title}>CarMazium reviews and customer feedback</Text>
   <Text style={s.lead}>Buying or selling a car is a significant decision. We welcome genuine experiences, questions and concerns, and we believe any published customer review should have a traceable source.</Text>
   <View style={s.actions}><Button label="Share your experience" onPress={feedback}/><Button label="Browse used cars" variant="outline" onPress={() => navigation.navigate('Tabs', { screen: 'Search' })}/></View>
  </LinearGradient>
  <View style={[s.panel, { borderColor: '#f59e0b4d', backgroundColor: '#f59e0b10' }]}>
   <Ionicons name="shield-checkmark-outline" size={25} color={Colors.warning}/>
   <Text accessibilityRole="header" style={s.subheading}>Our approach to genuine reviews</Text>
   <Text style={s.body}>We do not currently display a sourced customer-review feed or a calculated star average on this page. We will not use made-up customer quotes, names, star ratings or customer counts as substitutes for real feedback. If authenticated reviews become available, their publication will need an appropriate source and permission.</Text>
  </View>
  <View style={s.section}>
   <Text style={s.eyebrow}>CONFIDENCE THROUGH INFORMATION</Text>
   <Text accessibilityRole="header" style={s.heading}>What to check before buying</Text>
   <Text style={s.body}>A positive testimonial cannot replace checking the individual car and seller. Use these practical steps alongside your own inspection and independent research.</Text>
   {REVIEW_BUYER_CHECKS.map(item => <LinearGradient key={item.title} colors={[item.colour + '20', Colors.bgCard]} style={[s.panel, { borderColor: item.colour + '40' }]}>
     <View style={[s.icon, { backgroundColor: item.colour }]}><Ionicons name={item.icon} size={24} color="#fff"/></View>
     <Text accessibilityRole="header" style={s.subheading}>{item.title}</Text><Text style={s.body}>{item.description}</Text>
     <Button label={item.label} variant="ghost" onPress={() => navigation.navigate(item.screen, item.params)}/>
   </LinearGradient>)}
  </View>
  <View style={[s.panel, s.section]}>
   <Ionicons name="search-outline" size={37} color={Colors.accent}/>
   <Text accessibilityRole="header" style={s.heading}>Use independent vehicle checks</Text>
   <Text style={s.body}>Before committing to a purchase, verify the vehicle registration and identity, review the available DVLA and MOT information, consider an independent history check where appropriate, and inspect or arrange an inspection of the vehicle. The details supplied in an advert should be checked against the actual car and its documents.</Text>
   <Text style={s.body}>CarMazium does not require buyers to purchase a vehicle history report, but you can choose independent checks to suit your circumstances.</Text>
   <Button label="Compare used-car body types" variant="outline" onPress={() => navigation.navigate('CarBodyGuide')}/>
  </View>
  <LinearGradient colors={[Colors.accentAlpha10, '#7c3aed18']} style={[s.panel, s.section]}>
   <Ionicons name="checkmark-circle-outline" size={26} color={Colors.accent}/>
   <Text accessibilityRole="header" style={s.heading}>Tell us about your experience</Text>
   <Text style={s.body}>If you bought, sold or tried to use a service on CarMazium, email us with the relevant listing URL, a brief description and the date. Please do not send passwords, identity-document images or bank account details. Sending feedback by email does not automatically publish a public review.</Text>
   <Button label="Email CarMazium feedback" onPress={feedback}/>
  </LinearGradient>
 </PublicInfoPage>;
};
