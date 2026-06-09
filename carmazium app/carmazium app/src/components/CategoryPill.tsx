import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

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
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedTouchable
      style={[styles.pill, isActive && styles.pillActive, animStyle]}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.94, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={1}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  pillActive: {
    backgroundColor: Colors.accentSubtle,
    borderColor: 'rgba(220,31,38,0.4)',
  },
  icon: {
    fontSize: 13,
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
