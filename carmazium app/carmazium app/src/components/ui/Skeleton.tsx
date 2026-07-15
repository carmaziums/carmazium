import React, { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { Colors } from '../../constants/colors';

interface SkeletonProps {
  w: number;
  h: number;
  r?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ w, h, r = 14 }) => {
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
          backgroundColor: Colors.bgTertiary,
        },
        animatedStyle,
      ]}
    />
  );
};

export default Skeleton;
