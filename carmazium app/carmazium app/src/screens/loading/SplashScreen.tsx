import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, StatusBar, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Logo } from '../../components/Logo';
import { Colors } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const SplashScreen: React.FC = () => {
  const logoScale = useSharedValue(0.9);
  const logoOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0.04);

  useEffect(() => {
    // Logo entrance animation
    logoScale.value = withTiming(1, { duration: 1000 });
    logoOpacity.value = withTiming(1, { duration: 800 });

    // Pulsing background glow animation
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.12, { duration: 1500 }),
        withTiming(0.04, { duration: 1500 })
      ),
      -1, // Infinite repeat
      true // Reverse direction
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Dark background gradient */}
      <LinearGradient
        colors={[Colors.bgPrimary, Colors.deepBlue_050507, Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Crimson accent glow orb */}
      <Animated.View style={[styles.glowOrb, glowAnimatedStyle]} />

      {/* Logo Container */}
      <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
        <Logo size="lg" />
      </Animated.View>

      {/* Loading indicator */}
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color={Colors.accent} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowOrb: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    borderRadius: (SCREEN_WIDTH * 0.7) / 2,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 100,
    elevation: 20,
  },
  logoContainer: {
    zIndex: 1,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 80,
  },
});
