import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { FontFamily, FontSize } from '../../constants/typography';
import { lightReadableText, lightStrongText } from '../../theme/appearancePalette';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

const ERROR_BG = Colors.errorAlpha10;
const ERROR_BORDER = Colors.errorAlpha30;

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry }) => {
  const appearanceMode = useAppearanceStore(state => state.mode);
  const light = appearanceMode === 'light';
  return (
    <View style={[styles.container, light && { backgroundColor: '#FDECEC', borderColor: '#E8B5B9' }]}>
      <Ionicons name="alert-circle-outline" size={18} color={light ? lightReadableText.error : Colors.error} />
      <Text style={[styles.message, light && { color: '#7F1D1D' }]}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} activeOpacity={0.7}>
          <Text style={[styles.retry, light && { color: lightStrongText.accent }]}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ERROR_BG,
    borderWidth: 1,
    borderColor: ERROR_BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  message: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  retry: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
});

export default ErrorBanner;
