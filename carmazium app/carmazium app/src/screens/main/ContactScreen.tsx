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
import { useAppearanceStore } from '../../store/appearanceStore';
import { adaptLegacyLightStyles } from '../../theme/appearancePalette';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
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
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? adaptLegacyLightStyles(styles) : styles;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  return (
    <View style={ts.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={appearanceMode === 'light' ? ['#EEF5FB', '#F7FBFF', '#EEF5FB'] : [Colors.accentAlpha06, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={ts.header}>
        <IconButton style={ts.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={ts.headerTitle}>Contact</Text>
        <HamburgerButton />
      </View>

      <ScrollView
        style={ts.scroll}
        contentContainerStyle={ts.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={ts.heroTitle}>Get in touch</Text>
        <Text style={ts.heroDesc}>
          Have a question about buying, selling, or your account? Reach us directly below.
        </Text>

        {CONTACT_ROWS.map((row) => (
          <TouchableOpacity key={row.title} style={ts.card} activeOpacity={0.8} onPress={row.action} accessibilityRole="button" accessibilityLabel={row.title + ": " + row.lines.join(", ")}>
            <View style={ts.cardIconWrap}>
              <Ionicons name={row.icon} size={20} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ts.cardTitle}>{row.title}</Text>
              {row.lines.map((line) => (
                <Text key={line} style={ts.cardLine}>{line}</Text>
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
