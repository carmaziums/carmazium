import React, { useState } from 'react';
import {
  Linking,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Elevation, Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

import { IconButton } from '../../components/IconButton';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { FormField, pageStyles } from '../../components/NativePage';
import { Button } from '../../components/Button';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

// Keep the app's public contact information aligned with the website and
// app-support pages. Each row performs an action rather than implying an
// enquiry has been submitted to a non-existent public messaging endpoint.
const CONTACT_ROWS = [
  {
    icon: 'location-outline' as const,
    title: 'Visit Us',
    lines: ['181–187 Hunters Road', 'Lozells, Birmingham', 'B19 1ES, United Kingdom'],
    action: () => Linking.openURL('https://www.google.com/maps/search/?api=1&query=181-187%20Hunters%20Road%2C%20Birmingham%20B19%201ES%2C%20UK'),
  },
  {
    icon: 'call-outline' as const,
    title: 'Call Us',
    lines: ['0121 838 5040', 'Mon – Fri: 9am – 6pm (UK time)'],
    action: () => Linking.openURL('tel:+441218385040'),
  },
  {
    icon: 'mail-outline' as const,
    title: 'Email Us',
    lines: ['info@carmazium.com'],
    action: () => Linking.openURL('mailto:info@carmazium.com'),
  },
];

export const ContactScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const openDraft = async () => {
    setError('');
    if (![name,email,subject,message].every(value=>value.trim())) { setError('Complete your name, email address, subject and message.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    const body = 'Name: '+name.trim()+'\nReply-to email: '+email.trim()+'\n\nMessage:\n'+message.trim();
    setAttempted(true);
    try { await Linking.openURL('mailto:info@carmazium.com?subject='+encodeURIComponent('CarMazium enquiry: '+subject.trim())+'&body='+encodeURIComponent(body)); }
    catch { setError('No email app opened. Contact info@carmazium.com directly. Your enquiry has not been sent.'); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha06, Colors.groundClear, Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <WebsiteTopBar />

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent,{paddingBottom:insets.bottom+40}]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heroTitle,{fontSize:36,textAlign:'center',marginBottom:30}]}>Contact Us</Text>
        <View style={[pageStyles.panel,{marginBottom:24,padding:28,gap:24}]}>
          <Text style={[pageStyles.label,{fontSize:24}]}>Send us a message</Text>
          <FormField label="Full Name" value={name} onChangeText={setName} maxLength={100} autoComplete="name" placeholder="Your name" />
          <FormField label="Email Address" value={email} onChangeText={setEmail} maxLength={254} autoComplete="email" keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
          <FormField label="Subject" value={subject} onChangeText={setSubject} maxLength={120} placeholder="Enquiry about..." />
          <FormField label="Message" value={message} onChangeText={setMessage} maxLength={1800} multiline style={[pageStyles.input,{minHeight:150,textAlignVertical:'top'}]} placeholder="How can we help you? Please do not include passwords or bank details." />
          {!!error&&<Text accessibilityRole="alert" style={pageStyles.error}>{error}</Text>}
          <Button label="Open email draft" onPress={()=>void openDraft()} />
          <Text style={pageStyles.body}>This opens your email application with a prepared enquiry. Review it and press Send in your email app. Nothing is sent from this app automatically.</Text>
          {attempted&&<Text style={pageStyles.body}>If no email app opened, contact info@carmazium.com directly. Your enquiry has not been sent by this page.</Text>}
        </View>

        {CONTACT_ROWS.map((row) => (
          <TouchableOpacity key={row.title} style={styles.card} activeOpacity={0.8} onPress={()=>{void row.action().catch(()=>Alert.alert(row.title,row.lines.join("\n")));}} accessibilityRole="button" accessibilityLabel={row.title + ": " + row.lines.join(", ")}>
            <View style={styles.cardIconWrap}>
              <Ionicons name={row.icon} size={20} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{row.title}</Text>
              {row.lines.map((line) => (
                <Text key={line} style={styles.cardLine}>{line}</Text>
              ))}
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 2,
    ...Elevation.card,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
  },
  heroTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.xl,
    color: Colors.white,
    marginBottom: 4,
  },
  heroDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 16,
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    ...Elevation.card,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accentAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
    marginBottom: 3,
  },
  cardLine: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
});
