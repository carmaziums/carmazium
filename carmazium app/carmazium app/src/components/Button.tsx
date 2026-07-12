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
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

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
}) => {
  const isDisabled = disabled || loading;
  const height = SIZE_HEIGHT[size];

  const shapeStyle =
    shape === 'pill'
      ? { borderRadius: height / 2 }
      : shape === 'square'
      ? { borderRadius: 12 }
      // Web's signature clipped bottom-right corner ("clip-path-carmazium").
      : styles.clippedCorner;

  const labelColor = variant === 'outline' || variant === 'ghost' ? Colors.accent : Colors.textPrimary;

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
    isDisabled && styles.disabled,
    style,
  ];

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={[containerStyle, styles.overflowHidden]}
      >
        <LinearGradient
          colors={isDisabled ? [Colors.textDisabled, Colors.textDisabled] : [Colors.accentGlow, Colors.accent]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} disabled={isDisabled} activeOpacity={0.7} style={containerStyle}>
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
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.accent,
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
