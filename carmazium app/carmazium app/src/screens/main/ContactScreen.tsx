import React from 'react';
import {
  Linking,
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
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

// Matches web's src/app/contact/page.tsx contact-info panel exactly. Web's
// "Send us a message" form has no onSubmit/API call at all — it's decorative
// — so rather than port a fake form, these rows do something real: call,
// email, or open Maps.
const CONTACT_ROWS = [
  {
    icon: 'location-outline' as const,
    title: 'Visit Us',
    lines: ['123 Luxury Lane', 'Mayfair, London', 'W1J 7NW, UK'],
    action: () => Linking.openURL('https://maps.google.com/?q=123+Luxury+Lane,+Mayfair,+London,+W1J+7NW,+UK'),
  },
  {
    icon: 'call-outline' as const,
    title: 'Call Us',
    lines: ['+44 (0) 20 1234 5678', 'Mon - Fri: 9am - 6pm'],
    action: () => Linking.openURL('tel:+442012345678'),
  },
  {
    icon: 'mail-outline' as const,
    title: 'Email Us',
    lines: ['support@carmazium.com'],
    action: () => Linking.openURL('mailto:support@carmazium.com'),
  },
];

export const ContactScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha06, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Contact</Text>
        <HamburgerButton />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heroTitle}>Get in touch</Text>
        <Text style={styles.heroDesc}>
          Have a question about buying, selling, or your account? Reach us directly below.
        </Text>

        {CONTACT_ROWS.map((row) => (
          <TouchableOpacity key={row.title} style={styles.card} activeOpacity={0.8} onPress={row.action}>
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
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha07,
    padding: 16,
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
