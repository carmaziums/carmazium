import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

interface Props {
  height: number;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// React error boundaries must be class components — there is no hooks
// equivalent. Catches a synchronous render-time crash from
// ThreeDVehicleViewer (e.g. a WebGL/WebView init failure on a low-end
// device) so it can't take down the whole detail screen. This is distinct
// from ThreeDVehicleViewer's own loadError/glbError states, which only
// catch async promise rejections during asset loading, not a thrown error
// during render/mount.
export class DamageViewerErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.warn('3D damage viewer crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={[styles.fallback, { height: this.props.height }]}>
          <Ionicons name="cube-outline" size={22} color={Colors.textMuted} />
          <Text style={styles.fallbackText}>3D preview isn't available on this device</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
