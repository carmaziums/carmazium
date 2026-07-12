import React, { ComponentType, ReactNode } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../constants/colors';

// Every icon-only button in the app used to be a bare TouchableOpacity wrapping
// an Ionicons/MaterialCommunityIcons element with no accessibilityLabel/Role and
// often a sub-44pt hit target (mobile-ui-ux-audit.md §C3/§C4). This is the single
// place that now guarantees both — accessibilityLabel is a required prop, and the
// container is always sized to at least 44x44 via padding + hitSlop.

export interface IconButtonProps {
  /** Either an already-constructed icon element (<Ionicons name="close" .../>) or an icon component type. */
  icon: ComponentType<{ size?: number; color?: string }> | ReactNode;
  /** Required — TypeScript enforces every IconButton describes itself to a screen reader. */
  accessibilityLabel: string;
  onPress: () => void;
  size?: number;
  color?: string;
  variant?: 'ghost' | 'solid' | 'circle';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const MIN_HIT_TARGET = 44;

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  accessibilityLabel,
  onPress,
  size = 20,
  color = Colors.white,
  variant = 'ghost',
  disabled = false,
  style,
}) => {
  const iconElement = React.isValidElement(icon)
    ? icon
    : icon
      ? React.createElement(icon as ComponentType<{ size?: number; color?: string }>, { size, color })
      : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={disabled ? { disabled: true } : undefined}
      accessible
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={[
        styles.base,
        variant === 'solid' && styles.solid,
        variant === 'circle' && styles.circle,
        disabled && styles.disabled,
        style,
      ]}
    >
      {iconElement}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    minWidth: MIN_HIT_TARGET,
    minHeight: MIN_HIT_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
  },
  circle: {
    backgroundColor: Colors.whiteAlpha06,
    borderRadius: MIN_HIT_TARGET / 2,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  disabled: {
    opacity: 0.4,
  },
});
