import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { DashboardCards } from '../../components/DashboardCards';
import { useAuthStore } from '../../store/authStore';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';

export const BuyerDashboardScreen: React.FC<{ navigation?: any }> = () => {
  const { user } = useAuthStore();
  const clearance = useTabBarClearance();
  return <View style={styles.container}>
    <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
    <WebsiteTopBar />
    <ScrollView contentContainerStyle={{ paddingBottom: clearance }} showsVerticalScrollIndicator={false}>
      <View style={styles.greeting}>
        <Text style={styles.title}>Hello, {user?.firstName || 'there'}</Text>
        <Text style={styles.subtitle}>Buy, sell and manage your cars in one place.</Text>
      </View>
      <DashboardCards mode="personal" />
    </ScrollView>
  </View>;
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  greeting: { paddingHorizontal: 20, paddingTop: 20 },
  title: { fontFamily: FontFamily.bold, fontSize: 26, color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 6 },
});
