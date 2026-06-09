import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StatusBarSpacerProps {
  extra?: number;
}

export const StatusBarSpacer: React.FC<StatusBarSpacerProps> = ({ extra = 0 }) => {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.top + extra }} />;
};

export const BottomSpacer: React.FC<{ extra?: number }> = ({ extra = 0 }) => {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.bottom + extra }} />;
};
