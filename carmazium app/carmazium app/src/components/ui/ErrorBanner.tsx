import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Button } from '../Button';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/spacing';
import { FontFamily, FontSize } from '../../constants/typography';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

const ERROR_BG = Colors.errorAlpha10;
const ERROR_BORDER = Colors.errorAlpha30;

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry }) => {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} variant="outline" size="sm" />
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
    borderRadius: Radius.inline,
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
});

export default ErrorBanner;
