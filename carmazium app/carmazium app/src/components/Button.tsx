import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily } from '../constants/typography';

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

const SIZE_HEIGHT: Record<ButtonSize, number> = { sm: 48, default: 52, lg: 56, icon: 48 };
const SIZE_FONT: Record<ButtonSize, number> = { sm: 14, default: 14, lg: 16, icon: 14 };
const SIZE_PADDING_H: Record<ButtonSize, number> = { sm: 16, default: 20, lg: 28, icon: 0 };

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

  // Same rounded geometry, sentence case and neutral outline as the website.
  const shapeStyle = { borderRadius: shape === 'square' || size === 'sm' ? 8 : 12 };
  const labelColor = variant === 'primary' || variant === 'dark'
    ? Colors.onAccent : variant === 'ghost' ? Colors.textSecondary : Colors.textPrimary;

  const content = (
    <>
      {icon && iconPosition === 'left' && !loading && icon}
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        !!label && (
          <Text
            style={[styles.label, { fontSize: SIZE_FONT[size], color: labelColor }, textStyle]}

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
    { minHeight: height, paddingVertical: 12, paddingHorizontal: SIZE_PADDING_H[size] },
    fullWidth && styles.fullWidth,
    variant === 'outline' && styles.outline,
    variant === 'dark' && styles.dark,
    variant === 'primary' && styles.primary,
    isDisabled && styles.disabled,
    style,
  ];


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
  primary: { backgroundColor: Colors.accent, borderWidth: 1, borderColor: Colors.accent },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.borderHi },
  dark: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' },
  disabled: {
    opacity: 0.45,
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
    fontFamily: FontFamily.semiBold,
    lineHeight: 20,
  },
});
