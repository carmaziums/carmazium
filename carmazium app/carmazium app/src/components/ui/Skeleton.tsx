import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Colors } from '../../constants/colors';

interface SkeletonProps {
  w: number;
  h: number;
  r?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ w, h, r = 14 }) => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const p = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    p.start();
    return () => p.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: w,
        height: h,
        borderRadius: r,
        backgroundColor: Colors.bgTertiary,
        opacity,
      }}
    />
  );
};

export default Skeleton;
