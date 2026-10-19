import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { appearancePalette, lightReadableText, lightStrongText, mergeAppearanceStyles } from '../theme/appearancePalette';
import { useAppearanceStore } from '../store/appearanceStore';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface CategoryPillProps {
  label: string;
  icon: string;
  isActive: boolean;
  onPress: () => void;
}

export const CategoryPill: React.FC<CategoryPillProps> = ({
  label,
  icon,
  isActive,
  onPress,
}) => {
  const mode = useAppearanceStore(state => state.mode);
  const ts = mode === 'light' ? lightStyles : styles;
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedTouchable
      style={[ts.pill, isActive && ts.pillActive, animStyle]}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.94, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={1}
    >
      {/* theme-audit-ignore: the icon prop is an emoji glyph */}
      <Text style={ts.icon}>{icon}</Text>
      <Text style={[ts.label, isActive && ts.labelActive]}>{label}</Text>
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 50,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  pillActive: {
    backgroundColor: Colors.accentSubtle,
    borderColor: Colors.accentAlpha40,
  },
  icon: {
    fontSize: FontSize.sm,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  labelActive: {
    color: Colors.accent,
    fontFamily: FontFamily.semiBold,
  },
});

const LIGHT_PALETTE = appearancePalette('light');
const lightStyles = mergeAppearanceStyles(styles, {
  pill: { backgroundColor: LIGHT_PALETTE.card, borderColor: LIGHT_PALETTE.border },
  pillActive: { backgroundColor: Colors.accentAlpha12, borderColor: lightReadableText.accent },
  label: { color: LIGHT_PALETTE.secondary },
  labelActive: { color: lightStrongText.accent },
});
