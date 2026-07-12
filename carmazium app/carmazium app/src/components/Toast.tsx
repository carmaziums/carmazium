import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated as RNAnimated,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

import { IconButton } from './IconButton';
export type ToastType = 'success' | 'error' | 'info' | 'saved';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  onHide: () => void;
  duration?: number;
}

const ICON_MAP: Record<ToastType, React.ComponentProps<typeof Ionicons>['name']> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
  saved: 'bookmark',
};

const COLOR_MAP: Record<ToastType, string> = {
  success: Colors.success,
  error: Colors.error,
  info: Colors.accent,
  saved: Colors.accent,
};

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'info',
  onHide,
  duration = 2400,
}) => {
  const translateY = useRef(new RNAnimated.Value(-100)).current;
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (timer.current) clearTimeout(timer.current);

      RNAnimated.parallel([
        RNAnimated.spring(translateY, {
          toValue: 0,
          damping: 18,
          stiffness: 200,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      timer.current = setTimeout(() => {
        RNAnimated.parallel([
          RNAnimated.timing(translateY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
          RNAnimated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => onHide());
      }, duration);
    }

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [visible]);

  if (!visible) return null;

  const accentColor = COLOR_MAP[type];

  return (
    <RNAnimated.View
      style={[
        styles.container,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <View style={[styles.iconWrapper, { backgroundColor: `${accentColor}20` }]}>
        <Ionicons name={ICON_MAP[type]} size={18} color={accentColor} />
      </View>
      <Text style={styles.message}>{message}</Text>
      <IconButton icon={<Ionicons name="close" size={16} color={Colors.textMuted} />} onPress={onHide} accessibilityLabel="Close" />
    </RNAnimated.View>
  );
};

// Hook for easy usage
export const useToast = () => {
  const [toast, setToast] = React.useState<{
    visible: boolean;
    message: string;
    type: ToastType;
  }>({ visible: false, message: '', type: 'info' });

  const show = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  const hide = () => setToast((prev) => ({ ...prev, visible: false }));

  return { toast, show, hide };
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(22, 22, 28, 0.97)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorderStrong,
    zIndex: 9999,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  iconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: FontSize.sm * 1.4,
  },
});
