import React, { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { useAppearance } from '../../theme/useAppearance';

interface SkeletonProps {
  w: number;
  h: number;
  r?: number;
  /** Optional semantic tint for light-theme placeholders. */
  color?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ w, h, r = 14, color = Colors.bgTertiary as string }: SkeletonProps) => {
  const { isLight, palette } = useAppearance();
  // Dark mode keeps the original default. In light mode the untinted default
  // rendered navy blocks on the pale page (it read as broken UI), so only that
  // default is swapped for the light skeleton tone; explicit tints still win.
  if (isLight && color === Colors.bgTertiary) color = palette.skeleton;
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 700 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: w,
          height: h,
          borderRadius: r,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
};

export default Skeleton;
