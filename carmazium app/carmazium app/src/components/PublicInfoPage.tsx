import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebsiteTopBar } from './WebsiteTopBar';
import { Colors } from '../constants/colors';
import { FontFamily } from '../constants/typography';

export function PublicInfoPage({ breadcrumb, navigation, children }: { breadcrumb: string; navigation: any; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: Colors.bgPrimary }}>
    <WebsiteTopBar />
    <ScrollView contentContainerStyle={[infoStyles.content, { paddingBottom: insets.bottom + 96 }]}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        <TouchableOpacity accessibilityRole="link" onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={infoStyles.muted}>Home</Text></TouchableOpacity>
        <Text style={infoStyles.muted}> / {breadcrumb}</Text>
      </View>
      {children}
    </ScrollView>
  </View>;
}
export const infoStyles = StyleSheet.create({
 content: { paddingHorizontal: 20, paddingTop: 20, gap: 24 },
 hero: { borderRadius: 24, borderWidth: 1, borderColor: Colors.accentAlpha30, paddingHorizontal: 24, paddingVertical: 48, gap: 24 },
 eyebrow: { fontFamily: FontFamily.bodyBlack, fontSize: 12, lineHeight: 18, letterSpacing: 2, color: Colors.accent },
 title: { fontFamily: FontFamily.headingBlack, fontSize: 30, lineHeight: 38, color: Colors.textPrimary },
 heading: { fontFamily: FontFamily.headingBlack, fontSize: 24, lineHeight: 32, color: Colors.textPrimary },
 subheading: { fontFamily: FontFamily.headingBlack, fontSize: 20, lineHeight: 28, color: Colors.textPrimary },
 lead: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 32, color: Colors.textSecondary },
 body: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 28, color: Colors.textSecondary },
 muted: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 24, color: Colors.textMuted },
 section: { marginTop: 24, gap: 20 },
 panel: { borderRadius: 24, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, padding: 24, gap: 16 },
 actions: { gap: 12 },
 icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
