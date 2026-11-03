import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { Radius } from '../constants/spacing';
import { FontFamily, FontSize } from '../constants/typography';

/**
 * Back arrow + optional title for pages that had no on-screen way back
 * (owner report: "many pages don't have a back button"). Clears the status
 * bar. Renders nothing on a bottom-tab root (the same screen component is
 * used as a tab and as a pushed page, e.g. the dashboards) or when there is
 * nowhere to go back to.
 */
export const ScreenBackBar: React.FC<{ title?: string; forceSafeArea?: boolean }> = ({ title, forceSafeArea }) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isTabRoot = navigation.getState?.()?.type === 'tab';
  const canGoBack = !isTabRoot && navigation.canGoBack();
  if (!canGoBack) {
    return forceSafeArea ? <View style={{ height: insets.top }} /> : null;
  }
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.back}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        activeOpacity={0.75}
      >
        <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
      </TouchableOpacity>
      {!!title && <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  back: {
    width: 40, height: 40, borderRadius: Radius.inline,
    borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
});
