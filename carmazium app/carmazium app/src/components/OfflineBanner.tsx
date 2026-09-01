import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { subscribeToConnectivity } from '../lib/network';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

/**
 * App-wide offline indicator (CROSS-015).
 *
 * Mounted once in `App.tsx` above the navigator rather than per screen, so it
 * covers every route including ones added later. Renders nothing at all when
 * online — this must not occupy layout or intercept touches in the normal case.
 */
export const OfflineBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => subscribeToConnectivity((online) => setOffline(!online)), []);

  if (!offline) return null;

  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + 8 }]}
      // Announced to screen readers, but not focusable and not touchable: it is
      // a status, and stealing focus mid-task to say so would be worse than the
      // problem it reports.
      accessibilityRole="alert"
      accessibilityLabel="No internet connection"
      pointerEvents="none"
    >
      <Ionicons name="cloud-offline-outline" size={14} color={Colors.warning} />
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.warningAlpha15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warningAlpha30,
  },
  text: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.warning,
  },
});
