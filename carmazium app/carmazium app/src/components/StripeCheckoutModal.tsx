import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { useAppearanceStore } from '../store/appearanceStore';
import { mergeAppearanceStyles } from '../theme/appearancePalette';
import {FontFamily, FontSize } from '../constants/typography';

import { IconButton } from './IconButton';
export interface StripeCheckoutModalProps {
  /** Hosted Stripe Checkout URL (from /payments/*-checkout endpoints). */
  url: string | null;
  /** Title shown in the modal header. */
  title?: string;
  /** Called when the WebView lands on a /checkout/success URL. */
  onSuccess: () => void;
  /** Called when the WebView lands on a /checkout/cancel URL. */
  onCancel?: () => void;
  /** Called when the user taps the close (X) button. */
  onClose: () => void;
}

/**
 * Full-screen modal that hosts Stripe's checkout flow inside a WebView.
 * Detects the return URLs the backend redirects to on success/cancel and
 * fires the corresponding callback. Used by CHANGE 4/6 in Stage 1 (HPI +
 * featured boost); listing-fee still uses the native Payment Sheet.
 */
export const StripeCheckoutModal: React.FC<StripeCheckoutModalProps> = ({
  url,
  title = 'Checkout',
  onSuccess,
  onCancel,
  onClose,
}) => {
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(styles, lightStripeCheckoutStyles) : styles;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);

  const handleNav = useCallback(
    (nav: WebViewNavigation) => {
      if (finished) return;
      const next = nav.url ?? '';
      if (next.includes('/checkout/success')) {
        setFinished(true);
        onSuccess();
      } else if (next.includes('/checkout/cancel')) {
        setFinished(true);
        onCancel?.();
      }
    },
    [finished, onSuccess, onCancel],
  );

  return (
    <Modal
      visible={!!url}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={ts.container}>
        <StatusBar barStyle={appearanceMode === 'light' ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />
        <View style={{ height: insets.top }} />
        <View style={ts.header}>
          <IconButton style={ts.closeBtn} icon={<Ionicons name="close" size={20} color={appearanceMode === 'light' ? '#0F172A' : Colors.white} />} onPress={onClose} accessibilityLabel="Close" />
          <Text style={ts.title}>{title}</Text>
          <View style={ts.closeBtn} />
        </View>

        {url ? (
          <View style={ts.webviewWrap}>
            <WebView
              source={{ uri: url }}
              onNavigationStateChange={handleNav}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              style={ts.webview}
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
            />
            {loading && (
              // theme-audit-ignore: transient spinner on a dim scrim over the checkout web view
              <View style={ts.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            )}
          </View>
        ) : (
          // theme-audit-ignore: transient spinner on a dim scrim over the checkout web view
          <View style={ts.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        )}
      </View>
    </Modal>
  );
};

const lightStripeCheckoutStyles = StyleSheet.create({
  container: {backgroundColor: '#EEF5FB'},
  header: {backgroundColor: '#FFFFFF', borderBottomColor: '#D5E1EC'},
  closeBtn: {backgroundColor: '#F7FBFF', borderColor: '#D5E1EC'},
  title: {color: '#0F172A'},
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteAlpha06,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
    flex: 1,
    textAlign: 'center',
  },
  webviewWrap: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,12,0.4)',
  },
});
