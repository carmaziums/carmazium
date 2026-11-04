import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Elevation } from '../constants/spacing';

// Mirrors the web app's `src/components/ui/Button.tsx` variant system
// (variant/size/shape) so CTAs read as the same product across platforms
// instead of each screen hand-rolling its own TouchableOpacity + LinearGradient.

export type ButtonVariant = 'primary' | 'outline' | 'dark' | 'ghost';
export type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';
export type ButtonShape = 'default' | 'pill' | 'square';

interface ButtonProps {
  label?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const SIZE_HEIGHT: Record<ButtonSize, number> = { sm: 40, default: 50, lg: 56, icon: 44 };
const SIZE_FONT: Record<ButtonSize, number> = { sm: FontSize.xs, default: FontSize.sm, lg: FontSize.base, icon: FontSize.sm };
const SIZE_PADDING_H: Record<ButtonSize, number> = { sm: 16, default: 22, lg: 28, icon: 0 };

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  shape = 'default',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'right',
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const isDisabled = disabled || loading;
  const height = SIZE_HEIGHT[size];
  const resolvedAccessibilityLabel = accessibilityLabel ?? label ?? 'Button';
  const expandedHitSlop = size === 'sm' || size === 'icon'
    ? { top: 4, bottom: 4, left: 4, right: 4 }
    : undefined;

  const shapeStyle =
    shape === 'pill'
      ? { borderRadius: height / 2 }
      : shape === 'square'
      ? { borderRadius: 12 }
      // Web's signature clipped bottom-right corner ("clip-path-carmazium").
      : styles.clippedCorner;

  // White on the red primary in both themes (was textPrimary: navy-on-red
  // in light mode).
  const labelColor = variant === 'outline' || variant === 'ghost'
    ? Colors.accent
    : variant === 'primary' ? Colors.onAccent : Colors.textPrimary;

  const content = (
    <>
      {icon && iconPosition === 'left' && !loading && icon}
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        !!label && (
          <Text
            style={[styles.label, { fontSize: SIZE_FONT[size], color: labelColor }, textStyle]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )
      )}
      {icon && iconPosition === 'right' && !loading && icon}
    </>
  );

  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    shapeStyle,
    { height, paddingHorizontal: SIZE_PADDING_H[size] },
    fullWidth && styles.fullWidth,
    variant === 'outline' && styles.outline,
    variant === 'dark' && styles.dark,
    (variant === 'outline' || variant === 'dark') && !isDisabled && styles.raised,
    isDisabled && styles.disabled,
    style,
  ];

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={[containerStyle, !isDisabled && styles.primaryRaised]}
        accessibilityRole="button"
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        hitSlop={expandedHitSlop}
      >
        {/* 3D raised CTA: vertical gradient, top highlight, darker bevel
            edge and a red glow (Elevation.neon). Clipped in an inner layer so
            the outer view keeps its shadow on iOS. */}
        <View style={[StyleSheet.absoluteFillObject, shapeStyle, styles.overflowHidden]} pointerEvents="none">
          <LinearGradient
            colors={isDisabled ? [Colors.textDisabled, Colors.textDisabled] : [Colors.accentGlow, Colors.accent, Colors.accentDeep]}
            locations={isDisabled ? undefined : [0, 0.55, 1]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          {!isDisabled && <View style={styles.primaryHighlight} />}
          {!isDisabled && <View style={styles.primaryBevel} />}
        </View>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={containerStyle}
      accessibilityRole="button"
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      hitSlop={expandedHitSlop}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
  overflowHidden: {
    overflow: 'hidden',
  },
  clippedCorner: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 4,
  },
  outline: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  raised: {
    ...Elevation.card,
    borderBottomWidth: 3,
  },
  primaryRaised: {
    ...Elevation.neon,
  },
  primaryHighlight: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
    backgroundColor: Colors.onAccentHighlight,
  },
  primaryBevel: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
    backgroundColor: Colors.accentDark,
  },
  dark: {
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: FontFamily.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
