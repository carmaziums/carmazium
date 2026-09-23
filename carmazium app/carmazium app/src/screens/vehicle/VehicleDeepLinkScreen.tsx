import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { getListingById } from '../../lib/listingsApi';

type Props = NativeStackScreenProps<MainStackParamList, 'VehicleDeepLink'>;

export const VehicleDeepLinkScreen: React.FC<Props> = ({ navigation, route }) => {
  const { slug } = route.params;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getListingById(slug)
      .then((listing) => {
        if (!active) return;
        if (!listing) throw new Error('Vehicle not found');
        navigation.reset({
          index: 1,
          routes: [
            { name: 'Tabs' },
            { name: 'VehicleDetail', params: { listing } },
          ],
        });
      })
      .catch((err: any) => {
        if (active) setError(err?.message || 'Could not open this vehicle.');
      });

    return () => { active = false; };
  }, [navigation, slug]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgPrimary} />
      {error ? (
        <View style={styles.card}>
          <Ionicons name="alert-circle-outline" size={34} color={Colors.accent} />
          <Text style={styles.title}>Vehicle unavailable</Text>
          <Text style={styles.body}>{error}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>BACK TO CARS</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.body}>Opening vehicle…</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loading: { alignItems: 'center', gap: 12 },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgSecondaryAlt,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    borderRadius: 18,
    padding: 24,
  },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white, textAlign: 'center' },
  body: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  button: { marginTop: 6, backgroundColor: Colors.accent, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white },
});
