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
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={{ height: insets.top }} />
        <View style={styles.header}>
          <IconButton style={styles.closeBtn} icon={<Ionicons name="close" size={20} color={Colors.white} />} onPress={onClose} accessibilityLabel="Close" />
          <Text style={styles.title}>{title}</Text>
          <View style={styles.closeBtn} />
        </View>

        {url ? (
          <View style={styles.webviewWrap}>
            <WebView
              source={{ uri: url }}
              onNavigationStateChange={handleNav}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              style={styles.webview}
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
            />
            {loading && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        )}
      </View>
    </Modal>
  );
};

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
