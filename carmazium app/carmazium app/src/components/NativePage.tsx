import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, type TextInputProps } from 'react-native';
import { WebsiteTopBar } from './WebsiteTopBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { FontFamily } from '../constants/typography';

export function NativePage({ title, children }: { title: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: Colors.bgPrimary }}>
    <WebsiteTopBar />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[pageStyles.content, { paddingBottom: insets.bottom + 40 }]}><Text accessibilityRole="header" style={pageStyles.title}>{title}</Text>{children}</ScrollView>
  </View>;
}
export function FormField({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 8 }}><Text style={pageStyles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={Colors.textMuted} style={pageStyles.input} maxLength={254} {...props} /></View>;
}
export function CheckField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <TouchableOpacity style={pageStyles.check} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={() => onChange(!value)}><Text style={pageStyles.label}>{value ? '☑' : '☐'}</Text><Text style={[pageStyles.body, { flex: 1 }]}>{label}</Text></TouchableOpacity>;
}
export const pageStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, borderBottomWidth: 1, borderColor: Colors.border },
  title: { flex: 1, fontSize: 23, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  content: { padding: 20, gap: 20 }, body: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 25, color: Colors.textSecondary },
  label: { fontSize: 16, fontFamily: FontFamily.semiBold, color: Colors.textPrimary },
  input: { fontFamily: FontFamily.regular, minHeight: 52, padding: 14, borderWidth: 1, borderColor: Colors.borderHi, borderRadius: 12, backgroundColor: Colors.bgCard, color: Colors.textPrimary, fontSize: 16 },
  check: { minHeight: 48, flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 10 },
  error: { fontSize: 16, lineHeight: 24, color: Colors.accent },
  panel: { padding: 18, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, backgroundColor: Colors.bgCard, gap: 14 },
});
