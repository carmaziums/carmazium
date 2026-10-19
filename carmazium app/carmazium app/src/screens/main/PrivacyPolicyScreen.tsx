import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { adaptLegacyLightStyles, mergeAppearanceStyles } from '../../theme/appearancePalette';
import { FontFamily, FontSize } from '../../constants/typography';
import { IconButton } from '../../components/IconButton';
import { ThemedStatusBar } from '../../components/ThemedStatusBar';

const PRIVACY_URL = 'https://www.carmazium.com/privacy-policy';

export const PrivacyPolicyScreen: React.FC = () => {
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(adaptLegacyLightStyles(styles), lightContrastStyles) : styles;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <View style={ts.container}>
      <ThemedStatusBar />
      <View style={{ height: insets.top }} />
      <View style={ts.header}>
        <IconButton
          style={ts.backBtn}
          icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={ts.headerTitle}>Privacy Policy</Text>
        <View style={ts.headerSpacer} />
      </View>

      <View style={ts.webWrap}>
        <WebView
          source={{ uri: PRIVACY_URL }}
          onLoadStart={() => {
            setFailed(false);
            setLoading(true);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
          startInLoadingState={false}
          javaScriptEnabled
          domStorageEnabled
          style={ts.webview}
        />

        {loading && (
          <View style={ts.overlay} pointerEvents="none">
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={ts.loadingText}>Loading Privacy Policy…</Text>
          </View>
        )}

        {failed && !loading && (
          <View style={ts.overlay}>
            <Ionicons name="cloud-offline-outline" size={30} color={Colors.textMuted} />
            <Text style={ts.errorTitle}>Privacy Policy unavailable</Text>
            <Text style={ts.errorText}>
              Check your connection and try again. The policy is also available at carmazium.com/privacy-policy.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
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
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },
  headerSpacer: { width: 38, height: 38 },
  webWrap: { flex: 1, backgroundColor: Colors.bgPrimary },
  webview: { flex: 1, backgroundColor: Colors.bgPrimary },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    backgroundColor: Colors.bgPrimary,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  errorTitle: {
    marginTop: 12,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  errorText: {
    marginTop: 8,
    maxWidth: 320,
    textAlign: 'center',
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 20,
    color: Colors.textMuted,
  },
});

export default PrivacyPolicyScreen;

// Light-mode colours for keys the screen's light map did not cover.
// Generated from the contrast audit (scripts/theme-audit); dark mode is untouched.
const lightContrastStyles = StyleSheet.create({
  loadingText: { color: styles.loadingText.color },
});
