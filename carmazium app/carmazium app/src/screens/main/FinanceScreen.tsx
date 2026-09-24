import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '../../constants/colors';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

export const FinanceScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{ height: insets.top }} />

      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Vehicle Finance</Text>
        <HamburgerButton />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}>
        <View style={styles.badge}><Text style={styles.badgeText}>TRADEXCHANGE · VEHICLE FINANCE</Text></View>
        <Text style={styles.title}>One enquiry. Approved matching providers.</Text>
        <Text style={styles.subtitle}>
          Send your vehicle-finance request through the same CarMazium account you use on the website. Approved matching providers can respond with their own terms.
        </Text>

        <View style={styles.card}>
          <Row icon="checkmark-circle-outline" text="Only providers approved for Vehicle Finance receive the enquiry." />
          <Row icon="shield-checkmark-outline" text="Your contact details are shared only after you explicitly consent." />
          <Row icon="document-text-outline" text="Providers supply their own eligibility checks, APR and regulated disclosures." />
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.warning} />
          <Text style={styles.noticeText}>
            CarMazium introduces you to providers. CarMazium does not make a lending decision and submitting an enquiry is not a credit approval.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primary}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ServiceLeadForm', { serviceType: 'FINANCE' })}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.primaryTitle}>Start finance enquiry</Text>
            <Text style={styles.primarySub}>Send your request to approved matching providers</Text>
          </View>
          <Ionicons name="arrow-forward" size={19} color={Colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondary}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CustomerServiceLeads')}
        >
          <Ionicons name="document-text-outline" size={18} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.secondaryTitle}>My finance & warranty enquiries</Text>
            <Text style={styles.secondarySub}>See matching status and provider responses</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={Colors.accent} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondary}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Tabs', { screen: 'Search' })}
        >
          <Ionicons name="car-outline" size={18} color={Colors.textPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.secondaryTitle}>Browse vehicles</Text>
            <Text style={styles.secondarySub}>Find the car you want before submitting an enquiry</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={Colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const Row = ({ icon, text }: { icon: string; text: string }) => (
  <View style={styles.row}>
    <Ionicons name={icon as any} size={18} color={Colors.success} />
    <Text style={styles.rowText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingTop: 18 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: Colors.borderSubtle, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 18 },
  badgeText: { color: Colors.warning, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: Colors.textPrimary, fontSize: 28, lineHeight: 33, fontWeight: '900' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 12, marginBottom: 20 },
  card: { borderRadius: 15, borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgSecondary, padding: 17, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14, borderRadius: 13, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 14 },
  noticeText: { flex: 1, color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22, borderRadius: 14, backgroundColor: Colors.accent, padding: 18 },
  primaryTitle: { color: Colors.white, fontSize: 15, fontWeight: '900' },
  primarySub: { color: 'rgba(255,255,255,0.78)', fontSize: 11.5, marginTop: 3 },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 11, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgSecondary, padding: 16 },
  secondaryTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  secondarySub: { color: Colors.textMuted, fontSize: 11.5, marginTop: 3 },
});
