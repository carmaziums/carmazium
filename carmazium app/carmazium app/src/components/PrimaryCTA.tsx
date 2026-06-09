import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  View,
  ViewStyle,
  StyleProp,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, LetterSpacing } from '../constants/typography';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface PrimaryCTAProps {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: 'filled' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  hasChamfer?: boolean;
}

export const PrimaryCTA: React.FC<PrimaryCTAProps> = ({
  label,
  onPress,
  isLoading = false,
  disabled = false,
  variant = 'filled',
  size = 'lg',
  icon,
  iconPosition = 'right',
  style,
  fullWidth = true,
  hasChamfer = false,
}) => {
  const scale = useSharedValue(1);
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  const isDisabled = disabled || isLoading;

  const containerStyle = [
    styles.base,
    !hasChamfer && styles[variant],
    hasChamfer && styles.chamferBase,
    hasChamfer && variant === 'filled' && styles.filledShadow,
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];

  const getSvgFillColor = () => {
    if (variant === 'filled') return Colors.accent;
    if (variant === 'ghost') return Colors.accentSubtle;
    return 'transparent';
  };

  const getSvgStrokeColor = () => {
    if (variant === 'outline') return Colors.accent;
    return 'transparent';
  };

  return (
    <AnimatedTouchable
      style={[animatedStyle, containerStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      activeOpacity={1}
      onLayout={handleLayout}
    >
      {hasChamfer && layout.width > 0 && layout.height > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={layout.width} height={layout.height}>
            <Path
              d={`M 10 0 L ${layout.width} 0 L ${layout.width} ${layout.height - 10} L ${layout.width - 10} ${layout.height} L 0 ${layout.height} L 0 10 Z`}
              fill={getSvgFillColor()}
              stroke={getSvgStrokeColor()}
              strokeWidth={variant === 'outline' ? 1.5 : 0}
            />
          </Svg>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator
          color={variant === 'filled' ? Colors.white : Colors.accent}
          size="small"
        />
      ) : (
        <View style={styles.inner}>
          {icon && iconPosition === 'left' && (
            <View style={styles.iconLeft}>{icon}</View>
          )}
          <Text
            style={[
              styles.label,
              variant === 'filled' && styles.labelFilled,
              variant === 'outline' && styles.labelOutline,
              variant === 'ghost' && styles.labelGhost,
              styles[`labelSize_${size}`],
            ]}
          >
            {label}
          </Text>
          {icon && iconPosition === 'right' && (
            <View style={styles.iconRight}>{icon}</View>
          )}
        </View>
      )}
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chamferBase: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    overflow: 'visible',
  },
  filledShadow: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  // Variants
  filled: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  ghost: {
    backgroundColor: Colors.accentSubtle,
  },
  // Sizes
  size_sm: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  size_md: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  size_lg: {
    paddingVertical: 18,
    paddingHorizontal: 28,
  },
  // Width
  fullWidth: {
    width: '100%',
  },
  // States
  disabled: {
    opacity: 0.45,
    shadowOpacity: 0,
  },
  // Inner layout
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconLeft: {
    marginRight: 2,
  },
  iconRight: {
    marginLeft: 2,
  },
  // Label styles
  label: {
    fontFamily: FontFamily.semiBold,
    letterSpacing: LetterSpacing.wide,
  },
  labelFilled: {
    color: Colors.white,
  },
  labelOutline: {
    color: Colors.accent,
  },
  labelGhost: {
    color: Colors.accent,
  },
  labelSize_sm: {
    fontSize: FontSize.sm,
  },
  labelSize_md: {
    fontSize: FontSize.base,
  },
  labelSize_lg: {
    fontSize: FontSize.md,
  },
});
