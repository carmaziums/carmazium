import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { adaptLegacyLightStyles, mergeAppearanceStyles, appearancePalette, themedColor, lightReadableText, lightStrongText } from '../../theme/appearancePalette';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { TERMS_SECTIONS, type Block } from '../../data/termsSections';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
import { ThemedStatusBar } from '../../components/ThemedStatusBar';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

/**
 * Terms & Conditions.
 *
 * The legal text is NOT written here — it lives in src/data/termsSections.ts,
 * copied verbatim from the web app. This screen is presentation only. Mobile
 * previously carried 10 broad hand-written sections that predated web's
 * 2026-08-14 rewrite, so the two platforms showed materially different terms
 * for the same service; the fix is to render web's document rather than
 * maintain a second version of it.
 *
 * Block rendering mirrors web's BlockRenderer (terms/page.tsx:860) one-for-one
 * so no block type silently renders as nothing.
 */

const CALLOUT_TONES = {
  danger: { bg: Colors.errorAlpha10, border: Colors.errorAlpha30, icon: 'shield-checkmark', color: Colors.error },
  warn: { bg: Colors.warningAlpha10, border: Colors.warningAlpha30, icon: 'warning-outline', color: Colors.warning },
  info: { bg: Colors.infoBlueAlpha10, border: Colors.infoBlueAlpha30, icon: 'information-circle', color: Colors.infoBlue },
} as const;

const BlockRenderer: React.FC<{ block: Block }> = ({ block }) => {
  // The legal text previously rendered with the dark StyleSheet in both modes
  // (near-white copy on the light page). Use the same light map as the screen.
  const mode = useAppearanceStore(state => state.mode);
  const isLight = mode === 'light';
  const st = isLight ? mergeAppearanceStyles(termsLightStyles, lightStContrastStyles) : styles;
  switch (block.type) {
    case 'p':
      return <Text style={st.para}>{block.text}</Text>;

    case 'ul':
      return (
        <View style={st.list}>
          {block.items.map((item, i) => (
            <View key={i} style={st.listRow}>
              <Text style={st.bullet}>•</Text>
              <Text style={st.listText}>{item}</Text>
            </View>
          ))}
        </View>
      );

    case 'dl':
      return (
        <View style={st.defList}>
          {block.items.map((item) => (
            <View key={item.term} style={st.defItem}>
              <Text style={st.defTerm}>{item.term}</Text>
              <Text style={st.defText}>{item.def}</Text>
            </View>
          ))}
        </View>
      );

    case 'steps':
      return (
        <View style={st.list}>
          {block.items.map((item, i) => (
            <View key={i} style={st.stepRow}>
              <View style={st.stepNum}>
                <Text style={st.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={st.listText}>{item}</Text>
            </View>
          ))}
        </View>
      );

    case 'money':
      return (
        <View style={st.moneyBox}>
          <Text style={st.moneyTitle}>{block.title}</Text>
          {block.lines.map((line, i) => (
            <Text key={i} style={st.moneyLine}>{line}</Text>
          ))}
        </View>
      );

    case 'callout': {
      const tone = CALLOUT_TONES[block.tone];
      return (
        <View style={[st.callout, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Ionicons name={tone.icon} size={16} color={themedColor(mode, tone.color)} />
          <Text style={st.calloutText}>{block.text}</Text>
        </View>
      );
    }

    default:
      return null;
  }
};

export const TermsScreen: React.FC = () => {
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(adaptLegacyLightStyles(styles), lightContrastStyles) : styles;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  return (
    <View style={ts.container}>
      <ThemedStatusBar />
      <LinearGradient
        colors={appearanceMode === 'light' ? ['#EEF5FB', '#F7FBFF', '#EEF5FB'] : [Colors.accentAlpha05, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      <View style={ts.header}>
        <IconButton
          style={ts.backBtn}
          icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={ts.headerTitle}>Terms & Conditions</Text>
        <HamburgerButton />
      </View>

      <ScrollView
        style={ts.scroll}
        contentContainerStyle={ts.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={ts.lastUpdated}>Last Updated: 13 August 2026</Text>
        <Text style={ts.companyLine}>Company no. 17053307 · England &amp; Wales</Text>

        {TERMS_SECTIONS.map((section) => (
          <View key={section.num} style={ts.sectionCard}>
            <View style={ts.sectionHead}>
              <View style={ts.sectionNum}>
                <Text style={ts.sectionNumText}>{section.num}</Text>
              </View>
              <Text style={ts.sectionTitle}>{section.title}</Text>
            </View>
            <View style={ts.sectionBody}>
              {section.blocks.map((block, i) => (
                <BlockRenderer key={i} block={block} />
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 120 }} />
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
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8 },

  lastUpdated: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
  },
  companyLine: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size11_5,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 20,
  },

  sectionCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 12,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionNum: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: Radius.chip,
    backgroundColor: Colors.accentAlpha12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size11_5,
    color: Colors.accent,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.white,
  },
  sectionBody: { gap: 12 },

  para: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 21,
    color: Colors.textSecondary,
  },

  list: { gap: 8 },
  listRow: { flexDirection: 'row', gap: 8 },
  bullet: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 21,
    color: Colors.accent,
  },
  listText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 21,
    color: Colors.textSecondary,
  },

  defList: { gap: 12 },
  defItem: { gap: 2 },
  defTerm: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
  },
  defText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    lineHeight: 18,
    color: Colors.textMuted,
  },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accentAlpha12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.accent,
  },

  moneyBox: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.inline,
    padding: 14,
    gap: 4,
  },
  moneyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    marginBottom: 4,
  },
  moneyLine: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },

  callout: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: Radius.inline,
    padding: 14,
  },
  calloutText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
});

export default TermsScreen;

const LIGHT_PALETTE = appearancePalette('light');

// Light-mode text colours for keys the screen's light map did not cover.
// Generated from the contrast audit (scripts/theme-audit); dark mode is untouched.
const lightContrastStyles = StyleSheet.create({
  companyLine: { color: LIGHT_PALETTE.muted },
});

// Light styles for the legal-text blocks, built once.
const termsLightStyles = mergeAppearanceStyles(adaptLegacyLightStyles(styles), lightContrastStyles);

// Light-mode colours for keys the screen's light map did not cover.
// Generated from the contrast audit (scripts/theme-audit); dark mode is untouched.
const lightStContrastStyles = StyleSheet.create({
  para: { color: LIGHT_PALETTE.secondary },
  bullet: { color: lightReadableText.accent },
  defTerm: { color: LIGHT_PALETTE.text },
  stepNumText: { color: lightStrongText.accent },
  moneyLine: { color: LIGHT_PALETTE.secondary },
});
